import { expect, test, type Page, type Request } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Requêtes forgées : ce que le serveur fait d'une Server Action appelée sans passer par le
 * formulaire (recette, réserves des critères 8 et 9).
 *  - critère 9 : le formulaire est rempli correctement, puis la requête est modifiée en route,
 *    après la validation du navigateur. Le refus ne peut donc venir que du serveur.
 *  - critère 8 : la requête d'une action d'administration, captée chez un super-administrateur,
 *    est rejouée telle quelle par un rôle insuffisant, puis sans session.
 * Les matrices complètes (chaque action × chaque rôle, chaque action × saisies invalides) sont
 * dans les tests unitaires ; ici, on vérifie le chemin HTTP réel sur le build de production.
 */
test.use({ extraHTTPHeaders: randomClient() });

const isAction = (request: Request) =>
  request.method() === "POST" && Boolean(request.headers()["next-action"]);

/** Modifie le corps de la prochaine Server Action envoyée par la page. */
async function forgeNextAction(page: Page, change: (body: string) => string) {
  let forged = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (forged || !isAction(request)) return route.fallback();
    const body = request.postData() ?? "";
    const changed = change(body);
    expect(changed, "la requête devait être modifiée").not.toBe(body);
    forged = true;
    await route.continue({ postData: changed });
  });
  return () => forged;
}

async function fillMembership(page: Page, email: string) {
  await page.goto("/membership");
  await page.getByLabel("Prénom").fill("Moussa");
  await page.getByLabel("Nom", { exact: true }).fill("Forge");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Tranche d’âge").selectOption("FROM_18_TO_25");
  await page.getByLabel("Situation").selectOption("STUDENT");
  await page.getByLabel("Génies du soir").check();
  await page.getByLabel(/J’accepte que le club utilise/).check();
  await page.getByLabel(/J’accepte la charte du club/).check();
}

const forgeries: {
  name: string;
  change: (body: string, email: string) => string;
  error: RegExp;
}[] = [
  {
    name: "adresse e-mail invalide",
    change: (body, email) => body.replace(email, "pas-une-adresse"),
    error: /Cette adresse e-mail n’est pas valide\./,
  },
  {
    name: "consentement retiré",
    change: (body) => body.replace('"consent":true', '"consent":false'),
    error: /Votre accord est nécessaire pour traiter la demande\./,
  },
  {
    name: "charte non acceptée",
    change: (body) => body.replace('"charter":true', '"charter":false'),
    error: /L’adhésion suppose d’accepter la charte du club\./,
  },
  {
    name: "tranche d’âge inconnue",
    change: (body) => body.replace('"ageRange":"FROM_18_TO_25"', '"ageRange":"CENT_ANS"'),
    error: /Choisissez votre tranche d’âge\./,
  },
  {
    name: "mineur sans parent ni tuteur",
    change: (body) => body.replace('"ageRange":"FROM_18_TO_25"', '"ageRange":"UNDER_15"'),
    error: /Indiquez le nom d’un parent ou tuteur\./,
  },
  {
    name: "prénom de dix mille caractères",
    change: (body) => body.replace('"firstName":"Moussa"', `"firstName":"${"M".repeat(10_000)}"`),
    error: /Pas plus de 60 caractères\./,
  },
];

for (const forgery of forgeries) {
  test(`adhésion forgée après la validation du navigateur : ${forgery.name}`, async ({ page }) => {
    const email = `forge-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.agora.test`;
    try {
      await fillMembership(page, email);
      const wasForged = await forgeNextAction(page, (body) => forgery.change(body, email));
      await page.getByRole("button", { name: "Envoyer ma demande" }).click();
      // L'erreur revient du serveur, sous le champ concerné ou en tête du formulaire.
      await expect(page.getByText(forgery.error).first()).toBeVisible();
      expect(wasForged()).toBe(true);
      await expect(page.getByText("Demande envoyée")).toHaveCount(0);
    } finally {
      // Rien ne doit avoir été enregistré ; le nettoyage ne coûte rien s'il n'y a rien.
      testUser("delete", email);
    }
  });
}

test("inscription d’un invité forgée : rencontre inconnue, nom vidé", async ({ page }) => {
  await page.goto("/events/lancement-de-l-agora");
  const form = page.locator("#inscription");
  await form.getByLabel("Prénom et nom").fill("Awa Forge");
  await form.getByLabel("Adresse e-mail").fill(`forge-invite-${Date.now()}@e2e.agora.test`);
  let wasForged = await forgeNextAction(page, (body) =>
    body.replace(/"eventId":"[^"]+"/, '"eventId":"rencontre-qui-n-existe-pas"'),
  );
  await form.getByRole("button", { name: "Réserver ma place" }).click();
  await expect(form.getByRole("alert")).toContainText("Cette rencontre est introuvable.");
  expect(wasForged()).toBe(true);

  await page.unrouteAll();
  wasForged = await forgeNextAction(page, (body) =>
    body.replace('"name":"Awa Forge"', '"name":""'),
  );
  await form.getByRole("button", { name: "Réserver ma place" }).click();
  await expect(form.getByText("Indiquez votre prénom et votre nom.")).toBeVisible();
  expect(wasForged()).toBe(true);
  await expect(form.getByText(/Presque fini/)).toHaveCount(0);
});

test("action d’administration rejouée par un rôle insuffisant, puis sans session", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const stamp = Date.now();
  const adminEmail = `forge-admin-${stamp}@e2e.agora.test`;
  const libraryEmail = `forge-biblio-${stamp}@e2e.agora.test`;
  const libraryContext = await browser.newContext({
    locale: "fr-FR",
    baseURL: testInfo.project.use.baseURL,
    extraHTTPHeaders: randomClient(),
  });

  try {
    // --- Le super-administrateur enregistre les paramètres : on capte la requête de l'action ---
    await signInAsAdmin(page, request, adminEmail);
    await page.goto("/admin/settings");
    const save = page.getByRole("button", { name: "Enregistrer les paramètres" });
    await expect(save).toBeVisible();
    const [captured] = await Promise.all([page.waitForRequest(isAction), save.click()]);
    await expect(page.getByText(/Aucun changement|Paramètres enregistrés/).first()).toBeVisible();
    const url = captured.url();
    const body = captured.postData()!;
    const headers = {
      "next-action": captured.headers()["next-action"]!,
      "content-type": captured.headers()["content-type"] ?? "text/plain;charset=UTF-8",
      accept: "text/x-component",
    };
    expect(body).toContain('"membershipDurationMonths"');

    // Rejouée par son auteur, la requête passe : la capture est donc bien une action valide.
    const asAdmin = await page.request.post(url, { headers, data: body });
    expect(asAdmin.status()).toBe(200);
    expect(await asAdmin.text()).toContain('"ok":true');

    // --- Rôle insuffisant : même requête, cookies d'un responsable bibliothèque ---
    const library = await libraryContext.newPage();
    await signInAsAdmin(library, request, libraryEmail, "library");
    const asLibrary = await library.request.post(url, { headers, data: body });
    const refused = await asLibrary.text();
    expect(refused).toContain('"code":"FORBIDDEN"');
    expect(refused).not.toContain('"ok":true');

    // --- Autorisé mais saisie mal formée : le serveur valide encore ---
    const malformed = await page.request.post(url, {
      headers,
      data: body.replace(/"membershipDurationMonths":"?\d+"?/, '"membershipDurationMonths":"-5"'),
    });
    const invalid = await malformed.text();
    expect(invalid).toContain('"code":"VALIDATION"');
    expect(invalid).not.toContain('"ok":true');

    // --- Sans session : la requête n'atteint même pas l'action ---
    const anonymous = await request.post(url, { headers, data: body, maxRedirects: 0 });
    expect([307, 401, 403]).toContain(anonymous.status());
    expect(await anonymous.text()).not.toContain('"ok":true');

    // Les paramètres n'ont pas bougé : la durée d'adhésion affichée est toujours valide.
    await page.reload();
    await expect(page.getByLabel(/Durée d’une adhésion/)).not.toHaveValue("-5");
  } finally {
    await libraryContext.close();
    testUser("delete", libraryEmail);
    testUser("delete", adminEmail);
  }
});

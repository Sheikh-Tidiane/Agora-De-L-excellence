import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";

/**
 * Contenus officiels du club (docs/CONTENUS-CLUB.md) : ce que le site en montre, puis le parcours
 * adhésion avec charte → validation → carte encaissée → tableau des encaissements.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués.
 */
function testUser(...args: string[]) {
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    stdio: "pipe",
    shell: true,
  });
}

test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  },
});

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/**
 * Captures du contrôle qualité visuel (CLAUDE.md §7.5), prises au fil du parcours quand
 * `CAPTURES=1` : l'administration à 1440 px d'abord, puis 1280 px et 375 px.
 */
async function shot(page: Page, name: string, widths = [1440, 1280, 375]) {
  if (!process.env.CAPTURES) return;
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.waitForTimeout(400);
    await page.screenshot({
      path: `docs/captures/contenus/admin-${name}-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

test("l’accueil porte le slogan, le lancement, les trois dimensions et les cinq activités", async ({
  page,
}) => {
  await page.goto("/");
  await expect(h1(page)).toContainText("Le savoir comme flamme");
  await expect(h1(page)).toContainText("l’excellence comme ambition");
  await expect(
    page.getByRole("heading", { level: 2, name: "Lancement de L’Agora de l’Excellence" }),
  ).toBeVisible();
  await expect(page.getByText("Date provisoire").first()).toBeVisible();
  await expect(page.getByText("Lieu à confirmer").first()).toBeVisible();
  for (const dimension of ["Culturelle", "Intellectuelle", "Sociale"]) {
    await expect(page.getByRole("heading", { name: `Dimension ${dimension}` })).toBeVisible();
  }
  const activities = page.getByRole("region", { name: "Cinq activités." });
  for (const name of [
    "Les Rendez-vous lecture",
    "Les Tournois de Scrabble",
    "Les Débats d’idées",
    "Les Génies du soir",
    "L’Agora Ciné",
  ]) {
    await expect(activities.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  }
  await expect(page.getByRole("contentinfo")).toContainText("Le savoir comme flamme");
});

test("le club, les activités, la charte et les archives disent ce que dit le comité", async ({
  page,
}) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Comité de pilotage" })).toBeVisible();
  for (const name of [
    "Yaye Arête Sagna Diop",
    "Mame Cheikh Diop",
    "Ndèye Absa Diop",
    "Mansour Diop",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
  await expect(page.getByText("Une rencontre en présentiel tous les quinze jours.")).toBeVisible();
  await expect(page.getByText(/1\s000\sF\sCFA/).first()).toBeVisible();

  await page.goto("/activities");
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveCount(6);
  await expect(page.getByText("L’Invité de l’Agora")).toBeVisible();
  await expect(page.getByText("Tous les trois mois")).toBeVisible();

  // Le pied de page mène à la charte.
  await page.getByRole("contentinfo").getByRole("link", { name: "Charte du club" }).click();
  await expect(page).toHaveURL(/\/charte$/);
  await expect(page.getByText("Version provisoire", { exact: true })).toBeVisible();
  await expect(page.getByText("Respecter les opinions des autres.")).toBeVisible();

  await page.goto("/archives");
  await expect(h1(page)).toHaveText("La mémoire des rencontres.");

  await page.goto("/events/lancement-de-l-agora");
  await expect(page.getByText("16 h 30 – 17 h 00")).toBeVisible();
  await expect(page.getByText("Accueil des participants")).toBeVisible();
  await expect(page.getByText("samedi 26 décembre 2026 (date provisoire)")).toBeVisible();
});

test("adhésion avec charte, validation, carte encaissée, encaissements", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(480_000);
  const stamp = Date.now();
  const adminEmail = `admin-${stamp}@e2e.agora.test`;
  const memberEmail = `adherent-${stamp}@e2e.agora.test`;
  const adminPassword = `phrase-de-test-${randomInt(1e6)}`;
  const lastName = `Essai${stamp}`;
  testUser("create", adminEmail, "Fatou", "super_admin");

  try {
    // --- Demande d'adhésion : les montants précèdent le formulaire, la charte est obligatoire ---
    await page.goto("/membership");
    const card = page.locator("#demande");
    await expect(card.getByText(/1\s000\sF\sCFA/)).toBeVisible();
    await expect(card.getByText(/100\sF\sCFA/)).toBeVisible();
    await page.getByLabel("Prénom").fill("Moussa");
    await page.getByLabel("Nom", { exact: true }).fill(lastName);
    await page.getByLabel("Adresse e-mail").fill(memberEmail);
    await page.getByLabel("Tranche d’âge").selectOption("FROM_18_TO_25");
    await page.getByLabel("Situation").selectOption("STUDENT");
    await page.getByLabel("Génies du soir").check();
    await page.getByLabel(/J’accepte que le club utilise/).check();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("L’adhésion suppose d’accepter la charte du club.")).toBeVisible();
    await page.getByLabel(/J’accepte la charte du club/).check();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Demande envoyée")).toBeVisible();

    // --- Le responsable active son compte et se connecte ---
    const activation = await linkFromEmail(request, {
      to: adminEmail,
      subject: "Activez votre compte",
      path: "/activate",
    });
    await page.goto(activation);
    await page.getByLabel("Mot de passe", { exact: true }).fill(adminPassword);
    await page.getByLabel("Encore une fois").fill(adminPassword);
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page).toHaveURL(/\/login\?notice=activated$/);
    await page.getByLabel("Adresse e-mail").fill(adminEmail);
    await page.getByLabel("Mot de passe", { exact: true }).fill(adminPassword);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // --- Validation de la demande ---
    await page.goto("/admin/memberships");
    await page.getByLabel("Rechercher dans : Demandes d’adhésion").fill(lastName);
    await page
      .getByRole("button", { name: new RegExp(lastName) })
      .first()
      .click();
    await expect(page.getByText("Génies du soir")).toBeVisible();
    await page.getByRole("button", { name: "Valider l’adhésion" }).click();
    await expect(
      page.getByText("Demande validée. Le lien d’activation est parti par e-mail."),
    ).toBeVisible();

    // --- Carte de membre : non réglée, puis encaissée ---
    await page.goto("/admin/payments");
    await expect(h1(page)).toHaveText("Encaissements");
    const unpaid = page.getByRole("region", { name: "Cartes non réglées" });
    await expect(unpaid.getByText(new RegExp(lastName))).toBeVisible();
    await unpaid.getByRole("link", { name: new RegExp(lastName) }).click();
    await expect(page).toHaveURL(/\/admin\/members\?open=/);
    await page.getByRole("button", { name: /Encaisser la carte/ }).click();
    await page.getByRole("button", { name: "Enregistrer l’encaissement" }).click();
    await expect(page.getByText(/Carte réglée/)).toBeVisible();
    await expect(page.getByText(/Réglée le .*reçu par Fatou Essai/)).toBeVisible();
    await shot(page, "membre-carte", [1440, 375]);

    await page.goto("/admin/payments");
    await expect(
      page.getByRole("region", { name: "Cartes non réglées" }).getByText(new RegExp(lastName)),
    ).toHaveCount(0);
    await expect(
      page.getByRole("region", { name: "Derniers encaissements" }).getByText(new RegExp(lastName)),
    ).toBeVisible();

    // --- Comité, charte et affiche QR : les pages s'ouvrent avec leurs données ---
    await page.goto("/admin/committee");
    await expect(page.getByText("Yaye Arête Sagna Diop").first()).toBeVisible();
    await shot(page, "comite");
    await page.goto("/admin/charter");
    await expect(page.getByLabel(/Texte de la charte/)).toHaveValue(/Respecter les opinions/);
    await shot(page, "charte", [1440, 1280]);
    await page.goto("/admin/qr");
    await expect(
      page.getByRole("img", { name: /QR code vers .*\/membership#demande/ }),
    ).toBeVisible();

    await shot(page, "qr", [1440, 375]);

    // --- Fiche d'un événement : les nouveaux champs sont là ---
    await page.goto("/admin/events");
    await page.getByLabel("Rechercher dans : Événements").fill("Lancement");
    await page
      .getByRole("button", { name: /Lancement de L’Agora/ })
      .first()
      .click();
    await expect(page.getByLabel("Déroulé")).toHaveValue(/Mise en place/);
    await expect(page.getByLabel(/Date provisoire/)).toBeChecked();

    // --- Une séance aujourd'hui : inscription, pointage (présent, payé), participation encaissée ---
    const title = `E2E-Debat ${stamp}`;
    const today = new Date().toISOString().slice(0, 10);
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Type").selectOption("DEBAT_IDEES");
    await page.getByLabel("Début").fill(`${today}T23:59`);
    await page.getByLabel("Présentation").fill("Un sujet de société est choisi et débattu.");
    await page.getByLabel("Nom de l’invité").fill("Une invitée");
    await page.getByLabel("Présence de l’invité").selectOption("REMOTE");
    await page.getByLabel("Lien de visio").fill("https://visio.exemple.sn/agora");
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    const adminUrl = page.url();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Événement publié : il est visible sur le site.")).toBeVisible();
    const publicPath = await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href");

    await page.goto(publicPath!);
    await expect(page.getByText("L’Invité de l’Agora")).toBeVisible();
    await expect(page.getByText("En visioconférence")).toBeVisible();
    await expect(page.getByText("Lieu à confirmer")).toBeVisible();
    // Le lien de visio n'apparaît qu'une fois inscrit.
    await expect(page.getByRole("link", { name: "Suivre la rencontre à distance" })).toHaveCount(0);
    await page.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(page.getByRole("link", { name: "Suivre la rencontre à distance" })).toBeVisible();

    await page.goto(adminUrl);
    const registrants = page.getByRole("region", { name: "Inscrits" }).getByRole("table");
    await registrants.getByLabel("Payé").check();
    await expect(registrants.getByLabel("Présent")).toBeChecked();
    await expect(page.getByText("Participations encaissées")).toBeVisible();
    await expect(page.getByText(/1 présent · /)).toBeVisible();
    await shot(page, "evenement-pointage");
    await page.goto("/admin/payments");
    await expect(page.getByRole("region", { name: "Par séance" }).getByText(title)).toBeVisible();
    await shot(page, "encaissements");

    // --- La rencontre passée : compte rendu publié, visible sur sa page et dans les archives ---
    await page.goto(adminUrl);
    await page.getByLabel("Début").fill("2026-11-01T16:00");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Événement enregistré.")).toBeVisible();
    await page.reload();
    await page
      .getByRole("textbox", { name: "Compte rendu" })
      .fill("## Synthèse\n\nUn débat **animé**, conclu à main levée.");
    await page.getByRole("button", { name: "Publier le compte rendu" }).click();
    await expect(page.getByText(/Compte rendu publié/)).toBeVisible();
    await shot(page, "compte-rendu", [1440]);

    await page.goto(publicPath!);
    await expect(page.getByRole("heading", { name: "Synthèse" })).toBeVisible();
    await shot(page, "page-rencontre-passee", [375, 1440]);
    await page.goto("/archives?activite=debats-d-idees");
    const entry = page.getByRole("article").filter({ hasText: title });
    await expect(entry.getByText("Compte rendu", { exact: true })).toBeVisible();
    await expect(entry.getByText("Un débat animé, conclu à main levée.")).toBeVisible();
    await shot(page, "archives", [375, 1440]);
    await page.goto("/archives?activite=agora-cine");
    await expect(page.getByRole("article").filter({ hasText: title })).toHaveCount(0);
  } finally {
    testUser("delete-events", "E2E-Debat");
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

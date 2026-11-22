import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";

/**
 * Parcours critique des comptes : activation → connexion → déconnexion → mot de passe oublié.
 * Prérequis : `docker compose up -d` (PostgreSQL + Mailpit), migrations et seed appliqués.
 * Les e-mails sont de vrais envois, lus dans Mailpit.
 */
function testUser(...args: string[]) {
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    stdio: "pipe",
    shell: true,
  });
}

// Une adresse IP par exécution : la limitation de débit par IP ne s'accumule pas d'un lancement à l'autre.
test.use({
  extraHTTPHeaders: {
    "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
  },
});

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const password = (page: Page) => page.getByLabel("Mot de passe", { exact: true });
// Le message d'erreur du formulaire (pas l'annonceur de route de Next.js, lui aussi role="alert").
const formError = (page: Page) => page.locator("form [role=alert]");

async function signIn(page: Page, email: string, pass: string) {
  await page.getByLabel("Adresse e-mail").fill(email);
  await password(page).fill(pass);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("activation, connexion, déconnexion puis mot de passe oublié", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(480_000);
  const email = `awa-${testInfo.project.name}-${Date.now()}@e2e.agora.test`;
  const firstPassword = `premiere-phrase-${randomInt(1e6)}`;
  const secondPassword = `seconde-phrase-${randomInt(1e6)}`;
  testUser("create", email, "Awa");

  try {
    // Les espaces protégés renvoient à la connexion tant qu'on n'est pas connecté.
    await page.goto("/member");
    await expect(page).toHaveURL(/\/login\?next=%2Fmember$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);

    // --- Activation par lien ---
    const activation = await linkFromEmail(request, {
      to: email,
      subject: "Activez votre compte",
      path: "/activate",
    });
    await page.goto(activation);
    await expect(h1(page)).toHaveText("Bienvenue, Awa.");

    // Erreurs sous le champ concerné, avant tout envoi.
    await password(page).fill("court");
    await page.getByLabel("Encore une fois").fill("court");
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page.getByText(/Au moins 10 caractères : une courte phrase/)).toBeVisible();

    await password(page).fill(firstPassword);
    await page.getByLabel("Encore une fois").fill("autre chose, assez long");
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page.getByText("Les deux mots de passe ne sont pas identiques.")).toBeVisible();

    await page.getByLabel("Encore une fois").fill(firstPassword);
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page).toHaveURL(/\/login\?notice=activated$/);
    await expect(page.getByText("Votre compte est activé.")).toBeVisible();

    // --- Connexion ---
    await signIn(page, email, "ce-n-est-pas-le-bon");
    await expect(formError(page)).toHaveText("Adresse e-mail ou mot de passe incorrect.");
    await signIn(page, email, firstPassword);
    await expect(page).toHaveURL(/\/member$/);
    await expect(h1(page)).toHaveText("Bonjour, Awa.");
    // L'adresse de connexion figure sur la page Profil (depuis la phase 4, partie A).
    await page.goto("/member/profile");
    await expect(page.getByText(email)).toBeVisible();

    // Un membre n'entre pas dans l'administration.
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/access-denied$/);
    await expect(h1(page)).toHaveText("Cet espace ne vous est pas ouvert.");

    // --- Déconnexion ---
    await page.goto("/member/profile");
    await page
      .getByRole("button", { name: "Se déconnecter" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/member");
    await expect(page).toHaveURL(/\/login\?next=%2Fmember$/);

    // Le lien d'activation ne sert qu'une fois.
    await page.goto(activation);
    await expect(h1(page)).toHaveText("Ce lien a fait son temps.");

    // --- Mot de passe oublié ---
    await page.goto("/login");
    await page.getByRole("link", { name: "Mot de passe oublié ?" }).click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByRole("button", { name: "Recevoir le lien" }).click();
    await expect(h1(page)).toHaveText("Regardez votre boîte de réception.");

    const reset = await linkFromEmail(request, {
      to: email,
      subject: "Votre nouveau mot de passe",
      path: "/reset-password",
    });
    await page.goto(reset);
    await expect(h1(page)).toHaveText("Un nouveau mot de passe.");
    await page.getByLabel("Nouveau mot de passe").fill(secondPassword);
    await page.getByLabel("Encore une fois").fill(secondPassword);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(page).toHaveURL(/\/login\?notice=reset$/);
    await expect(page.getByText("Mot de passe enregistré.")).toBeVisible();

    // L'ancien mot de passe ne fonctionne plus, le nouveau oui.
    await signIn(page, email, firstPassword);
    await expect(formError(page)).toHaveText("Adresse e-mail ou mot de passe incorrect.");
    await signIn(page, email, secondPassword);
    await expect(page).toHaveURL(/\/member$/);

    // Le lien de réinitialisation ne sert qu'une fois.
    await page.goto("/member/profile");
    await page
      .getByRole("button", { name: "Se déconnecter" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto(reset);
    await page.getByLabel("Nouveau mot de passe").fill(`${secondPassword}-bis`);
    await page.getByLabel("Encore une fois").fill(`${secondPassword}-bis`);
    await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
    await expect(formError(page)).toContainText("Ce lien n’est plus valable.");
  } finally {
    testUser("delete", email);
  }
});

test("mot de passe oublié : même réponse pour une adresse inconnue", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Adresse e-mail").fill(`personne-${Date.now()}@e2e.agora.test`);
  await page.getByRole("button", { name: "Recevoir le lien" }).click();
  await expect(h1(page)).toHaveText("Regardez votre boîte de réception.");
});

test("la connexion se bloque après trop de tentatives sur un même compte", async ({ page }) => {
  const email = `force-${Date.now()}-${randomInt(1e6)}@e2e.agora.test`;
  await page.goto("/login");
  for (let attempt = 1; attempt <= 5; attempt++) {
    await signIn(page, email, `tentative-numero-${attempt}`);
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeEnabled();
    await expect(formError(page)).toHaveText("Adresse e-mail ou mot de passe incorrect.");
  }
  await signIn(page, email, "tentative-de-trop");
  await expect(formError(page)).toHaveText(/Trop de tentatives\. Réessayez dans \d+ minutes?\./);
});

test("pages de compte : pas de défilement horizontal, liens invalides expliqués", async ({
  page,
}) => {
  const paths = [
    "/login",
    "/forgot-password",
    "/activate?token=jeton-invalide-0123456789",
    "/reset-password",
    "/access-denied",
  ];
  for (const path of paths) {
    await page.goto(path);
    await expect(h1(page)).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.goto("/activate?token=jeton-invalide-0123456789");
  await expect(h1(page)).toHaveText("Ce lien a fait son temps.");
  await page.goto("/reset-password");
  await expect(h1(page)).toHaveText("Ce lien est incomplet.");
});

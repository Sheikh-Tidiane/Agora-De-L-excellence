import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * La session suit le visiteur sur tout le site : après connexion, le header public le montre
 * connecté, « Mon espace » mène à son espace sans redemander de connexion, et cela tient au
 * rechargement comme à la réouverture d'un onglet. Bogue signalé le 14/11/2026.
 */
test.use({ extraHTTPHeaders: randomClient() });

const banner = (page: Page) => page.getByRole("banner");

/** Crée un compte de test avec le rôle donné, l'active par le lien reçu et le connecte. */
async function signIn(page: Page, request: APIRequestContext, email: string, role: string) {
  const password = `phrase-de-session-${randomInt(1e6)}`;
  testUser("create", email, "Awa", role);
  await page.goto(
    await linkFromEmail(request, { to: email, subject: "Activez votre compte", path: "/activate" }),
  );
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/login\?notice=activated$/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}

test("membre : connecté sur tout le site, au rechargement et à la réouverture de l’onglet", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(240_000);
  const email = `session-${Date.now()}-${randomInt(1e6)}@e2e.agora.test`;
  try {
    await signIn(page, request, email, "member");
    await expect(page).toHaveURL(/\/member$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa.");

    // 1. La session elle-même survit à un passage par l'accueil.
    await page.goto("/");
    await page.goto("/member");
    await expect(page).toHaveURL(/\/member$/);

    // 2. Le header public montre le membre connecté.
    await page.goto("/");
    const mySpace = banner(page).getByRole("link", { name: "Mon espace" });
    await expect(mySpace).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "Adhérer" })).toHaveCount(0);

    // 3. « Mon espace » mène à l'espace, sans redemander de connexion.
    await mySpace.click();
    await expect(page).toHaveURL(/\/member$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa.");

    // 4. L'espace membre a le header du site : retour à l'accueil possible.
    await expect(banner(page).getByRole("link", { name: /accueil/ })).toBeVisible();
    await expect(banner(page).getByRole("link", { name: "Mon espace" })).toBeVisible();

    // 5. Rechargement.
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bonjour, Awa.");

    // 6. Fermeture de l'onglet, réouverture dans le même navigateur.
    await page.close();
    const again = await context.newPage();
    await again.goto("/");
    await expect(banner(again).getByRole("link", { name: "Mon espace" })).toBeVisible();
    await again.goto("/member");
    await expect(again).toHaveURL(/\/member$/);

    // 7. Un membre connecté qui ouvre la page de connexion (lien « Espace membre » du pied de
    //    page, favori…) est renvoyé vers son espace.
    await again.goto("/login");
    await expect(again).toHaveURL(/\/member$/);

    // 8. Déconnexion : le header redevient celui d'un visiteur.
    await again.goto("/member/profile");
    await again
      .getByRole("button", { name: "Se déconnecter" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(again).toHaveURL(/\/login$/);
    await again.goto("/");
    await expect(banner(again).getByRole("link", { name: "Adhérer" })).toBeVisible();
    await expect(banner(again).getByRole("link", { name: "Mon espace" })).toHaveCount(0);
    await again.goto("/member");
    await expect(again).toHaveURL(/\/login\?next=%2Fmember$/);
  } finally {
    testUser("delete", email);
  }
});

test("responsable : le header mène à l’administration", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(240_000);
  const email = `session-admin-${Date.now()}-${randomInt(1e6)}@e2e.agora.test`;
  try {
    await signInAsAdmin(page, request, email);
    await page.goto("/");
    // « Mon espace » mène un responsable à l'administration.
    const admin = banner(page).getByRole("link", { name: "Mon espace" });
    await expect(admin).toBeVisible();
    await admin.click();
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    testUser("delete", email);
  }
});

test("visiteur : le header propose l’adhésion et la connexion", async ({ page }) => {
  await page.goto("/");
  await expect(banner(page).getByRole("link", { name: "Adhérer" })).toBeVisible();
  await expect(banner(page).getByRole("link", { name: "Mon espace" })).toHaveCount(0);
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bon retour au club.");
});

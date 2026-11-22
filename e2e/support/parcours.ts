import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./mailpit";

/** Étapes communes aux parcours d'administration : comptes de test, connexion, adhésion validée. */

/** Lance `e2e/support/test-user.ts` (création et nettoyage des données de test). */
export function testUser(...args: string[]) {
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    stdio: "pipe",
    shell: true,
  });
}

/** Adresse IP propre à chaque fichier de test : les limites de débit ne se croisent pas. */
export const randomClient = () => ({
  "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
});

/** Crée un responsable de test (super-administrateur par défaut), active son compte par le lien reçu et le connecte. */
export async function signInAsAdmin(
  page: Page,
  request: APIRequestContext,
  email: string,
  role = "super_admin",
) {
  const password = `phrase-de-test-${randomInt(1e6)}`;
  testUser("create", email, "Fatou", role);
  const activation = await linkFromEmail(request, {
    to: email,
    subject: "Activez votre compte",
    path: "/activate",
  });
  await page.goto(activation);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/login\?notice=activated$/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Envoie une demande d'adhésion depuis le site public. */
export async function requestMembership(page: Page, lastName: string, email: string) {
  await page.goto("/membership");
  await page.getByLabel("Prénom").fill("Moussa");
  await page.getByLabel("Nom", { exact: true }).fill(lastName);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Tranche d’âge").selectOption("FROM_18_TO_25");
  await page.getByLabel("Situation").selectOption("STUDENT");
  await page.getByLabel("Génies du soir").check();
  await page.getByLabel(/J’accepte que le club utilise/).check();
  await page.getByLabel(/J’accepte la charte du club/).check();
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
}

/** Valide la demande depuis l'administration : le membre reçoit son numéro. */
export async function approveMembership(page: Page, lastName: string) {
  await page.goto("/admin/memberships");
  await page.getByLabel("Rechercher dans : Demandes d’adhésion").fill(lastName);
  await page
    .getByRole("button", { name: new RegExp(lastName) })
    .first()
    .click();
  await page.getByRole("button", { name: "Valider l’adhésion" }).click();
  await expect(
    page.getByText("Demande validée. Le lien d’activation est parti par e-mail."),
  ).toBeVisible();
}

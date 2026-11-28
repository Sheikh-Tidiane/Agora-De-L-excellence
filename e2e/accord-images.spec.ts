import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Accord pour les photos, vidéos et témoignages (cahier des charges § 11.2) : facultatif à
 * l'adhésion, modifiable dans le profil, visible des responsables sur la fiche du membre.
 */
test.use({ extraHTTPHeaders: randomClient() });

async function signInAsMember(page: Page, request: APIRequestContext, email: string) {
  const password = `phrase-de-membre-${randomInt(1e6)}`;
  testUser("create", email, "Awa", "member");
  testUser("member-number", email);
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
  await expect(page).toHaveURL(/\/member$/);
}

test("accord photos : facultatif à l’adhésion, donné dans le profil, visible des responsables", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(240_000);
  const stamp = Date.now();
  const memberEmail = `accord-membre-${stamp}@e2e.agora.test`;
  const adminEmail = `accord-admin-${stamp}@e2e.agora.test`;
  const admin = await browser.newPage({ extraHTTPHeaders: randomClient() });
  try {
    // Formulaire d'adhésion : la case existe et n'est pas cochée.
    await page.goto("/membership");
    const optIn = page.getByLabel(/publie des photos ou vidéos où je suis reconnaissable/);
    await expect(optIn).not.toBeChecked();

    await signInAsMember(page, request, memberEmail);
    await page.goto("/member/profile");
    const box = page.getByLabel(/publie des photos ou vidéos où je suis reconnaissable/);
    await expect(box).not.toBeChecked();

    await signInAsAdmin(admin, request, adminEmail);
    const panel = async () => {
      await admin.goto("/admin/members");
      await admin.getByLabel("Rechercher dans : Membres").fill(memberEmail);
      await admin.getByRole("row").filter({ hasText: memberEmail }).click();
    };
    await panel();
    await expect(admin.getByText(/Pas d’accord : ne pas publier/)).toBeVisible();

    await box.check();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await panel();
    await expect(admin.getByText(/Accord donné le/)).toBeVisible();

    // Retiré : de nouveau « pas d'accord ».
    // Page rechargée : on attend l'hydratation (sinon React rétablit la case cochée).
    await page.reload({ waitUntil: "networkidle" });
    const again = page.getByLabel(/publie des photos ou vidéos où je suis reconnaissable/);
    await expect(again).toBeChecked();
    await again.uncheck();
    await expect(again).not.toBeChecked();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await panel();
    await expect(admin.getByText(/Pas d’accord : ne pas publier/)).toBeVisible();
  } finally {
    await admin.close();
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

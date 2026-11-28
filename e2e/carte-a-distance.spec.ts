import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Membre qui suit à distance, carte non réglée :
 * - réglages du club : numéro Wave, option « masquer le lien de visio si la carte n'est pas réglée
 *   après le délai » ;
 * - option désactivée : le lien de visio s'affiche ; activée, et délai de grâce passé : il est
 *   masqué (absent de la page) et le membre est invité à régler sa carte ;
 * - espace membre : encadré « Régler ma carte » (montant, numéro Wave, numéro de membre, délai) ;
 * - liste des membres : filtre « Non réglée, délai passé », date d'adhésion, jours écoulés ;
 * - encaissement par Wave : référence obligatoire ; la carte réglée rend le lien de visio.
 * Les réglages modifiés sont remis tels qu'ils étaient à la fin.
 */
test.use({ extraHTTPHeaders: randomClient() });

const VIDEO = "https://visio.exemple.sn/agora-e2e";

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

const lastWord = (out: string) => out.trim().split(/\s+/).pop()!;

test("carte réglée à distance : lien de visio masqué puis rendu, encaissement Wave", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const stamp = Date.now();
  const title = `E2E-Visio ${stamp}`;
  const adminEmail = `visio-admin-${stamp}@e2e.agora.test`;
  const memberEmail = `visio-membre-${stamp}@e2e.agora.test`;
  const saved = lastWord(
    execFileSync(
      "pnpm",
      ["exec", "tsx", "e2e/support/test-user.ts", "get-payment-settings", "E2E"],
      { encoding: "utf8", shell: true },
    ),
  );
  const memberContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
  const member = await memberContext.newPage();
  try {
    // --- Rencontre de demain, avec un lien de visio ---
    await signInAsAdmin(page, request, adminEmail);
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(title);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.getByLabel("Début").fill(`${tomorrow}T18:00`);
    await page.getByLabel("Présentation").fill("Une lecture partagée, sur place et à distance.");
    await page.getByLabel("Lien de visio").fill(VIDEO);
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Événement publié : il est visible sur le site.")).toBeVisible();
    const publicPath = (await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href"))!;

    // --- Un membre accepté il y a 31 jours (délai de 30 jours passé), carte non réglée ---
    await signInAsMember(member, request, memberEmail);
    testUser("accept", memberEmail, "31");
    await member.goto(publicPath);
    await member.getByRole("button", { name: "Je m’inscris" }).click();
    // Option désactivée (défaut) : le lien de visio s'affiche.
    await expect(
      member.getByRole("link", { name: "Suivre la rencontre à distance" }),
    ).toBeVisible();

    // --- Réglages : numéro Wave et masquage du lien ---
    await page.goto("/admin/settings");
    await page.getByLabel("Numéro Wave du club").fill("77 111 22 33");
    await page.getByLabel(/Masquer le lien de visio/).check();
    await page.getByRole("button", { name: "Enregistrer les paramètres" }).click();
    await expect(page.getByText("Paramètres enregistrés. Le site est à jour.")).toBeVisible();

    // Option activée, délai passé : plus de lien, ni à l'écran ni dans la page.
    await member.reload();
    await expect(member.getByText(/le lien de visio est réservé aux membres/)).toBeVisible();
    await expect(member.getByRole("link", { name: "Suivre la rencontre à distance" })).toHaveCount(
      0,
    );
    expect(await member.content()).not.toContain(VIDEO);

    // --- Espace membre : encadré « Régler ma carte » ---
    await member.goto("/member/card");
    const box = member.getByRole("region", { name: "Régler ma carte" });
    await expect(box).toBeVisible();
    await expect(box.getByText("77 111 22 33")).toBeVisible();
    await expect(box.getByText(/Le délai pour la régler est passé/)).toBeVisible();
    const memberNumber = (await box.locator("span.whitespace-nowrap").last().textContent())!;
    expect(memberNumber).toMatch(/^E2E-/);

    // --- Administration : filtre « délai passé », jours écoulés, encaissement Wave ---
    await page.goto("/admin/members");
    await page.getByLabel("Carte").selectOption("overdue");
    await page.getByLabel("Rechercher dans : Membres").fill(memberEmail);
    const row = page.getByRole("row").filter({ hasText: memberEmail });
    await expect(row.getByText("Non réglée, délai passé")).toBeVisible();
    await expect(row.getByText("il y a 31 jours")).toBeVisible();
    await row.click();
    await page.getByRole("button", { name: /Encaisser la carte/ }).click();
    await page.getByLabel("Moyen de paiement").selectOption("WAVE");
    await page.getByRole("button", { name: "Enregistrer l’encaissement" }).click();
    await expect(page.getByText(/Indiquez la référence de la transaction Wave/)).toBeVisible();
    await page.getByLabel("Référence de la transaction").fill(`E2E-WAVE-${stamp}`);
    await page.getByRole("button", { name: "Enregistrer l’encaissement" }).click();
    await expect(page.getByText(/Carte réglée :/).first()).toBeVisible();

    // Carte réglée : le lien de visio revient, l'encadré disparaît.
    await member.goto(publicPath);
    await expect(
      member.getByRole("link", { name: "Suivre la rencontre à distance" }),
    ).toBeVisible();
    await member.goto("/member/card");
    await expect(member.getByRole("region", { name: "Régler ma carte" })).toHaveCount(0);
    await expect(member.getByText("Carte réglée", { exact: true }).first()).toBeVisible();
  } finally {
    await memberContext.close();
    testUser("set-payment-settings", "E2E", `'${saved}'`);
    testUser("delete-events", "E2E-Visio");
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

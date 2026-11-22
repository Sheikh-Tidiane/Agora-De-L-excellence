import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Lectures (phase 4, partie B) : un membre ajoute un livre, le termine, demande la validation et
 * écrit sa critique ; un responsable de la bibliothèque valide et approuve ; le membre voit ses
 * points, et sa critique paraît sur la fiche publique du livre.
 */
test.use({ extraHTTPHeaders: randomClient() });

async function signInAsMember(page: Page, request: APIRequestContext, email: string) {
  const password = `phrase-de-lecture-${randomInt(1e6)}`;
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

test("lecture terminée, validée, critique approuvée : points et publication", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "La validation se fait sur ordinateur ; le côté membre est couvert en mobile plus bas.",
  );
  test.setTimeout(240_000);
  const member = `lecteur-${randomInt(1e9)}@e2e.agora.test`;
  const staff = `biblio-${randomInt(1e9)}@e2e.agora.test`;
  const review =
    "Un livre qui m’a obligée à ralentir : chaque chapitre ouvre une question que nous pourrions débattre à l’Agora.";
  const staffContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
  const admin = await staffContext.newPage();

  try {
    await signInAsMember(page, request, member);

    // Étagère vide, puis ajout depuis la fiche d'un livre du catalogue.
    await page.goto("/member/readings");
    await expect(page.getByText("Votre étagère est vide")).toBeVisible();
    await page.goto("/library");
    await page.locator('main a[href^="/library/"]').first().click();
    await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);
    const title = (await page.getByRole("heading", { level: 1 }).textContent())!.trim();
    await page.getByRole("button", { name: "Terminé" }).click();
    await expect(page).toHaveURL(/\/member\/readings\/[a-z0-9]+$/);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

    await page.getByRole("button", { name: "Demander la validation" }).click();
    await expect(page.getByText("En attente de validation")).toBeVisible();

    await page.getByRole("radio", { name: "5 sur 5" }).check({ force: true });
    await page.getByLabel("Votre critique").fill("Trop court.");
    await page.getByRole("button", { name: "Envoyer ma critique" }).click();
    await expect(page.getByText(/Au moins 80 caractères/)).toBeVisible();
    await page.getByLabel("Votre critique").fill(review);
    await page.getByLabel(/Publier ma critique sous mon prénom/).check();
    await page.getByRole("button", { name: "Envoyer ma critique" }).click();
    await expect(page.getByText("En relecture")).toBeVisible();

    // Le responsable de la bibliothèque valide la lecture et approuve la critique.
    await signInAsAdmin(admin, request, staff, "library");
    await admin.goto("/admin/readings");
    // Une fois décidée, la demande quitte la file.
    const validateReading = admin.getByRole("button", {
      name: `Valider la lecture de Awa Essai, ${title}`,
    });
    await validateReading.click();
    await expect(validateReading).toHaveCount(0);
    const approveReview = admin.getByRole("button", { name: "Valider la critique de Awa Essai" });
    await approveReview.click();
    await expect(approveReview).toHaveCount(0);

    // Le membre : lecture validée, points au compteur et dans l'historique.
    await page.reload();
    await expect(page.getByText("Validée par le club", { exact: true })).toBeVisible();
    await expect(page.getByText("Approuvée", { exact: true })).toBeVisible();
    await page.goto("/member/rewards");
    await expect(page.getByRole("heading", { level: 1, name: "Mes récompenses" })).toBeVisible();
    await expect(page.getByText(title).first()).toBeVisible();
    await expect(page.getByText("+50")).toBeVisible();
    await expect(page.getByText("+30")).toBeVisible();
    await expect(page.getByText("Awa E. (vous)")).toBeVisible();

    // La critique paraît sur la fiche publique, sous le prénom seulement.
    await page.goto("/library");
    await page
      .getByRole("link", { name: new RegExp(title) })
      .first()
      .click();
    await expect(page.getByText(review)).toBeVisible();
    await expect(page.getByText("Awa · 5/5")).toBeVisible();
  } finally {
    await staffContext.close();
    testUser("delete", member);
    testUser("delete", staff);
  }
});

test("mes lectures sur téléphone : progression, note, retrait", async ({ page, request }) => {
  const member = `lectrice-${randomInt(1e9)}@e2e.agora.test`;
  try {
    await signInAsMember(page, request, member);
    await page.goto("/library");
    await page.locator('main a[href^="/library/"]').first().click();
    await page.getByRole("button", { name: "En cours" }).click();
    await expect(page).toHaveURL(/\/member\/readings\/[a-z0-9]+$/);

    await page.getByLabel(/Progression/).fill("40");
    await page.getByLabel(/Note personnelle/).fill("Relire le chapitre 3 avant la rencontre.");
    await page.getByLabel("Parmi mes favoris").check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Lecture enregistrée.")).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Espace membre" }).filter({ visible: true });
    await nav.getByRole("link", { name: "Lectures" }).click();
    await expect(page.getByRole("link", { name: /En cours\s*1/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("progressbar").first()).toHaveAttribute("aria-valuenow", "40");
    await page.getByRole("link", { name: /Favoris\s*1/ }).click();
    await page.locator('a[href^="/member/readings/"]').first().click();

    await page.getByRole("button", { name: "Retirer de mes lectures" }).click();
    await page.getByRole("button", { name: "Oui, retirer" }).click();
    await expect(page).toHaveURL(/\/member\/readings$/);
    await expect(page.getByText("Votre étagère est vide")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  } finally {
    testUser("delete", member);
  }
});

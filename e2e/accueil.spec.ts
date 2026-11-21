import { expect, test } from "@playwright/test";

test("l'accueil présente le club et mène à l'adhésion", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Le savoir comme flamme");
  await expect(page.getByText("Données de démonstration")).toBeVisible();

  // Aucun défilement horizontal de page.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);

  // Le lien du hero, pas celui du menu plein écran (fermé).
  await page.getByRole("main").getByRole("link", { name: "Rejoindre le club" }).click();
  await expect(page).toHaveURL(/\/membership$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Il reste une place.");
});

test("le menu plein écran s'ouvre, se ferme au clavier et navigue", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Le menu plein écran n'existe que sous 1024 px.");
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu principal" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await menu.getByRole("link", { name: /Bibliothèque/ }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(menu).toBeHidden();
});

test("aucun lien de l'accueil n'est mort", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page
    .locator("a[href^='/']")
    .evaluateAll((links) => [...new Set(links.map((a) => a.getAttribute("href")!))]);
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of hrefs) {
    const response = await request.get(href);
    expect(response.status(), href).toBe(200);
  }
});

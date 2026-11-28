import { expect, test } from "@playwright/test";

/**
 * Une adresse inconnue de livre, d'article, de rencontre ou de tournoi répond « introuvable » avec
 * un vrai code HTTP 404 (et non 200 avec une page vide), et une fiche existante reste en 200.
 */
for (const path of [
  "/library/livre-qui-n-existe-pas",
  "/news/article-qui-n-existe-pas",
  "/events/rencontre-qui-n-existe-pas",
  "/scrabble/tournoi-qui-n-existe-pas",
]) {
  test(`${path} : HTTP 404 et page « introuvable »`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("une fiche existante répond 200", async ({ page, request }) => {
  await page.goto("/library");
  const href = await page.locator('a[href^="/library/"]').first().getAttribute("href");
  test.skip(!href, "Aucun livre dans la base de test.");
  expect((await request.get(href!)).status()).toBe(200);
});

// Pages fixes rangées sous /events (liens personnels des invités) : ni 404, ni renvoi vers la
// connexion, même sans session (défaut corrigé).
for (const path of ["/events/registration", "/events/avis"]) {
  test(`${path} : ouverte sans session, ni 404 ni connexion`, async ({ page }) => {
    const response = await page.goto(`${path}?token=${"x".repeat(43)}`);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`^[^?]*${path}\\?token=`));
    await expect(page.getByRole("heading", { name: "Ce lien n’est plus valable." })).toBeVisible();
  });
}

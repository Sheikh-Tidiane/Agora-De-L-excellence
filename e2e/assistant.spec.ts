import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Sans clé ni modèle (cas du poste de développement et de la recette), le « Compagnon des
 * Lettres » n'existe pas pour les membres : ni lien dans la navigation, ni encart au tableau de
 * bord, page /member/assistant en 404, route /api/assistant en 404 (visiteur ou membre), et rien
 * dans le plan du site. Le cas « configuré » est couvert par les tests unitaires
 * (src/features/assistant/enabled.test.ts, src/app/api/assistant/assistant-route.test.ts).
 */
test.use({ extraHTTPHeaders: randomClient() });

const question = {
  mode: "word",
  messages: [{ role: "user", content: "Que veut dire palabre ?" }],
};

test("assistant non configuré : masqué partout, page et route en 404", async ({
  page,
  request,
  isMobile,
}) => {
  // Visiteur : la route n'existe pas.
  const anonymous = await request.post("/api/assistant", { data: question });
  expect(anonymous.status()).toBe(404);
  expect(await anonymous.json()).toMatchObject({ code: "NOT_FOUND" });
  // Plan du site : aucune adresse de l'assistant.
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain("assistant");

  const width = isMobile ? 375 : 1440;
  await page.setViewportSize({ width, height: isMobile ? 812 : 900 });
  const email = `assistant-${randomInt(1e9)}@e2e.agora.test`;
  const password = `phrase-assistant-${randomInt(1e6)}`;
  testUser("create", email, "Mariama", "member");
  testUser("member-number", email);
  try {
    await page.goto(
      await linkFromEmail(request, {
        to: email,
        subject: "Activez votre compte",
        path: "/activate",
      }),
    );
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByLabel("Encore une fois").fill(password);
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/member$/);

    // Tableau de bord et navigation : aucune mention de l'assistant.
    await expect(page.getByRole("heading", { level: 1, name: /Bonjour/ })).toBeVisible();
    await expect(page.getByText("Ma carte de membre").first()).toBeAttached();
    await expect(page.getByText(/Compagnon des Lettres/)).toHaveCount(0);
    await expect(page.getByText(/Demander à l’assistant/)).toHaveCount(0);
    await expect(page.locator('a[href^="/member/assistant"]')).toHaveCount(0);
    await page.screenshot({
      path: `docs/captures/assistant/${width}-espace-membre.png`,
      fullPage: true,
    });

    // Page : vrai 404, sans texte de l'assistant.
    const response = await page.goto("/member/assistant");
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/Compagnon des Lettres/)).toHaveCount(0);

    // Membre connecté : la route refuse aussi (404), sans texte inventé.
    const answer = await page.request.post("/api/assistant", { data: question });
    expect(answer.status()).toBe(404);
    expect(await answer.json()).toEqual({ error: "Page introuvable.", code: "NOT_FOUND" });
  } finally {
    testUser("delete", email);
  }
});

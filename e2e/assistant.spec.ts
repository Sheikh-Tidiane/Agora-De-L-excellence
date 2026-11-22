import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Phase 5 : sans clé d'API (cas du poste de développement et de la recette), l'assistant le dit
 * franchement et ne simule aucune réponse ; la route refuse les visiteurs et répond 503 aux membres.
 */
test.use({ extraHTTPHeaders: randomClient() });

test("assistant sans clé : « non connecté », aucune réponse simulée", async ({ page, request }) => {
  // Visiteur : la route exige une session.
  const anonymous = await request.post("/api/assistant", {
    data: { mode: "word", messages: [{ role: "user", content: "Que veut dire palabre ?" }] },
  });
  expect(anonymous.status()).toBe(401);

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

    await page.getByRole("link", { name: /Demander à l’assistant/ }).click();
    await expect(page).toHaveURL(/\/member\/assistant$/);
    await expect(page.getByRole("heading", { name: "Assistant non connecté" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Votre question" })).toHaveCount(0);

    // Membre connecté : la route répond 503, sans texte inventé.
    const response = await page.request.post("/api/assistant", {
      data: { mode: "word", messages: [{ role: "user", content: "Que veut dire palabre ?" }] },
    });
    expect(response.status()).toBe(503);
    expect(await response.json()).toMatchObject({ code: "NOT_CONFIGURED" });
  } finally {
    testUser("delete", email);
  }
});

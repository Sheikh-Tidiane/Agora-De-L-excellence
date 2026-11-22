import { expect, test, type Page } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Messagerie de contact : un message envoyé depuis /contact est enregistré, part par e-mail,
 * apparaît dans l'administration (rubrique Messages, compteur de la barre latérale) et passe
 * à « traité ». Le responsable communication y a accès. Le champ piège n'enregistre rien.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués.
 */
test.use({ extraHTTPHeaders: randomClient() });

const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
});

async function sendContact(page: Page, subject: string, options: { robot?: boolean } = {}) {
  await page.goto("/contact");
  await page.getByLabel("Votre nom").fill("Awa Essai");
  await page.getByLabel("Adresse e-mail").fill("awa.essai@e2e.agora.test");
  await page.getByLabel("Objet").fill(subject);
  await page
    .getByLabel("Votre message")
    .fill("Bonjour,\n\nÀ quelle heure commence la prochaine rencontre ? Merci d’avance.");
  if (options.robot)
    await page.locator("#contact-website").fill("https://robot.test", { force: true });
  await page.getByRole("button", { name: "Envoyer le message" }).click();
  await expect(page.getByText(/Message envoyé\./)).toBeVisible();
}

/** Captures du contrôle visuel (CAPTURES=1), dans `test-results/` (non versionné). */
async function shot(page: Page, name: string, widths: number[]) {
  if (!process.env.CAPTURES) return;
  const initial = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/captures/messagerie-${name}-${width}.png` });
  }
  if (initial) await page.setViewportSize(initial);
}

/** Nombre affiché à côté de « Messages » dans la barre latérale (0 s'il n'y a pas de pastille). */
async function newCount(page: Page): Promise<number> {
  const link = page
    .getByRole("navigation")
    .getByRole("link", { name: /^Messages/ })
    .first();
  await expect(link).toBeVisible();
  const match = /(\d+)/.exec((await link.textContent()) ?? "");
  return match ? Number(match[1]) : 0;
}

test("contact : le message s’enregistre, paraît dans l’admin et passe à « traité »", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const subject = `E2E-messagerie ${stamp}`;
  const robotSubject = `E2E-messagerie robot ${stamp}`;
  const adminEmail = `messagerie-${stamp}@e2e.agora.test`;
  try {
    // --- Côté visiteur ---
    await sendContact(page, subject);
    await sendContact(page, robotSubject, { robot: true });
    await expect(async () => {
      const found = await request.get(`${mailpit}/api/v1/search`, {
        params: { query: `subject:"${subject}"`, limit: "1" },
      });
      const { messages } = (await found.json()) as { messages: unknown[] };
      expect(messages.length).toBe(1);
    }).toPass({ timeout: 30_000 });

    // --- Côté club : le responsable communication a la rubrique ---
    await signInAsAdmin(page, request, adminEmail, "communication");
    const before = await newCount(page);
    expect(before).toBeGreaterThanOrEqual(1);

    await page.goto("/admin/messages");
    await expect(page.getByRole("heading", { level: 1, name: "Messages" })).toBeVisible();
    const search = page.getByLabel("Rechercher dans : Messages de contact");
    await search.fill("E2E-messagerie");
    const table = page.getByRole("table", { name: "Messages de contact" });
    // Le champ piège rempli : rien n'a été enregistré.
    await expect(table.getByRole("row").filter({ hasText: robotSubject })).toHaveCount(0);
    const row = table.getByRole("row").filter({ hasText: subject });
    await expect(row).toHaveCount(1);
    await expect(row.getByText("Nouveau")).toBeVisible();
    await search.fill("");
    await shot(page, "liste", [1440, 1280, 375]);
    await search.fill("E2E-messagerie");

    // Ouvrir le message le marque comme lu ; le compteur baisse.
    await row.getByRole("button", { name: "Awa Essai" }).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("heading", { name: subject })).toBeVisible();
    await expect(panel.getByText("À quelle heure commence la prochaine rencontre ?")).toBeVisible();
    await expect(panel.getByRole("radio", { name: "Lu" })).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => newCount(page)).toBe(before - 1);

    await shot(page, "detail", [1440, 375]);
    const reply = panel.getByRole("link", { name: "Répondre par e-mail" });
    await expect(reply).toHaveAttribute(
      "href",
      `mailto:awa.essai@e2e.agora.test?subject=${encodeURIComponent(`Re : ${subject}`)}`,
    );

    await panel.getByRole("button", { name: "Marquer comme traité" }).click();
    await expect(page.getByText("Message marqué comme traité.")).toBeVisible();
    await expect(panel.getByRole("radio", { name: "Traité" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(panel.getByText(/Traité le/)).toBeVisible();
    await page.keyboard.press("Escape");

    // Le filtre par statut le range parmi les messages traités.
    await page.getByLabel("Statut", { exact: true }).selectOption("HANDLED");
    await expect(row.getByText("Traité")).toBeVisible();
    await page.getByLabel("Statut", { exact: true }).selectOption("NEW");
    await expect(table.getByRole("row").filter({ hasText: subject })).toHaveCount(0);

    // Après rechargement, le statut est bien en base.
    await page.reload();
    await page.getByLabel("Rechercher dans : Messages de contact").fill(subject);
    await expect(
      page.getByRole("table", { name: "Messages de contact" }).getByText("Traité"),
    ).toBeVisible();
  } finally {
    testUser("delete-contact", "E2E-messagerie");
    testUser("delete", adminEmail);
  }
});

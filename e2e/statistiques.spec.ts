import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Statistiques du comité, à 375 px et 1440 px :
 * - une rencontre passée (lecture + Génies du soir) avec un membre pointé présent ;
 * - la page : chiffres, graphiques (rôle img, tableau de données), la rencontre dans la liste,
 *   le mode « activité principale » ;
 * - l'export CSV (téléchargé, séparateur « ; », la rencontre dedans) ;
 * - la version partenaires : ni nom, ni e-mail, ni titre de rencontre ;
 * - un rôle sans la permission n'y a pas accès.
 */
test.use({ extraHTTPHeaders: randomClient() });

const tool = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    encoding: "utf8",
    shell: true,
  })
    .trim()
    .split("\n")
    .pop()!;

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

test("statistiques : chiffres, graphiques, export CSV, version partenaires, accès", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const width = isMobile ? 375 : 1440;
  const viewport = { width, height: isMobile ? 812 : 900 };
  const title = `E2E-Stats-${stamp}-${width}`;
  const memberEmail = `stats-membre-${stamp}-${width}@e2e.agora.test`;
  const adminEmail = `stats-admin-${stamp}-${width}@e2e.agora.test`;
  const libraryEmail = `stats-biblio-${stamp}-${width}@e2e.agora.test`;
  const shot = (p: Page, name: string) =>
    p.screenshot({ path: `docs/captures/statistiques/${width}-${name}.png`, fullPage: true });
  await page.setViewportSize(viewport);
  const other = await browser.newPage({ viewport, extraHTTPHeaders: randomClient() });
  try {
    tool("create-feedback-event", title, "reel");
    testUser("create", memberEmail, "Awa", "member");
    testUser("check-in", memberEmail, title);

    await signInAsAdmin(page, request, adminEmail);
    await page.goto("/admin/stats?periode=3m");
    await expect(page.getByRole("heading", { level: 1, name: "Statistiques" })).toBeVisible();
    for (const name of [
      "Présence",
      "Activités les plus suivies",
      "Lecture",
      "Scrabble",
      "Membres",
      "Listes d’attente",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(
      page.getByRole("heading", { level: 2, name: /Membres qui ne reviennent plus/ }),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /Présents par mois/ })).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell").nth(2)).toHaveText("1");
    await noHorizontalScroll(page);
    await shot(page, "page");

    // Mode « activité principale » : l'adresse et la note changent.
    await page.getByLabel("Rencontres à plusieurs activités").selectOption("principale");
    await page.getByRole("button", { name: "Afficher" }).click();
    await expect(page).toHaveURL(/mode=principale/);
    await expect(page.getByText(/compte pour sa seule activité principale/).first()).toBeVisible();

    // Export CSV de la présence.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("region", { name: "Présence" }).getByRole("link", { name: "CSV" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^statistiques-presence-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Date;Rencontre;Inscrits;Présents;Taux de présence (%)");
    expect(csv).toContain(`${title};1;1;100`);

    // Version partenaires : aucun nom, aucune adresse, aucun titre de rencontre.
    await page.getByRole("link", { name: "Version partenaires" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Le club en chiffres" }),
    ).toBeVisible();
    // Le contenu de la page partenaires seulement (Next garde la page précédente, masquée).
    const html = await page
      .locator("article")
      .filter({ has: page.getByRole("heading", { name: "Le club en chiffres" }) })
      .innerHTML();
    for (const secret of [title, memberEmail, "Awa Essai", adminEmail]) {
      expect(html).not.toContain(secret);
    }
    await noHorizontalScroll(page);
    await shot(page, "partenaires");
    // À l'impression : le rapport seul, sans le nom de la personne connectée ni la navigation.
    await page.emulateMedia({ media: "print" });
    await expect(page.getByText("Fatou Essai").first()).toBeHidden();
    await expect(page.getByRole("heading", { name: "Le club en chiffres" })).toBeVisible();
    await page.emulateMedia({ media: "screen" });

    // Un responsable de la bibliothèque n'a pas accès aux statistiques.
    await signInAsAdmin(other, request, libraryEmail, "library");
    await other.goto("/admin/stats");
    await expect(other).not.toHaveURL(/\/admin\/stats/);
    expect((await other.request.get("/api/admin/stats?jeu=presence")).status()).toBe(403);
  } finally {
    await other.close();
    testUser("delete-events", title);
    for (const email of [memberEmail, adminEmail, libraryEmail]) testUser("delete", email);
  }
});

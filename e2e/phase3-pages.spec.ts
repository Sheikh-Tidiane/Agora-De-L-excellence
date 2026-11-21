import { expect, test, type Page } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Pages de la phase 3 hors adhésion et événements : bibliothèque, actualités, contact,
 * confidentialité, puis livres, articles, paramètres, équipe et journal côté administration.
 * Chaque page est ouverte, son geste principal exécuté, et la console doit rester sans erreur.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués. Le parcours public crée
 * lui-même le livre et l'article qu'il consulte : il ne dépend d'aucun contenu préexistant.
 */
test.use({ extraHTTPHeaders: randomClient() });

const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
const h1 = (page: Page) => page.getByRole("heading", { level: 1 });

/** Relève les erreurs de console, les exceptions et les réponses 5xx pendant le parcours. */
function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`exception : ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console : ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} : ${response.url()}`);
  });
  return problems;
}

/** Captures du contrôle visuel (§7.5) quand `CAPTURES=1`. */
async function shot(page: Page, name: string, widths: number[]) {
  if (!process.env.CAPTURES) return;
  const initial = page.viewportSize();
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/captures/phase-3/${name}-${width}.png`, fullPage: true });
  }
  if (initial) await page.setViewportSize(initial);
}

const publicWidths = [375, 768, 1440];
const adminWidths = [1440, 1280, 375];

test("site public : bibliothèque, actualités, contact, confidentialité", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(300_000);
  const capture = testInfo.project.name === "desktop";
  const problems = watch(page);
  const prefix = `E2E-P3pub-${Date.now()}-${testInfo.project.name}`;
  // Même calcul que `test-user.ts create-content`.
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  testUser("create-content", prefix);

  try {
    // --- Bibliothèque : catalogue, recherche, fiche ---
    // Les listes publiques sont en cache (revérifié chaque minute) : le livre créé y apparaît
    // sur un serveur qui vient de démarrer ; sa fiche, jamais encore servie, est toujours à jour.
    await page.goto("/library");
    await expect(h1(page)).toHaveText("Sur l’étagère du club.");
    const books = page.getByRole("main").locator('a[href^="/library/"]');
    await expect(books.first()).toBeVisible();
    if (capture) await shot(page, "library", publicWidths);
    const search = page.locator("#q");
    await search.fill("zzzz-introuvable");
    await search.press("Enter");
    await expect(page.getByText("Rien sur cette étagère")).toBeVisible();
    await page.goto("/library");
    await books.first().click();
    await expect(page).toHaveURL(/\/library\/[a-z0-9-]+$/);
    await expect(h1(page)).toBeVisible();
    await page.goto(`/library/${slug}-livre`);
    await expect(h1(page)).toHaveText(`${prefix} Livre`);
    if (capture) await shot(page, "library-fiche", publicWidths);
    await page.goto("/library/livre-qui-n-existe-pas");
    await expect(
      page.getByRole("link", { name: /bibliothèque|catalogue|accueil/i }).first(),
    ).toBeVisible();

    // --- Actualités : liste, article ---
    await page.goto("/news");
    await expect(h1(page)).toHaveText("À lire entre deux rencontres.");
    const articles = page.getByRole("main").locator('a[href^="/news/"]');
    await expect(articles.first()).toBeVisible();
    if (capture) await shot(page, "news", publicWidths);
    await articles.first().click();
    await expect(page).toHaveURL(/\/news\/[a-z0-9-]+$/);
    await expect(h1(page)).toBeVisible();
    if (capture) await shot(page, "news-article", publicWidths);
    await page.goto(`/news/${slug}-article`);
    await expect(h1(page)).toHaveText(`${prefix} Article`);

    // --- Contact : le message part vraiment par e-mail ---
    const subject = `E2E contact ${Date.now()}-${testInfo.project.name}`;
    await page.goto("/contact");
    await expect(h1(page)).toHaveText("Écrivez-nous.");
    if (capture) await shot(page, "contact", publicWidths);
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByText("Message envoyé.")).toHaveCount(0);
    await page.getByLabel("Votre nom").fill("Awa Essai");
    await page.getByLabel("Adresse e-mail").fill("awa.essai@e2e.agora.test");
    await page.getByLabel("Objet").fill(subject);
    await page.getByLabel("Votre message").fill("Bonjour, à quelle heure commence la rencontre ?");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByText(/Message envoyé\./)).toBeVisible();
    await expect(async () => {
      const found = await request.get(`${mailpit}/api/v1/search`, {
        params: { query: `subject:"${subject}"`, limit: "1" },
      });
      const { messages } = (await found.json()) as { messages: unknown[] };
      expect(messages.length).toBe(1);
    }).toPass({ timeout: 30_000 });

    // --- Confidentialité ---
    await page.goto("/privacy");
    await expect(h1(page)).toHaveText("Vos données, en clair.");
    if (capture) await shot(page, "privacy", [375, 1440]);

    expect(problems, "erreurs relevées pendant le parcours").toEqual([]);
  } finally {
    testUser("delete-content", prefix);
  }
});

test("administration : livres, articles, paramètres, équipe, journal", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(480_000);
  page.setDefaultTimeout(45_000);
  const stamp = Date.now();
  const adminEmail = `phase3-${stamp}@e2e.agora.test`;
  const staffEmail = `equipe-${stamp}@e2e.agora.test`;
  const bookTitle = `E2E-P3 Livre ${stamp}`;
  const articleTitle = `E2E-P3 Article ${stamp}`;
  const problems = watch(page);

  try {
    await signInAsAdmin(page, request, adminEmail);

    // --- Livres : création avec couverture, fiche publique, archivage ---
    await page.goto("/admin/books");
    await expect(h1(page)).toHaveText("Livres");
    await shot(page, "admin-books", adminWidths);
    await page.getByRole("button", { name: "Nouveau livre" }).click();
    await page.getByLabel("Titre", { exact: true }).fill(bookTitle);
    await page.getByLabel("Auteur(s)").fill(`E2E-P3 Auteur ${stamp}`);
    await page.getByLabel("Résumé").fill("Un résumé de test, rédigé pour le club et jamais copié.");
    await page.locator("#covers-file").setInputFiles("public/logos/icone-192.png");
    // L'aperçu est la couverture du site (cadre 2:3) ; une image carrée y est recadrée.
    await expect(page.locator('img[alt^="Couverture de « E2E-P3"][src*="covers"]')).toBeVisible();
    await page.getByLabel("Visible sur le site public").check();
    await shot(page, "admin-books-fiche", [1440]);
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await page.getByLabel("Rechercher dans : Livres").fill(bookTitle);
    await expect(page.getByRole("button", { name: new RegExp(bookTitle) }).first()).toBeVisible();
    await page.goto(`/library?q=${encodeURIComponent(bookTitle)}`);
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(bookTitle) })
      .first()
      .click();
    await expect(h1(page)).toHaveText(bookTitle);

    await page.goto("/admin/books/categories");
    await expect(h1(page)).toHaveText("Catégories et auteurs");
    await expect(page.getByRole("button", { name: `E2E-P3 Auteur ${stamp}` })).toBeVisible();
    await shot(page, "admin-books-categories", [1440]);
    await page.goto("/admin/books/monthly");
    await expect(h1(page)).toHaveText("Livre du mois");
    await shot(page, "admin-books-monthly", [1440]);

    // --- Articles : brouillon, publication, lecture en ligne, dépublication ---
    await page.goto("/admin/articles");
    await expect(h1(page)).toHaveText("Articles");
    await shot(page, "admin-articles", adminWidths);
    await page.getByRole("link", { name: "Nouvel article" }).click();
    await expect(page).toHaveURL(/\/admin\/articles\/new$/);
    await page.locator("#art-title").fill(articleTitle);
    await page.locator("#art-category").fill("Compte rendu");
    await page
      .getByLabel("Chapô")
      .fill("Deux phrases pour dire de quoi parle cet article de test.");
    await page
      .getByLabel("Texte", { exact: true })
      .fill("## Un intertitre\n\nUn paragraphe avec du **gras**.\n\n- un point\n- un autre");
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/articles\/(?!new$)[a-z0-9]+$/);
    await shot(page, "admin-article-editeur", adminWidths);
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Article publié : il est en ligne.")).toBeVisible();
    const online = await page.getByRole("link", { name: "Voir en ligne" }).getAttribute("href");
    const editorUrl = page.url();
    await page.goto(online!);
    await expect(h1(page)).toHaveText(articleTitle);
    await expect(page.getByRole("heading", { name: "Un intertitre" })).toBeVisible();
    await page.goto("/news");
    await expect(page.getByRole("link", { name: new RegExp(articleTitle) }).first()).toBeVisible();
    await page.goto(editorUrl);
    await page.getByRole("button", { name: "Dépublier" }).click();
    await expect(page.getByText("Article repassé en brouillon.")).toBeVisible();
    await page.goto("/news");
    await expect(page.getByRole("link", { name: new RegExp(articleTitle) })).toHaveCount(0);

    // --- Paramètres : sans changement, puis un réglage modifié et remis ---
    await page.goto("/admin/settings");
    await expect(h1(page)).toHaveText("Paramètres du club");
    await shot(page, "admin-settings", adminWidths);
    const save = page.getByRole("button", { name: "Enregistrer les paramètres" });
    await save.click();
    await expect(page.getByText("Aucun changement.")).toBeVisible();
    const deadline = page.getByLabel(/Délai d’annulation d’une inscription/);
    const before = await deadline.inputValue();
    await deadline.fill("36");
    await save.click();
    await expect(page.getByText("Paramètres enregistrés. Le site est à jour.")).toBeVisible();
    await page.reload();
    await expect(deadline).toHaveValue("36");
    await deadline.fill(before);
    await save.click();
    await expect(page.getByText("Paramètres enregistrés. Le site est à jour.")).toBeVisible();

    // --- Charte : chaque enregistrement confirme et crée une version, puis le texte est remis.
    // (Le numéro de version de la base de développement avance donc de deux à chaque passage.)
    await page.goto("/admin/charter");
    const charter = page.getByLabel(/Texte de la charte/);
    await expect(charter).toHaveValue(/\S/);
    const original = await charter.inputValue();
    const label = await page.locator('label[for="charte-content"]').innerText();
    const version = Number(/version (\d+)/.exec(label)?.[1]);
    await charter.fill(`${original}\n\n- Ligne de test.`);
    await page.getByRole("button", { name: "Enregistrer la charte" }).click();
    await expect(
      page.getByText(`Charte enregistrée (version ${version + 1}).`, { exact: false }),
    ).toBeVisible();
    await charter.fill(original);
    await page.getByRole("button", { name: "Enregistrer la charte" }).click();
    await expect(
      page.getByText(`Charte enregistrée (version ${version + 2}).`, { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(charter).toHaveValue(original);

    // --- Équipe : un responsable créé reçoit son lien, ses rôles se modifient ---
    await page.goto("/admin/team");
    await expect(h1(page)).toHaveText("Équipe et rôles");
    await shot(page, "admin-team", adminWidths);
    await page.getByRole("button", { name: "Nouveau responsable" }).click();
    await page.getByLabel("Prénom").fill("Ibou");
    await page.getByLabel("Nom", { exact: true }).fill(`Essai${stamp}`);
    await page.getByLabel("Adresse e-mail").fill(staffEmail);
    await page
      .getByRole("group", { name: "Rôles" })
      .getByLabel(/Responsable communication/)
      .check();
    await page.getByRole("button", { name: "Créer le compte" }).click();
    await expect(
      page.getByText("Compte créé. Le lien d’activation est parti par e-mail."),
    ).toBeVisible();
    await page.getByLabel("Rechercher dans : Équipe").fill(`Essai${stamp}`);
    await page
      .getByRole("button", { name: new RegExp(`Essai${stamp}`) })
      .first()
      .click();
    await page
      .getByRole("dialog")
      .getByLabel(/Responsable bibliothèque/)
      .check();
    await page.getByRole("button", { name: "Enregistrer les rôles" }).click();
    await expect(
      page.getByText("Rôles mis à jour. Le changement est consigné au journal."),
    ).toBeVisible();

    // --- Journal : les gestes ci-dessus y figurent ---
    await page.goto("/admin/audit");
    await expect(h1(page)).toHaveText("Journal");
    await expect(page.getByRole("main")).toContainText(/Rôle/);
    await expect(page.getByRole("main")).toContainText(`Essai${stamp}`);
    await shot(page, "admin-audit", adminWidths);

    expect(problems, "erreurs relevées pendant le parcours").toEqual([]);
  } finally {
    testUser("delete-content", "E2E-P3");
    testUser("delete", staffEmail);
    testUser("delete", adminEmail);
  }
});

// Visite de toutes les pages dans un vrai navigateur (Edge), mobile et desktop.
// Usage : node scripts/visite.mjs [dossier]     (serveur lancé ; BASE_URL=http://localhost:3000 par défaut)
// ONLY="admin$|library-fiche" ne visite que les pages dont le nom correspond.
// Prérequis : docker compose up -d (PostgreSQL + Mailpit), migrations et seed appliqués.
// Pour chaque page : statut HTTP, adresse finale, titre h1, erreurs de console et d'exécution,
// réponses 4xx/5xx, débordement horizontal, capture pleine page. Un compte super-administrateur
// de test (@e2e.agora.test) est créé, activé par le lien reçu dans Mailpit, puis supprimé.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
const out = process.argv[2] ?? "docs/captures/visite";
const email = `visite-${Date.now()}@e2e.agora.test`;
const password = `phrase-de-visite-${Math.floor(Math.random() * 1e6)}`;

const testUser = (...args) =>
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    stdio: "pipe",
    shell: true,
  });

const sql = (query) =>
  execFileSync(
    "docker",
    [
      "exec",
      "agora-excellence-postgres-1",
      "psql",
      "-U",
      "agora",
      "-d",
      "agora",
      "-t",
      "-A",
      "-c",
      query,
    ],
    { encoding: "utf8" },
  ).trim();

const viewports = {
  mobile: { width: 375, height: 812, isMobile: true, hasTouch: true },
  desktop: { width: 1440, height: 900 },
};

async function activationLink() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}" subject:"Activez votre compte"`)}&limit=1`,
    ).then((r) => r.json());
    if (search.messages?.length) {
      const message = await fetch(`${mailpit}/api/v1/message/${search.messages[0].ID}`).then((r) =>
        r.json(),
      );
      const link = message.Text.split(/\s+/).find((word) => word.includes("/activate?token="));
      if (link) {
        const url = new URL(link);
        return url.pathname + url.search;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("E-mail d’activation introuvable dans Mailpit");
}

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const results = [];

const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;

async function visit(context, path, label, viewportName) {
  if (only && !only.test(label)) return;
  const page = await context.newPage();
  const consoleErrors = [];
  const badResponses = [];
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 300)));
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${String(e).slice(0, 300)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) badResponses.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  const entry = { page: label, path, viewport: viewportName };
  try {
    const response = await page.goto(base + path, { waitUntil: "networkidle", timeout: 180_000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    entry.status = response?.status();
    entry.finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    entry.h1 = (
      (await page
        .locator("h1")
        .first()
        .textContent({ timeout: 5000 })
        .catch(() => null)) ?? ""
    )
      .replace(/\s+/g, " ")
      .trim();
    entry.overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    entry.skeletons = await page.locator(".skeleton:visible").count();
    await page.screenshot({ path: `${out}/${label}-${viewportName}.png`, fullPage: true });
  } catch (error) {
    entry.error = String(error).slice(0, 300);
  }
  entry.consoleErrors = consoleErrors;
  entry.badResponses = badResponses;
  results.push(entry);
  const flags = [
    entry.error && "ÉCHEC",
    entry.overflow > 0 && `débordement ${entry.overflow}px`,
    consoleErrors.length && `${consoleErrors.length} erreur(s) console`,
    badResponses.length && `réponses ${badResponses.join(", ")}`,
    entry.skeletons > 0 && `${entry.skeletons} squelette(s) restés`,
    entry.finalPath !== path && `→ ${entry.finalPath}`,
  ].filter(Boolean);
  console.log(
    `${String(entry.status ?? "---").padEnd(4)}${viewportName.padEnd(8)}${path.padEnd(46)}« ${entry.h1 ?? ""} »${flags.length ? `  !! ${flags.join(" ; ")}` : ""}`,
  );
  await page.close();
}

try {
  // --- Adresses à visiter (les fiches sont prises dans la base) ---
  const book = sql(
    `select slug from "Book" where "isPublished" and "archivedAt" is null order by title limit 1`,
  );
  const event = sql(
    `select slug from "Event" where status = 'PUBLISHED' and "archivedAt" is null order by "startsAt" limit 1`,
  );
  const article = sql(
    `select slug from "Article" where status = 'PUBLISHED' and "archivedAt" is null and "publishedAt" <= now() order by "publishedAt" desc limit 1`,
  );
  const eventId = sql(
    `select id from "Event" where "archivedAt" is null order by "startsAt" limit 1`,
  );
  const articleId = sql(`select id from "Article" order by "updatedAt" desc limit 1`);

  const publicPages = [
    ["/", "accueil"],
    ["/about", "about"],
    ["/activities", "activities"],
    ["/library", "library"],
    ["/library?q=ba", "library-recherche"],
    ["/library?q=zzzz", "library-vide"],
    book && [`/library/${book}`, "library-fiche"],
    ["/library/adresse-inconnue", "library-inconnue"],
    ["/events", "events"],
    event && [`/events/${event}`, "events-fiche"],
    ["/events/adresse-inconnue", "events-inconnue"],
    ["/events/registration", "events-registration-sans-jeton"],
    ["/archives", "archives"],
    ["/news", "news"],
    article && [`/news/${article}`, "news-article"],
    ["/membership", "membership"],
    ["/charte", "charte"],
    ["/contact", "contact"],
    ["/privacy", "privacy"],
    ["/login", "login"],
    ["/forgot-password", "forgot-password"],
    ["/reset-password", "reset-password"],
    ["/activate?token=jeton-invalide-0123456789", "activate-invalide"],
    ["/access-denied", "access-denied"],
    ["/page-qui-n-existe-pas", "404"],
    ["/member", "member-sans-session"],
    ["/admin", "admin-sans-session"],
  ].filter(Boolean);

  const privatePages = [
    ["/member", "member"],
    ["/admin", "admin"],
    ["/admin/memberships", "admin-memberships"],
    ["/admin/members", "admin-members"],
    ["/admin/payments", "admin-payments"],
    ["/admin/books", "admin-books"],
    ["/admin/books/categories", "admin-categories"],
    ["/admin/books/monthly", "admin-monthly"],
    ["/admin/events", "admin-events"],
    ["/admin/events/new", "admin-events-new"],
    eventId && [`/admin/events/${eventId}`, "admin-events-fiche"],
    ["/admin/articles", "admin-articles"],
    ["/admin/articles/new", "admin-articles-new"],
    articleId && [`/admin/articles/${articleId}`, "admin-articles-fiche"],
    ["/admin/committee", "admin-committee"],
    ["/admin/charter", "admin-charter"],
    ["/admin/qr", "admin-qr"],
    ["/admin/settings", "admin-settings"],
    ["/admin/team", "admin-team"],
    ["/admin/audit", "admin-audit"],
  ].filter(Boolean);

  // --- Site public, sans session : mobile d'abord ---
  for (const name of ["mobile", "desktop"]) {
    const context = await browser.newContext({
      ...viewports[name],
      viewport: viewports[name],
      locale: "fr-FR",
      reducedMotion: "reduce",
    });
    for (const [path, label] of publicPages) await visit(context, path, label, name);
    await context.close();
  }

  // --- Compte super-administrateur de test ---
  testUser("create", email, "Visite", "super_admin");
  const login = await browser.newContext({ locale: "fr-FR" });
  const page = await login.newPage();
  await page.goto(base + (await activationLink()), { timeout: 180_000 });
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await page.waitForURL(/\/login\?notice=activated$/, { timeout: 180_000 });
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/admin$/, { timeout: 180_000 });
  const storageState = await login.storageState();
  await login.close();

  // --- Espaces connectés : desktop d'abord pour l'administration ---
  for (const name of ["desktop", "mobile"]) {
    const context = await browser.newContext({
      ...viewports[name],
      viewport: viewports[name],
      locale: "fr-FR",
      reducedMotion: "reduce",
      storageState,
    });
    for (const [path, label] of privatePages) await visit(context, path, label, name);
    await context.close();
  }
} finally {
  await browser.close();
  try {
    testUser("delete", email);
  } catch {
    console.log(`Compte de test non supprimé : ${email}`);
  }
  await writeFile(`${out}/visite.json`, JSON.stringify(results, null, 2));
}

const problems = results.filter(
  (r) =>
    r.error || r.overflow > 0 || r.consoleErrors.length || r.badResponses.length || r.skeletons > 0,
);
console.log(
  `\n${results.length} visites, ${problems.length} avec un point à regarder. Détail : ${out}/visite.json`,
);

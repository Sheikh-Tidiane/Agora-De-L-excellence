import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Parcours complet sur la pile de production (site + PostgreSQL + Caddy en HTTPS), en boîte noire :
 * aucun accès direct à la base. Le super-administrateur est créé comme en production
 * (`create-admin` dans le conteneur d'outils), les e-mails sont lus dans Mailpit.
 *
 * Vérifie : adhésion → accusé de réception → validation par l'admin → e-mail d'activation (lien
 * en https:// sur le domaine) → activation → connexion → photo de profil (téléversée, privée,
 * conservée après redémarrage du conteneur) → photo du comité (publique) → pages de l'admin.
 */
const domain = process.env.PROD_DOMAIN ?? "agora.test";
const mailpit = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";
const compose = (...args: string[]) =>
  execFileSync("bash", ["scripts/prod-compose.sh", ...args], {
    encoding: "utf8",
    env: {
      ...process.env,
      ENV_FILE: process.env.ENV_FILE ?? ".env.essai-local",
      COMPOSE_EXTRA: process.env.COMPOSE_EXTRA ?? "docker-compose.prod-local.yml",
    },
    input: "",
    stdio: ["pipe", "pipe", "pipe"],
  });

const stamp = Date.now();
const admin = {
  email: `admin-${stamp}@essai.agora.test`,
  password: `phrase-admin-${randomBytes(6).toString("hex")}`,
};
const member = {
  lastName: `Essai${stamp}`,
  email: `membre-${stamp}@essai.agora.test`,
  password: `phrase-membre-${randomBytes(6).toString("hex")}`,
};

async function email(request: APIRequestContext, to: string, subject: string) {
  let found: { Text: string; Subject: string } | undefined;
  await expect(async () => {
    const search = await request.get(`${mailpit}/api/v1/search`, {
      params: { query: `to:"${to}" subject:"${subject}"`, limit: "1" },
    });
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    expect(messages.length, `e-mail « ${subject} » pour ${to}`).toBeGreaterThan(0);
    found = await (await request.get(`${mailpit}/api/v1/message/${messages[0]!.ID}`)).json();
  }).toPass({ timeout: 60_000, intervals: [1000, 2000] });
  return found!;
}

function linkIn(text: string, path: string) {
  const link = text.split(/\s+/).find((word) => word.includes(`${path}?token=`));
  expect(link, `lien ${path} dans l’e-mail`).toBeTruthy();
  // Les liens envoyés pointent vers le domaine public, en HTTPS.
  expect(new URL(link!).origin).toBe(`https://${domain}`);
  return link!;
}

async function signIn(page: Page, who: { email: string; password: string }, landing: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill(who.email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(landing);
}

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  // Comme en production : saisie au clavier remplacée par une entrée redirigée.
  const out = execFileSync(
    "bash",
    ["scripts/prod-compose.sh", "run", "--rm", "-T", "tools", "pnpm", "--silent", "create-admin"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ENV_FILE: process.env.ENV_FILE ?? ".env.essai-local",
        COMPOSE_EXTRA: process.env.COMPOSE_EXTRA ?? "docker-compose.prod-local.yml",
      },
      input: `Aïssatou\nEssai\n${admin.email}\n${admin.password}\n${admin.password}\n`,
    },
  );
  expect(out).toContain("Super-administrateur créé");
});

test("adhésion, validation, activation, connexion et photo de profil", async ({
  page,
  request,
  browser,
}) => {
  // 1. Un visiteur demande son adhésion.
  await page.goto("/membership");
  await page.getByLabel("Prénom").fill("Moussa");
  await page.getByLabel("Nom", { exact: true }).fill(member.lastName);
  await page.getByLabel("Adresse e-mail").fill(member.email);
  await page.getByLabel("Tranche d’âge").selectOption("FROM_18_TO_25");
  await page.getByLabel("Situation").selectOption("STUDENT");
  await page.getByLabel("Génies du soir").check();
  await page.getByLabel(/J’accepte que le club utilise/).check();
  await page.getByLabel(/J’accepte la charte du club/).check();
  await page.getByRole("button", { name: "Envoyer ma demande" }).click();
  await expect(page.getByText("Demande envoyée")).toBeVisible();
  await email(request, member.email, "Votre demande d’adhésion est bien arrivée");

  // 2. L'administrateur se connecte et valide la demande.
  const adminContext = await browser.newContext({
    baseURL: `https://${domain}`,
    ignoreHTTPSErrors: true,
  });
  const adminPage = await adminContext.newPage();
  await signIn(adminPage, admin, /\/admin$/);
  await adminPage.goto("/admin/memberships");
  await adminPage.getByLabel("Rechercher dans : Demandes d’adhésion").fill(member.lastName);
  await adminPage
    .getByRole("button", { name: new RegExp(member.lastName) })
    .first()
    .click();
  await adminPage.getByRole("button", { name: "Valider l’adhésion" }).click();
  await expect(
    adminPage.getByText("Demande validée. Le lien d’activation est parti par e-mail."),
  ).toBeVisible();
  await adminContext.close();

  // 3. Le membre active son compte par le lien reçu, puis se connecte.
  const activation = await email(request, member.email, "Activez votre compte");
  await page.goto(linkIn(activation.Text, "/activate"));
  await page.getByLabel("Mot de passe", { exact: true }).fill(member.password);
  await page.getByLabel("Encore une fois").fill(member.password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/login\?notice=activated$/);
  await signIn(page, member, /\/member$/);

  // Le cookie de session est réservé à HTTPS et inaccessible aux scripts.
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name.includes("session_token"));
  expect(session, "cookie de session").toBeTruthy();
  expect(session!.secure).toBe(true);
  expect(session!.httpOnly).toBe(true);

  // 4. Photo de profil : téléversée, servie à la personne connectée seulement.
  await page.goto("/member/profile");
  // Attendre l'hydratation : avant, le champ de fichier n'a pas encore son gestionnaire.
  await page.waitForLoadState("networkidle");
  await page.locator("#photo-profil").setInputFiles("public/logos/icone-192.png");
  await expect(page.getByText("Photo enregistrée.")).toBeVisible();
  const photo = page
    .locator('img[src^="/api/member/photo/avatars/"]')
    .filter({ visible: true })
    .first();
  await expect(photo).toBeVisible();
  const src = (await photo.getAttribute("src"))!;
  expect((await page.request.get(src)).status()).toBe(200);
  expect((await page.request.get(src.replace("/api/member/photo/", "/uploads/"))).status()).toBe(
    404,
  );
  expect((await request.get(src, { headers: { cookie: "" } })).status()).toBe(401);

  // 5. La photo est sur le volume persistant : elle survit à la recréation du conteneur du site.
  compose("up", "-d", "--force-recreate", "--wait", "app");
  await expect(async () => {
    const res = await page.request.get(src);
    expect(res.status()).toBe(200);
    expect((await res.body()).equals(readFileSync("public/logos/icone-192.png"))).toBe(true);
  }).toPass({ timeout: 60_000 });
  // … et la session aussi (sessions en base, secret inchangé).
  await page.goto("/member/profile");
  await expect(page).toHaveURL(/\/member\/profile$/);
});

test("administration : photo du comité et pages principales", async ({ page }) => {
  await signIn(page, admin, /\/admin$/);

  // Photo du comité : publique, par /uploads.
  const name = `Essai-Comite ${stamp}`;
  await page.goto("/admin/committee");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Ajouter un membre" }).click();
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.locator("#committee-file").setInputFiles("public/logos/icone-192.png");
  await expect(page.getByRole("img", { name: "Image téléversée" })).toBeVisible();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByText("Comité enregistré. La page « Le club » est à jour.")).toBeVisible();
  await page.goto("/about");
  const portrait = page.getByRole("listitem").filter({ hasText: name }).locator("img");
  await portrait.scrollIntoViewIfNeeded();
  await expect
    .poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  expect(await portrait.getAttribute("src")).toMatch(/\/uploads\/committee\/|_next\/image/);

  // Retrait de la fiche d'essai.
  await page.goto("/admin/committee");
  const listed = page.getByRole("listitem").filter({ hasText: name });
  await listed.getByRole("button", { name: "Retirer" }).click();
  await listed.getByRole("button", { name: "Confirmer le retrait" }).click();
  await expect(page.getByText(`${name} ne figure plus dans le comité.`)).toBeVisible();

  // Chaque page de l'administration s'affiche sans erreur.
  const pages = [
    "/admin",
    "/admin/memberships",
    "/admin/members",
    "/admin/payments",
    "/admin/events",
    "/admin/books",
    "/admin/books/categories",
    "/admin/books/monthly",
    "/admin/articles",
    "/admin/readings",
    "/admin/points",
    "/admin/quizzes",
    "/admin/scrabble",
    "/admin/scrabble/records",
    "/admin/committee",
    "/admin/charter",
    "/admin/team",
    "/admin/settings",
    "/admin/audit",
    "/admin/qr",
    "/admin/scan",
  ];
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of pages) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.getByRole("heading", { level: 1 }).first(), path).toBeVisible();
    await expect(page.getByText("Un contretemps."), path).toHaveCount(0);
    await expect(page, path).not.toHaveURL(/access-denied|login/);
  }
  expect(errors).toEqual([]);
});

test("site public : pages principales, robots et plan du site sur le domaine", async ({
  page,
  request,
}) => {
  for (const path of [
    "/",
    "/about",
    "/library",
    "/events",
    "/news",
    "/scrabble",
    "/charte",
    "/membership",
    "/contact",
    "/privacy",
    "/archives",
    "/activities",
  ]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.getByText("Un contretemps."), path).toHaveCount(0);
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(`https://${domain}/`);
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`https://${domain}/sitemap.xml`);
});

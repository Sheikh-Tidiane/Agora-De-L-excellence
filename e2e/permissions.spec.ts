import { randomInt } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type APIRequestContext } from "@playwright/test";
import { permissionsForRoles, type RoleCode } from "../src/lib/permissions/catalog";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Phase 6 : matrice des permissions. Chaque profil (visiteur, membre, chaque rôle de responsable)
 * ouvre chaque zone protégée ; le serveur doit ouvrir, refuser (« Accès refusé ») ou demander
 * la connexion, selon la permission que la page exige (lue dans son code) et le catalogue des rôles.
 * Les pages qui n'existent que pour un objet précis (fiche d'un tournoi…) sont ouvertes par leur
 * variante « new » quand elle existe ; les autres sont couvertes par src/features/page-access.test.ts.
 */
test.use({ extraHTTPHeaders: randomClient() });

type Zone = { url: string; permission: string };

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return name === "page.tsx" ? [path] : [];
  });
}

/** Adresse concrète d'une page, ou null si elle exige un objet existant. */
function urlOf(file: string): string | null {
  const route = file
    .replace(/\\/g, "/")
    .replace(/^src\/app/, "")
    .replace(/\/page\.tsx$/, "");
  const concrete = route.replace(/\[id\]/, "new");
  return /\[/.test(concrete) ? null : concrete || "/";
}

const zones: Zone[] = ["src/app/admin", "src/app/member"]
  .flatMap((dir) =>
    pageFiles(dir).flatMap((file) => {
      const url = urlOf(file);
      const permission = /requirePageAccess\(\s*"([a-z._]+)"/.exec(readFileSync(file, "utf8"))?.[1];
      if (!url || !permission) return [];
      return [{ url, permission }];
    }),
  )
  .filter((zone, index, all) => all.findIndex((other) => other.url === zone.url) === index);

const profiles: (RoleCode | "visitor")[] = [
  "visitor",
  "member",
  "communication",
  "library",
  "scrabble",
  "admin",
  "super_admin",
];

async function signedInPage(
  browser: Browser,
  request: APIRequestContext,
  role: RoleCode,
  email: string,
) {
  const context = await browser.newContext({ extraHTTPHeaders: randomClient() });
  const page = await context.newPage();
  const password = `matrice-${randomInt(1e9)}`;
  testUser("create", email, "Profil", role);
  if (role === "member") testUser("member-number", email);
  await page.goto(
    await linkFromEmail(request, { to: email, subject: "Activez votre compte", path: "/activate" }),
  );
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/(member|admin)$/);
  return { context, page };
}

test("chaque profil n'ouvre que les zones de ses permissions", async ({
  browser,
  request,
  isMobile,
}) => {
  test.skip(isMobile, "Le contrôle d'accès ne dépend pas de l'écran.");
  test.setTimeout(45 * 60_000);
  expect(zones.length).toBeGreaterThan(30);
  const tag = randomInt(1e9);
  const emails: string[] = [];
  const failures: string[] = [];

  try {
    for (const profile of profiles) {
      const email = `matrice-${profile}-${tag}@e2e.agora.test`;
      const session =
        profile === "visitor"
          ? await (async () => {
              const context = await browser.newContext({ extraHTTPHeaders: randomClient() });
              return { context, page: await context.newPage() };
            })()
          : (emails.push(email), await signedInPage(browser, request, profile, email));
      const granted = profile === "visitor" ? new Set() : permissionsForRoles([profile]);

      for (const zone of zones) {
        // Un refus rendu en flux redirige côté client : la navigation de départ est alors
        // interrompue (ERR_ABORTED). Seule compte l'adresse finale, une fois la page stable.
        await session.page.goto(zone.url).catch((error: Error) => {
          if (!/ERR_ABORTED|interrupted/.test(error.message)) throw error;
        });
        const layout = zone.url.startsWith("/admin") ? "admin.access" : "member.access";
        const expected =
          profile === "visitor"
            ? "/login"
            : granted.has(zone.permission as never) && granted.has(layout as never)
              ? zone.url
              : "/access-denied";
        if (expected === zone.url) {
          // Ouverte : la page doit rester en place (aucune redirection tardive).
          await session.page.waitForTimeout(1500);
        } else {
          await session.page
            .waitForURL((url) => url.pathname === expected, { timeout: 15_000 })
            .catch(() => undefined);
        }
        const path = new URL(session.page.url()).pathname;
        if (path !== expected) {
          failures.push(`${profile} → ${zone.url} : attendu ${expected}, obtenu ${path}`);
        }
      }
      await session.context.close();
    }
  } finally {
    for (const email of emails) testUser("delete", email);
  }

  expect(failures, failures.join("\n")).toEqual([]);
});

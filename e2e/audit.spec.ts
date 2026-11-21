import { randomInt } from "node:crypto";
import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Phase 6, audit : aucune erreur de console ni exception sur les pages du site, de l'espace membre
 * et de l'administration (dont celles des phases 4 et 5) ; navigation au clavier (lien
 * d'évitement, focus visible) ; aucune animation qui dure quand le système demande moins de
 * mouvement.
 */
test.use({ extraHTTPHeaders: randomClient() });

const publicPages = [
  "/",
  "/about",
  "/activities",
  "/library",
  "/events",
  "/news",
  "/archives",
  "/scrabble",
  "/scrabble/tournoi-de-scrabble-mars",
  "/membership",
  "/charte",
  "/contact",
  "/privacy",
  "/login",
];
const memberPages = [
  "/member",
  "/member/readings",
  "/member/events",
  "/member/scrabble",
  "/member/quiz",
  "/member/rewards",
  "/member/notifications",
  "/member/assistant",
  "/member/profile",
  "/member/card",
];
const adminPages = [
  "/admin",
  "/admin/memberships",
  "/admin/members",
  "/admin/payments",
  "/admin/points",
  "/admin/scan",
  "/admin/books",
  "/admin/readings",
  "/admin/events",
  "/admin/articles",
  "/admin/quizzes",
  "/admin/quizzes/new",
  "/admin/scrabble",
  "/admin/scrabble/records",
  "/admin/settings",
  "/admin/audit",
];

function watch(page: Page) {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`${page.url()} · exception : ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`${page.url()} · console : ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) problems.push(`${response.url()} · HTTP ${response.status()}`);
  });
  return problems;
}

async function signIn(page: Page, request: APIRequestContext, email: string, role: string) {
  const password = `audit-${randomInt(1e9)}`;
  testUser("create", email, "Audit", role);
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
}

async function visit(page: Page, paths: string[]) {
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }
}

test("console sans erreur sur le site, l'espace membre et l'administration", async ({
  browser,
  request,
}) => {
  test.setTimeout(15 * 60_000);
  const tag = randomInt(1e9);
  const member = `audit-membre-${tag}@e2e.agora.test`;
  const staff = `audit-admin-${tag}@e2e.agora.test`;
  const problems: string[] = [];
  const contexts = [];
  try {
    const visitorContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
    contexts.push(visitorContext);
    const visitor = await visitorContext.newPage();
    problems.push(...watch(visitor));
    await visit(visitor, publicPages);

    const memberContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
    contexts.push(memberContext);
    const memberPage = await memberContext.newPage();
    const memberProblems = watch(memberPage);
    await signIn(memberPage, request, member, "member");
    await visit(memberPage, memberPages);

    const staffContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
    contexts.push(staffContext);
    const staffPage = await staffContext.newPage();
    const staffProblems = watch(staffPage);
    await signIn(staffPage, request, staff, "super_admin");
    await visit(staffPage, adminPages);

    problems.push(...memberProblems, ...staffProblems);
  } finally {
    for (const context of contexts) await context.close();
    testUser("delete", member);
    testUser("delete", staff);
  }
  expect(problems, problems.join("\n")).toEqual([]);
});

test("clavier : le premier Tab mène au lien d'évitement, le focus se voit", async ({ page }) => {
  for (const path of ["/", "/library", "/scrabble"]) {
    await page.goto(path);
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    await expect(focused).toHaveText(/Aller au contenu/);
    await expect(focused).toBeVisible();
    // Le focus doit se voir : contour ou anneau, jamais rien.
    const visible = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(visible, `${path} : focus invisible`).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/" : path}#contenu$`));
  }
});

test("moins de mouvement : aucune animation ne dure", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const path of ["/", "/activities", "/scrabble"]) {
    await page.goto(path);
    const longest = await page.evaluate(() =>
      Math.max(
        0,
        ...[...document.querySelectorAll("*")].flatMap((element) => {
          const style = getComputedStyle(element);
          return [style.animationDuration, style.transitionDuration].flatMap((value) =>
            value
              .split(",")
              .map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000)),
          );
        }),
      ),
    );
    expect(longest, `${path} : animation de ${longest} ms`).toBeLessThanOrEqual(1);
  }
  await context.close();
});

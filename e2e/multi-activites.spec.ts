import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Rencontre à plusieurs activités : une rencontre lecture + quiz (Génies du soir) créée dans
 * l'administration paraît sous ses deux activités (page Activités, filtres de l'agenda), sa fiche
 * les affiche toutes, et la présence d'un membre rapporte les points de chacune. Puis, avec le
 * réglage « activité principale seulement », une présence décochée et recochée ne rapporte plus que
 * la lecture.
 *
 * Le barème du club n'a pas de règle « Génies du soir » : le parcours en crée une d'essai
 * (10 points, e2e/support/test-user.ts), retirée à la fin. Lecture : 20 points (barème du club).
 */
test.use({ extraHTTPHeaders: randomClient() });

async function signInAsMember(page: Page, request: APIRequestContext, email: string) {
  const password = `phrase-de-membre-${randomInt(1e6)}`;
  testUser("create", email, "Awa", "member");
  testUser("member-number", email);
  await page.goto(
    await linkFromEmail(request, { to: email, subject: "Activez votre compte", path: "/activate" }),
  );
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/login\?notice=activated$/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/member$/);
}

/** Total affiché sur la page « Mes récompenses » du membre. */
async function memberTotal(page: Page): Promise<number> {
  await page.goto("/member/rewards");
  const text = await page
    .getByText(/au total$/)
    .locator("xpath=..")
    .innerText();
  return Number(text.replace(/\D+/g, " ").trim().split(" ")[0]);
}

test("rencontre lecture + quiz : sous les deux activités, points de chacune", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const stamp = Date.now();
  const title = `E2E-LectureQuiz ${stamp}`;
  const adminEmail = `multi-admin-${stamp}@e2e.agora.test`;
  const memberEmail = `multi-membre-${stamp}@e2e.agora.test`;
  const memberContext = await browser.newContext({ extraHTTPHeaders: randomClient() });
  const memberPage = await memberContext.newPage();
  testUser("create-genies-rule", "E2E");
  // Le réglage du club est mémorisé, puis remis tel quel à la fin : le parcours part du défaut.
  const savedMode = execFileSync(
    "pnpm",
    ["exec", "tsx", "e2e/support/test-user.ts", "get-attendance-mode", "E2E"],
    { encoding: "utf8", shell: true },
  )
    .trim()
    .split(/\s+/)
    .pop()!;
  testUser("set-attendance-mode", "E2E", "ALL_ACTIVITIES");
  try {
    // --- Administration : une rencontre aujourd'hui (le pointage ouvre le jour même) ---
    await signInAsAdmin(page, request, adminEmail);
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(title);
    const lecture = page.getByRole("checkbox", { name: "Rendez-vous lecture" });
    const quiz = page.getByRole("checkbox", { name: "Génies du soir" });
    await expect(lecture).toBeChecked();
    await quiz.check();
    // L'activité principale ne propose que les activités cochées.
    const primary = page.getByLabel("Activité principale");
    await expect(primary.locator("option")).toHaveText(["Rendez-vous lecture", "Génies du soir"]);
    await expect(primary).toHaveValue("RENDEZ_VOUS_LECTURE");
    // Décocher la principale la reporte sur l'activité restante ; on revient ensuite à la lecture.
    await lecture.uncheck();
    await expect(primary).toHaveValue("GENIES_DU_SOIR");
    await lecture.check();
    await primary.selectOption("RENDEZ_VOUS_LECTURE");
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel("Début").fill(`${today}T23:59`);
    await page
      .getByLabel("Présentation")
      .fill("Lecture d’un chapitre, puis quiz de culture générale sur le livre.");
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    const adminUrl = page.url();
    await expect(page.getByRole("checkbox", { name: "Génies du soir" })).toBeChecked();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Événement publié : il est visible sur le site.")).toBeVisible();
    const publicPath = await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href");

    // La liste de l'administration montre les deux activités et la trouve par chacune.
    await page.goto("/admin/events");
    await page.getByLabel("Rechercher dans : Événements").fill(title);
    await expect(page.getByText("Rendez-vous lecture, Génies du soir")).toBeVisible();

    // --- Site public : la fiche affiche les deux activités ---
    await page.goto(publicPath!);
    const header = page.locator("header").filter({ has: page.getByRole("heading", { level: 1 }) });
    await expect(header.getByText("Rendez-vous lecture", { exact: true })).toBeVisible();
    await expect(header.getByText("Génies du soir", { exact: true })).toBeVisible();
    const jsonLd = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent())!,
    ) as { "@type": string; keywords: string };
    expect(jsonLd["@type"]).toBe("Event");
    expect(jsonLd.keywords).toBe("Rendez-vous lecture, Génies du soir");

    // Page Activités : sous les deux activités, pas sous une troisième.
    await page.goto("/activities");
    for (const [slug, expected] of [
      ["rendez-vous-lecture", 1],
      ["genies-du-soir", 1],
      ["agora-cine", 0],
    ] as const) {
      await expect(page.locator(`section#${slug}`).getByText(title), slug).toHaveCount(expected);
    }

    // Agenda filtré par activité.
    for (const [slug, expected] of [
      ["rendez-vous-lecture", 1],
      ["genies-du-soir", 1],
      ["debats-d-idees", 0],
    ] as const) {
      await page.goto(`/events?activite=${slug}`);
      await expect(page.getByRole("link", { name: "Toutes les activités" })).toBeVisible();
      await expect(page.getByRole("article").filter({ hasText: title }), slug).toHaveCount(
        expected,
      );
    }

    // --- Un membre s'inscrit ; le responsable pointe sa présence ---
    await signInAsMember(memberPage, request, memberEmail);
    await memberPage.goto(publicPath!);
    await memberPage.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(memberPage.getByText(/Vous êtes inscrit/).first()).toBeVisible();

    await page.goto(adminUrl);
    const registrants = page.getByRole("region", { name: "Inscrits" }).getByRole("table");
    await registrants.getByLabel("Présent").check();
    await expect(registrants.getByLabel("Présent")).toBeChecked();
    // Points de chaque activité : lecture 20 + Génies du soir 10.
    await expect.poll(() => memberTotal(memberPage)).toBe(30);
    await expect(memberPage.getByText("Participer à une séance de lecture")).toBeVisible();
    await expect(memberPage.getByText("E2E Participer aux Génies du soir")).toBeVisible();

    // --- Réglage « activité principale seulement » : décocher puis recocher la présence ---
    await page.goto("/admin/points");
    await page.getByRole("radio", { name: /L’activité principale seulement/ }).check();
    await page
      .getByRole("group", { name: "Présence à une rencontre à plusieurs activités" })
      .getByRole("button", { name: "Enregistrer" })
      .click();
    await expect(page.getByText("Règle enregistrée.")).toBeVisible();
    await page.goto(adminUrl);
    const present = page
      .getByRole("region", { name: "Inscrits" })
      .getByRole("table")
      .getByLabel("Présent");
    await present.uncheck();
    await expect(present).not.toBeChecked();
    await expect.poll(() => memberTotal(memberPage)).toBe(0);
    await page.goto(adminUrl);
    await page
      .getByRole("region", { name: "Inscrits" })
      .getByRole("table")
      .getByLabel("Présent")
      .check();
    // Seule l'activité principale (la lecture) paie désormais.
    await expect.poll(() => memberTotal(memberPage)).toBe(20);
  } finally {
    await memberContext.close();
    testUser("delete-events", "E2E-LectureQuiz");
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
    testUser("delete-genies-rule", "E2E");
    testUser("set-attendance-mode", "E2E", savedMode);
  }
});

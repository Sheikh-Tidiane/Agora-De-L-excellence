import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Phase 4, partie C : un tournoi saisi, validé et publié paraît au palmarès et prévient le joueur ;
 * un quiz créé, publié puis joué sur téléphone rapporte des points et classe le membre.
 */
test.use({ extraHTTPHeaders: randomClient() });

/** Champ `datetime-local` à l'heure de Dakar (UTC). */
const local = (offsetMinutes: number) =>
  new Date(Date.now() + offsetMinutes * 60_000).toISOString().slice(0, 16);

async function signInAsMember(
  page: Page,
  request: APIRequestContext,
  email: string,
  firstName: string,
) {
  const password = `phrase-de-jeu-${randomInt(1e6)}`;
  testUser("create", email, firstName, "member");
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

test("tournoi saisi, validé, publié : palmarès, classement et notification", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.skip(isMobile, "L’administration d’un tournoi se fait sur ordinateur.");
  test.setTimeout(300_000);
  const tag = randomInt(1e9);
  const name = `E2E-Tournoi ${tag}`;
  const firstName = `Khady${tag}`;
  const member = `joueur-${tag}@e2e.agora.test`;
  const staff = `scrabble-${tag}@e2e.agora.test`;
  const adminContext = await browser.newContext({
    extraHTTPHeaders: randomClient(),
    viewport: { width: 1440, height: 900 },
  });
  const admin = await adminContext.newPage();
  admin.on("dialog", (dialog) => void dialog.accept());

  try {
    await signInAsMember(page, request, member, firstName);
    await signInAsAdmin(admin, request, staff, "scrabble");

    // Création en brouillon.
    await admin.goto("/admin/scrabble");
    await admin.getByRole("link", { name: "Nouveau tournoi" }).click();
    await admin.getByLabel("Nom du tournoi").fill(name);
    await admin.getByLabel("Début").fill(local(-60));
    await admin.getByRole("button", { name: "Créer le tournoi" }).click();
    await expect(admin).toHaveURL(/\/admin\/scrabble\/[a-z0-9]+$/);
    await expect(admin.getByRole("heading", { level: 1, name })).toBeVisible();

    // Trois joueurs : le membre et deux participants extérieurs.
    await admin.getByRole("button", { name: "Inscrire un joueur" }).click();
    await admin.getByLabel("Rechercher un membre").fill(firstName);
    await admin.getByRole("button", { name: "Inscrire", exact: true }).click();
    const roster = admin.getByRole("region", { name: /^Joueurs/ });
    await expect(roster.getByText(`${firstName} Essai`)).toBeVisible();
    await admin.getByRole("radio", { name: "Participant extérieur" }).click();
    for (const [player, club] of [
      ["E2E Awa Ext", "Club de Thiès"],
      ["E2E Ibou Ext", ""],
    ]) {
      await admin.getByRole("textbox", { name: "Nom", exact: true }).fill(player!);
      await admin.getByRole("textbox", { name: "Club (facultatif)" }).fill(club!);
      await admin.getByRole("button", { name: "Inscrire", exact: true }).click();
      await expect(roster.getByText(player!, { exact: true })).toBeVisible();
    }

    // Lancement, une manche, saisie des scores (duplicate).
    await admin.getByRole("button", { name: "Lancer le tournoi" }).click();
    await expect(admin.getByText("En cours", { exact: true }).first()).toBeVisible();
    await admin.getByRole("button", { name: "Nouvelle manche" }).click();
    await admin.getByRole("link", { name: "Scores" }).click();
    await expect(admin.getByRole("heading", { level: 1, name: "Manche 1" })).toBeVisible();
    await admin.getByRole("textbox", { name: `${firstName} Essai` }).fill("512");
    await admin.getByRole("textbox", { name: /^E2E Awa Ext/ }).fill("430");
    await admin.getByRole("textbox", { name: /^E2E Ibou Ext/ }).fill("388");
    await admin.getByRole("button", { name: "Enregistrer 3 scores" }).click();
    await expect(admin.getByText("3 scores enregistrés.")).toBeVisible();
    await admin.getByRole("link", { name: "Retour au tournoi" }).click();

    // Rien n'est public avant la publication.
    await expect(admin.getByRole("heading", { name: "Classement provisoire" })).toBeVisible();
    await admin.getByRole("button", { name: "Marquer comme terminé" }).click();
    await admin.getByRole("button", { name: "Valider les résultats" }).click();
    await expect(admin.getByText("Résultats validés.")).toBeVisible();
    await admin.getByRole("button", { name: "Publier les résultats" }).click();
    await expect(admin.getByText(/Résultats publiés, 1 joueur prévenu/)).toBeVisible();

    // Site public : palmarès et classement final.
    const shownName = `${firstName} E.`;
    await page.goto("/scrabble");
    const palmares = page.getByRole("region", { name: "Palmarès" });
    await expect(palmares.getByText(shownName)).toBeVisible();
    await palmares.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name: "Classement final" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Rang 1" }).first()).toBeVisible();
    await expect(page.getByText("E2E Awa Ext")).toBeVisible();

    // Le joueur : notification, historique, classement du mois.
    await page.goto("/member/notifications");
    await expect(page.getByText(`Résultats publiés : ${name}`)).toBeVisible();
    await expect(page.getByText("Vous terminez à la 1re place sur 3.")).toBeVisible();
    await page.goto("/member/scrabble");
    await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByText("1er", { exact: true })).toBeVisible();
  } finally {
    await adminContext.close();
    testUser("delete-tournaments", "E2E-Tournoi");
    testUser("delete", member);
    testUser("delete", staff);
  }
});

test("quiz créé, publié, joué sur téléphone : score, points et classement", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.skip(
    !isMobile,
    "Le quiz se joue sur téléphone ; l’administration est jouée dans le même parcours.",
  );
  test.setTimeout(300_000);
  const tag = randomInt(1e9);
  const title = `E2E-Quiz ${tag}`;
  const firstName = `Coumba${tag}`;
  const member = `quiz-${tag}@e2e.agora.test`;
  const staff = `communication-${tag}@e2e.agora.test`;
  const adminContext = await browser.newContext({
    extraHTTPHeaders: randomClient(),
    viewport: { width: 1440, height: 900 },
  });
  const admin = await adminContext.newPage();
  admin.on("dialog", (dialog) => void dialog.accept());

  try {
    await signInAsMember(page, request, member, firstName);
    await signInAsAdmin(admin, request, staff, "communication");

    await admin.goto("/admin/quizzes");
    await admin.getByRole("link", { name: "Nouveau quiz" }).click();
    await admin.getByLabel("Titre").fill(title);
    await admin.getByLabel("Durée (minutes)").fill("5");
    await admin.getByLabel("Ouverture").fill(local(-10));
    await admin.getByLabel("Fermeture").fill(local(24 * 60));
    await admin.getByRole("button", { name: "Créer le quiz" }).click();
    await expect(admin).toHaveURL(/\/admin\/quizzes\/[a-z0-9]+$/);

    const questions = [
      {
        prompt: "Qui a écrit « Une si longue lettre » ?",
        good: "Mariama Bâ",
        bad: ["Ken Bugul", "Aminata Sow Fall"],
      },
      {
        prompt: "Combien de tuiles compte un jeu de Scrabble français ?",
        good: "102",
        bad: ["100", "98"],
      },
    ];
    for (const question of questions) {
      const form = admin.getByRole("region", { name: "Nouvelle question" });
      await form.getByRole("textbox", { name: "Énoncé" }).fill(question.prompt);
      const choices = [question.good, ...question.bad];
      for (const [index, label] of choices.entries()) {
        await form
          .getByRole("textbox", { name: `Proposition ${index + 1}`, exact: true })
          .fill(label);
      }
      await form.getByRole("button", { name: "Ajouter la question" }).click();
      await expect(admin.getByText(question.prompt, { exact: true })).toBeVisible();
    }
    await admin.getByRole("button", { name: "Publier" }).click();
    await expect(admin.getByText(/Quiz publié/)).toBeVisible();

    // Le membre est prévenu, puis joue sur son téléphone.
    await page.goto("/member/notifications");
    await page.getByRole("link", { name: new RegExp(`Nouveau quiz : ${title}`) }).click();
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await page.getByRole("button", { name: /Commencer · 5 min/ }).click();

    await expect(page.getByText("Question 1 sur 2")).toBeVisible();
    await expect(page.getByText(/Temps restant/)).toBeAttached();
    await page.getByText(questions[0]!.good, { exact: true }).click();
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(page.getByText("Question 2 sur 2")).toBeVisible();
    // Une mauvaise réponse : le score est compté par le serveur.
    await page.getByText(questions[1]!.bad[0]!, { exact: true }).click();
    await page.getByRole("button", { name: "Valider et terminer" }).click();

    const score = page.getByRole("region", { name: "Votre score" });
    await expect(score.getByText("1/2")).toBeVisible();
    // Le corrigé attend la clôture.
    await expect(page.getByText(/Le corrigé s’ouvrira à la clôture/)).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Classement du quiz" }).getByText(`${firstName} E.`),
    ).toBeVisible();

    // Points du quiz dans Mes récompenses.
    await page.goto("/member/rewards");
    await expect(page.getByText(`Terminer un quiz en ligne · ${title}`)).toBeVisible();

    // Recharger ne permet pas de rejouer.
    await page.goBack();
    await page.goto(`/member/quiz`);
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await expect(page.getByText("Voir mon résultat")).toBeVisible();
  } finally {
    await adminContext.close();
    testUser("delete-quizzes", "E2E-Quiz");
    testUser("delete", member);
    testUser("delete", staff);
  }
});

import * as quizzes from "@/features/quizzes/actions";
import type { ActionResult } from "@/lib/errors";
import type { PermissionCode } from "@/lib/permissions/catalog";

/**
 * Cas des Server Actions des quiz, ajoutés à la matrice de `security-cases.ts`
 * (fichier séparé : plusieurs domaines y écrivent en parallèle).
 */
type Case = {
  key: string;
  run: (input: unknown) => Promise<ActionResult<unknown>>;
  allow: readonly PermissionCode[] | "session";
  valid: Record<string, unknown>;
  invalid: Record<string, unknown>;
};

const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
const file = "src/features/quizzes/actions.ts";

function quizCase<I>(
  name: keyof typeof quizzes,
  allow: Case["allow"],
  valid: Record<string, unknown>,
  invalid: Record<string, unknown>,
): Case {
  const run = quizzes[name] as unknown as (input: I) => Promise<ActionResult<unknown>>;
  return { key: `${file}#${name}`, run: (input) => run(input as I), allow, valid, invalid };
}

const badIds = (field: string, base: object = {}) => ({
  [`${field} vide`]: { ...base, [field]: "" },
  [`${field} : objet`]: { ...base, [field]: { not: "" } },
  [`${field} trop long`]: { ...base, [field]: "x".repeat(41) },
  [`${field} manquant`]: { ...base, [field]: undefined },
});

const settings = {
  title: "Échauffement de décembre",
  instructions: "",
  durationMinutes: 10,
  opensAt: "2027-01-10T16:00",
  closesAt: "2027-01-20T16:00",
  eventId: "",
  slug: "",
};
const settingsInvalid = {
  "titre vide": { ...settings, title: "" },
  "durée 0": { ...settings, durationMinutes: 0 },
  "durée 181": { ...settings, durationMinutes: 181 },
  "durée décimale": { ...settings, durationMinutes: 2.5 },
  "fermeture avant l'ouverture": { ...settings, closesAt: "2027-01-01T16:00" },
  "date illisible": { ...settings, opensAt: "demain" },
  "adresse forgée": { ...settings, slug: "../admin" },
};
const choices = [
  { label: "Mariama Bâ", isCorrect: true },
  { label: "Ken Bugul", isCorrect: false },
];
const question = { prompt: "Qui a écrit « Une si longue lettre » ?", choices };
const questionInvalid = (base: object) => ({
  "une seule proposition": { ...base, ...question, choices: [choices[0]] },
  "sept propositions": {
    ...base,
    ...question,
    choices: Array.from({ length: 7 }, (_, i) => ({ label: `P${i}`, isCorrect: i === 0 })),
  },
  "deux bonnes réponses": {
    ...base,
    ...question,
    choices: choices.map((c) => ({ ...c, isCorrect: true })),
  },
  "aucune bonne réponse": {
    ...base,
    ...question,
    choices: choices.map((c) => ({ ...c, isCorrect: false })),
  },
  "propositions identiques": {
    ...base,
    ...question,
    choices: [choices[0], { label: "mariama bâ", isCorrect: false }],
  },
  "énoncé vide": { ...base, ...question, prompt: "" },
  "bonne réponse : chaîne": {
    ...base,
    ...question,
    choices: [{ label: "A", isCorrect: "true" }, choices[1]],
  },
});

const manage: PermissionCode[] = ["quizzes.manage"];
const member: PermissionCode[] = ["member.access"];

export const quizCases: Case[] = [
  quizCase("createQuizAction", manage, settings, settingsInvalid),
  quizCase(
    "updateQuizAction",
    manage,
    { ...settings, quizId: ID },
    {
      ...settingsInvalid,
      "quizId : objet": { ...settings, quizId: { not: "" } },
    },
  ),
  quizCase("deleteQuizAction", manage, { quizId: ID }, badIds("quizId")),
  quizCase("publishQuizAction", manage, { quizId: ID }, badIds("quizId")),
  quizCase("unpublishQuizAction", manage, { quizId: ID }, badIds("quizId")),
  quizCase("closeQuizAction", manage, { quizId: ID }, badIds("quizId")),
  quizCase("archiveQuizAction", manage, { quizId: ID }, badIds("quizId")),
  quizCase(
    "addQuestionAction",
    manage,
    { quizId: ID, ...question },
    {
      ...badIds("quizId", question),
      ...questionInvalid({ quizId: ID }),
    },
  ),
  quizCase(
    "updateQuestionAction",
    manage,
    { questionId: ID, ...question },
    {
      ...badIds("questionId", question),
      ...questionInvalid({ questionId: ID }),
    },
  ),
  quizCase("deleteQuestionAction", manage, { questionId: ID }, badIds("questionId")),
  quizCase(
    "reorderQuestionsAction",
    manage,
    { quizId: ID, questionIds: [ID] },
    {
      ...badIds("quizId", { questionIds: [ID] }),
      "liste vide": { quizId: ID, questionIds: [] },
      "liste : chaîne": { quizId: ID, questionIds: ID },
    },
  ),
  quizCase("startQuizAction", member, { quizId: ID }, badIds("quizId")),
  quizCase(
    "answerQuestionAction",
    member,
    { attemptId: ID, questionId: ID, choiceId: ID },
    {
      ...badIds("attemptId", { questionId: ID, choiceId: ID }),
      ...badIds("questionId", { attemptId: ID, choiceId: ID }),
      "choix manquant (passer = null explicite)": { attemptId: ID, questionId: ID },
      "choix : tableau": { attemptId: ID, questionId: ID, choiceId: [ID] },
      "isCorrect forgé ignoré mais choix invalide": { attemptId: ID, questionId: ID, choiceId: "" },
    },
  ),
  quizCase("finishQuizAction", member, { attemptId: ID }, badIds("attemptId")),
];

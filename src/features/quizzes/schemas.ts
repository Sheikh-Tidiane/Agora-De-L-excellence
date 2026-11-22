import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";

/** Schémas partagés entre les formulaires (client) et les Server Actions (serveur). */

export const QUIZ_LIMITS = {
  minDuration: 1,
  maxDuration: 180,
  minChoices: 2,
  maxChoices: 6,
  maxQuestions: 50,
} as const;

const id = z.string().min(1).max(40);

const dateTime = (message: string) =>
  z
    .string({ error: message })
    .transform((value) => parseLocalDateTime(value))
    .refine((value): value is Date => value !== null, { message });

/** Réglages d'un quiz. `quizId` absent : création. Dates au format `datetime-local` (heure de Dakar). */
export const quizSettingsSchema = z
  .object({
    quizId: id.optional(),
    title: z
      .string()
      .trim()
      .min(3, "Donnez un titre au quiz.")
      .max(120, "Pas plus de 120 caractères."),
    instructions: z
      .string()
      .trim()
      .max(1000, "Pas plus de 1 000 caractères.")
      .transform((value) => (value === "" ? null : value)),
    durationMinutes: z.coerce
      .number({ error: "Indiquez une durée en minutes." })
      .int("Une durée en minutes entières.")
      .min(QUIZ_LIMITS.minDuration, "Au moins 1 minute.")
      .max(QUIZ_LIMITS.maxDuration, "Pas plus de 180 minutes."),
    opensAt: dateTime("Indiquez la date et l’heure d’ouverture."),
    closesAt: dateTime("Indiquez la date et l’heure de fermeture."),
    /** Rencontre « Génies du soir » liée ; vide : aucune. */
    eventId: z
      .union([id, z.literal("")])
      .optional()
      .transform((value) => value || null),
    /** Vide : tiré du titre. */
    slug: z
      .string()
      .trim()
      .max(80, "Pas plus de 80 caractères.")
      .refine((value) => value === "" || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: "Minuscules, chiffres et tirets seulement.",
      })
      .optional()
      .transform((value) => value || null),
  })
  .refine((value) => value.closesAt > value.opensAt, {
    path: ["closesAt"],
    message: "La fermeture doit être après l’ouverture.",
  });
export type QuizSettingsInput = z.input<typeof quizSettingsSchema>;
export type QuizSettingsData = z.output<typeof quizSettingsSchema>;

const choiceSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Écrivez la proposition.")
    .max(160, "Pas plus de 160 caractères."),
  isCorrect: z.boolean(),
});

const questionBody = {
  prompt: z.string().trim().min(3, "Écrivez l’énoncé.").max(300, "Pas plus de 300 caractères."),
  choices: z
    .array(choiceSchema)
    .min(QUIZ_LIMITS.minChoices, "Au moins 2 propositions.")
    .max(QUIZ_LIMITS.maxChoices, "Pas plus de 6 propositions."),
};

const oneCorrect = (value: { choices: { isCorrect: boolean }[] }) =>
  value.choices.filter((choice) => choice.isCorrect).length === 1;
const distinct = (value: { choices: { label: string }[] }) =>
  new Set(value.choices.map((c) => c.label.trim().toLocaleLowerCase("fr-FR"))).size ===
  value.choices.length;

export const addQuestionSchema = z
  .object({ quizId: id, ...questionBody })
  .refine(oneCorrect, { path: ["choices"], message: "Cochez exactement une bonne réponse." })
  .refine(distinct, { path: ["choices"], message: "Deux propositions sont identiques." });
export type AddQuestionInput = z.input<typeof addQuestionSchema>;

export const updateQuestionSchema = z
  .object({ questionId: id, ...questionBody })
  .refine(oneCorrect, { path: ["choices"], message: "Cochez exactement une bonne réponse." })
  .refine(distinct, { path: ["choices"], message: "Deux propositions sont identiques." });
export type UpdateQuestionInput = z.input<typeof updateQuestionSchema>;

export const questionIdSchema = z.object({ questionId: id });

export const reorderQuestionsSchema = z.object({
  quizId: id,
  questionIds: z.array(id).min(1).max(QUIZ_LIMITS.maxQuestions),
});
export type ReorderQuestionsInput = z.input<typeof reorderQuestionsSchema>;

export const quizIdSchema = z.object({ quizId: id });
export const attemptIdSchema = z.object({ attemptId: id });

/** Réponse à la question courante. `choiceId: null` : question passée. */
export const answerSchema = z.object({
  attemptId: id,
  questionId: id,
  choiceId: id.nullable(),
});
export type AnswerInput = z.input<typeof answerSchema>;

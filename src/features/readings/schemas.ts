import { z } from "zod";

/** Schémas partagés entre les formulaires (client) et les Server Actions (serveur). */

const id = z.string().min(1).max(40);

export const readingStatuses = ["TO_READ", "READING", "FINISHED"] as const;
export type ReadingStatusCode = (typeof readingStatuses)[number];

export const readingStatusLabels: Record<ReadingStatusCode, string> = {
  TO_READ: "À lire",
  READING: "En cours",
  FINISHED: "Terminé",
};

export const addReadingSchema = z.object({
  bookId: id,
  status: z.enum(readingStatuses, { error: "Choisissez un statut." }),
});
export type AddReadingInput = z.input<typeof addReadingSchema>;

export const updateReadingSchema = z.object({
  readingId: id,
  status: z.enum(readingStatuses, { error: "Choisissez un statut." }),
  progress: z.coerce
    .number({ error: "Indiquez un pourcentage." })
    .int("Un nombre entier, de 0 à 100.")
    .min(0, "Un nombre entier, de 0 à 100.")
    .max(100, "Un nombre entier, de 0 à 100."),
  personalNote: z
    .string()
    .trim()
    .max(2000, "Pas plus de 2 000 caractères.")
    .transform((value) => (value === "" ? null : value)),
  isFavorite: z.boolean(),
});
export type UpdateReadingInput = z.input<typeof updateReadingSchema>;

export const readingIdSchema = z.object({ readingId: id });

export const reviewSchema = z.object({
  bookId: id,
  rating: z.coerce
    .number({ error: "Choisissez une note." })
    .int("Choisissez une note de 1 à 5.")
    .min(1, "Choisissez une note de 1 à 5.")
    .max(5, "Choisissez une note de 1 à 5."),
  content: z
    .string()
    .trim()
    .min(80, "Au moins 80 caractères : quelques phrases sur ce que le livre vous a apporté.")
    .max(4000, "Pas plus de 4 000 caractères."),
  publishWithFirstName: z.boolean(),
});
export type ReviewInput = z.input<typeof reviewSchema>;

/** Décision d'un responsable : valider, ou refuser avec un mot pour le membre. */
const decisionFields = {
  id,
  decision: z.enum(["approve", "reject"]),
  note: z
    .string()
    .trim()
    .max(500, "Pas plus de 500 caractères.")
    .transform((value) => (value === "" ? null : value)),
};
const noteWhenRejected = (value: { decision: "approve" | "reject"; note: string | null }) =>
  value.decision === "approve" || value.note !== null;
const noteMissing = { message: "Dites au membre pourquoi, en une phrase.", path: ["note"] };

export const decisionSchema = z.object(decisionFields).refine(noteWhenRejected, noteMissing);
export type DecisionInput = z.input<typeof decisionSchema>;

/**
 * Modération d'une critique : la décision porte sur la version lue par le modérateur
 * (`version` = date de dernière modification affichée). Une critique réécrite entre-temps
 * n'est pas approuvée à l'aveugle.
 */
export const reviewDecisionSchema = z
  .object({
    ...decisionFields,
    version: z.iso.datetime({ error: "Version de la critique inconnue." }),
  })
  .refine(noteWhenRejected, noteMissing);
export type ReviewDecisionInput = z.input<typeof reviewDecisionSchema>;

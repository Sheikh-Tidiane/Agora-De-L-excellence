import { z } from "zod";
import { COMMENT_MAX, REASON_MAX, REASON_MIN } from "@/features/feedback/rules";

const id = z.string().trim().min(1).max(40);

const rating = z
  .number({ error: "Choisissez une note de 1 à 5." })
  .int("Choisissez une note de 1 à 5.")
  .min(1, "Choisissez une note de 1 à 5.")
  .max(5, "Choisissez une note de 1 à 5.");

const comment = z
  .string({ error: "Commentaire invalide." })
  .trim()
  .max(COMMENT_MAX, `Pas plus de ${COMMENT_MAX} caractères.`)
  .transform((value) => (value === "" ? null : value));

/** Avis d'un membre présent : note obligatoire, commentaire facultatif. */
export const feedbackSchema = z.object({ eventId: id, rating, comment });
export type FeedbackInput = z.input<typeof feedbackSchema>;

/** Avis d'un invité présent, par le lien personnel de la demande d'avis. */
export const guestFeedbackSchema = z.object({
  token: z.string().min(16).max(200),
  rating,
  comment,
});
export type GuestFeedbackInput = z.input<typeof guestFeedbackSchema>;

/** Masquer un commentaire : motif obligatoire ; `version` empêche d'écraser un geste concurrent. */
export const hideFeedbackSchema = z.object({
  id,
  reason: z
    .string({ error: "Indiquez le motif." })
    .trim()
    .min(REASON_MIN, "Indiquez le motif.")
    .max(REASON_MAX, `Pas plus de ${REASON_MAX} caractères.`),
  version: z.iso.datetime({ error: "Version invalide." }),
});

export const restoreFeedbackSchema = z.object({
  id,
  version: z.iso.datetime({ error: "Version invalide." }),
});

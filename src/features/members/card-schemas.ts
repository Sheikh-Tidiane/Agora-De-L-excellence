import { z } from "zod";

/** Schémas des actions de la carte de membre (sans dépendance serveur : utilisables côté client). */

/** Le membre confirme explicitement : l'ancienne carte cessera d'être acceptée. */
export const regenerateCardSchema = z.object({
  confirm: z.literal(true, { error: "Confirmez le remplacement de la carte." }),
});

export const revokeCardSchema = z.object({
  userId: z.string().min(1).max(40),
  reason: z
    .string({ error: "Indiquez le motif." })
    .trim()
    .min(3, "Indiquez le motif.")
    .max(300, "Pas plus de 300 caractères."),
});
export type RevokeCardInput = z.input<typeof revokeCardSchema>;

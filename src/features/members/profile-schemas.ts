import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const phoneMessage = "Indiquez un numéro valide, par exemple 77 123 45 67.";

/**
 * Ce qu'un membre modifie lui-même. Le nom et l'adresse e-mail (identifiant de connexion)
 * restent tenus par le club : une correction passe par un responsable.
 * Même schéma pour le formulaire et la Server Action.
 */
export const ownProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .max(30, phoneMessage)
    .refine((value) => value === "" || normalizePhone(value) !== null, { message: phoneMessage })
    .transform((value) => (value === "" ? null : normalizePhone(value))),
  hiddenFromRankings: z.boolean(),
  /** Rappel par e-mail la veille des rencontres où il est inscrit. */
  eventReminders: z.boolean(),
  /** Accord pour publier photos, vidéos ou témoignage où il est reconnaissable. */
  mediaConsent: z.boolean(),
});
export type OwnProfileInput = z.input<typeof ownProfileSchema>;

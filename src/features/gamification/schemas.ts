import { z } from "zod";
import {
  ATTENDANCE_POINT_MODES,
  MAX_MANUAL_POINTS,
  MAX_RULE_POINTS,
} from "@/features/gamification/rules";

/**
 * Schémas Zod des actions d'administration des points. Sans dépendance serveur : partagés avec
 * les formulaires du navigateur et revérifiés par le serveur.
 */
const id = z.string().min(1).max(40);
const reason = z
  .string()
  .trim()
  .min(3, "Indiquez le motif.")
  .max(200, "Pas plus de 200 caractères.");

export const grantPointsSchema = z.object({
  userId: id,
  points: z
    .number("Indiquez un nombre de points.")
    .int("Un nombre entier.")
    .min(-MAX_MANUAL_POINTS, `Pas moins de −${MAX_MANUAL_POINTS}.`)
    .max(MAX_MANUAL_POINTS, `Pas plus de ${MAX_MANUAL_POINTS}.`)
    .refine((value) => value !== 0, "Un ajustement de zéro point ne change rien."),
  reason,
});

export const reverseTransactionSchema = z.object({ transactionId: id, reason });

export const manualBadgeSchema = z.object({
  userId: id,
  badgeCode: z.string().regex(/^[a-z0-9_]{1,60}$/, "Badge inconnu."),
  reason,
});

export const pointRuleSchema = z.object({
  id,
  points: z
    .number("Indiquez un nombre de points.")
    .int("Un nombre entier.")
    .min(0, "Pas de valeur négative.")
    .max(MAX_RULE_POINTS, `Pas plus de ${MAX_RULE_POINTS}.`),
  isActive: z.boolean(),
});

/** Réglage des points de présence (rencontres à plusieurs activités). */
export const attendancePointModeSchema = z.object({
  mode: z.enum(ATTENDANCE_POINT_MODES, { error: "Choisissez une règle." }),
});

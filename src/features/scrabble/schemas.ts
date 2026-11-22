import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";

/**
 * Schémas Zod du Scrabble. Sans dépendance serveur : partagés avec les formulaires du navigateur
 * et revérifiés par le serveur (Server Actions).
 */
export const MAX_SCORE = 2000;

const id = z.string().min(1).max(40);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Pas plus de ${max} caractères.`)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional()
    .transform((value) => value ?? null);
const reason = z
  .string()
  .trim()
  .min(3, "Indiquez le motif.")
  .max(200, "Pas plus de 200 caractères.");
/** Champ `datetime-local` (heure de Dakar) ou date seule (`AAAA-MM-JJ`, minuit). */
const isoDate = z
  .string({ error: "Date invalide." })
  .max(40)
  .transform((value) =>
    parseLocalDateTime(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00` : value),
  )
  .refine((value): value is Date => value !== null, { message: "Date invalide." });

export const TOURNAMENT_STATUSES = [
  "DRAFT",
  "REGISTRATION_OPEN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const tournamentSchema = z.object({
  name: z.string().trim().min(3, "Au moins 3 caractères.").max(120, "Pas plus de 120 caractères."),
  description: optionalText(2000),
  rules: optionalText(5000),
  format: z.enum(["INDIVIDUAL", "TEAMS"]),
  gameMode: z.enum(["DUPLICATE", "CLASSIC"]),
  rankingRule: z.enum(["WINS_SCORE_SPREAD", "CUMULATIVE_SCORE"]),
  isInterclub: z.boolean(),
  countsForMonthly: z.boolean(),
  location: optionalText(160),
  reward: optionalText(300),
  startsAt: isoDate,
  endsAt: isoDate
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  eventId: id
    .nullable()
    .optional()
    .transform((value) => value ?? null),
});
export type TournamentInput = z.input<typeof tournamentSchema>;
export type TournamentData = z.output<typeof tournamentSchema>;

export const updateTournamentSchema = tournamentSchema.extend({ id });
export const tournamentIdSchema = z.object({ tournamentId: id });
export const tournamentStatusSchema = z.object({
  tournamentId: id,
  status: z.enum(TOURNAMENT_STATUSES),
});

export const addParticipantSchema = z
  .object({
    tournamentId: id,
    userId: id
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    externalName: optionalText(80),
    externalClub: optionalText(80),
    teamId: id
      .nullable()
      .optional()
      .transform((value) => value ?? null),
  })
  .refine((value) => (value.userId === null) !== (value.externalName === null), {
    message: "Choisissez un membre, ou indiquez le nom d’un participant extérieur.",
    path: ["externalName"],
  })
  .refine((value) => value.userId === null || value.externalClub === null, {
    message: "Le club ne concerne qu’un participant extérieur.",
    path: ["externalClub"],
  });
export type AddParticipantInput = z.input<typeof addParticipantSchema>;

export const participantIdSchema = z.object({ participantId: id });
export const withdrawParticipantSchema = z.object({ participantId: id, withdrawn: z.boolean() });
export const assignTeamSchema = z.object({
  participantId: id,
  teamId: id.nullable(),
});

const teamName = z.string().trim().min(1, "Indiquez un nom.").max(60, "Pas plus de 60 caractères.");
export const createTeamSchema = z.object({ tournamentId: id, name: teamName });
export const renameTeamSchema = z.object({ teamId: id, name: teamName });
export const teamIdSchema = z.object({ teamId: id });

export const roundIdSchema = z.object({ roundId: id });
export const roundStatusSchema = z.object({
  roundId: id,
  status: z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]),
});

export const createMatchSchema = z
  .object({
    roundId: id,
    participantAId: id,
    participantBId: id,
    tableNumber: z
      .number()
      .int()
      .min(1)
      .max(500)
      .nullable()
      .optional()
      .transform((v) => v ?? null),
  })
  .refine((value) => value.participantAId !== value.participantBId, {
    message: "Une partie oppose deux joueurs différents.",
    path: ["participantBId"],
  });
export type CreateMatchInput = z.input<typeof createMatchSchema>;
export const matchIdSchema = z.object({ matchId: id });

/** Un score : entier de 0 à MAX_SCORE ; forfait → 0 ; `points: null` sans forfait → score effacé. */
export const scoreEntrySchema = z
  .object({
    participantId: id,
    points: z
      .number("Indiquez un score.")
      .int("Un nombre entier.")
      .min(0, "Pas de score négatif.")
      .max(MAX_SCORE, `Pas plus de ${MAX_SCORE}.`)
      .nullable(),
    isForfeit: z.boolean(),
  })
  .transform((value) => (value.isForfeit ? { ...value, points: 0 } : value));

export const saveScoresSchema = z.object({
  roundId: id,
  entries: z.array(scoreEntrySchema).min(1, "Aucun score à enregistrer.").max(200),
});
export type SaveScoresInput = z.input<typeof saveScoresSchema>;

export const invalidateResultsSchema = z.object({ tournamentId: id, reason });

export const recordSchema = z
  .object({
    category: z
      .string()
      .trim()
      .min(3, "Au moins 3 caractères.")
      .max(100, "Pas plus de 100 caractères."),
    value: z.string().trim().min(1, "Indiquez la valeur.").max(60, "Pas plus de 60 caractères."),
    userId: id
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    holderName: optionalText(80),
    tournamentId: id
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    achievedAt: isoDate
      .nullable()
      .optional()
      .transform((value) => value ?? null),
    position: z
      .number()
      .int()
      .min(0)
      .max(1000)
      .optional()
      .transform((value) => value ?? 0),
  })
  .refine((value) => (value.userId === null) !== (value.holderName === null), {
    message: "Choisissez un membre, ou indiquez le nom du détenteur.",
    path: ["holderName"],
  });
export type RecordInput = z.input<typeof recordSchema>;
export type RecordData = z.output<typeof recordSchema>;

export const updateRecordSchema = z.object({ id, record: recordSchema });
export const replaceRecordSchema = updateRecordSchema;
export const recordIdSchema = z.object({ id });

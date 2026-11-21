import { AppError } from "@/lib/errors";
import type { Db } from "@/lib/prisma";
import type { TournamentStatusCode } from "@/features/scrabble/rules";

/**
 * Verrous et contrôles communs aux services du Scrabble. Chaque geste qui dépend de l'état des
 * résultats (saisie, validation, publication) verrouille d'abord la ligne du tournoi : une
 * correction de score et une validation simultanées se suivent, elles ne se croisent pas.
 */
export type LockedTournament = {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatusCode;
  format: "INDIVIDUAL" | "TEAMS";
  gameMode: "DUPLICATE" | "CLASSIC";
  rankingRule: "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";
  eventId: string | null;
  resultsValidatedAt: Date | null;
  resultsPublishedAt: Date | null;
  archivedAt: Date | null;
};

export async function lockTournament(tx: Db, tournamentId: string): Promise<LockedTournament> {
  await tx.$queryRaw`SELECT id FROM "Tournament" WHERE id = ${tournamentId} FOR UPDATE`;
  const tournament = await tx.tournament.findUnique({
    where: { id: tournamentId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      format: true,
      gameMode: true,
      rankingRule: true,
      eventId: true,
      resultsValidatedAt: true,
      resultsPublishedAt: true,
      archivedAt: true,
    },
  });
  if (!tournament || tournament.archivedAt) throw new AppError("NOT_FOUND", "Tournoi introuvable.");
  return tournament;
}

/** Refuse tout changement qui toucherait des résultats validés : il faut d'abord les dévalider. */
export function assertNotValidated(tournament: LockedTournament): void {
  if (tournament.resultsValidatedAt) {
    throw new AppError(
      "CONFLICT",
      "Les résultats sont validés. Dévalidez-les (avec un motif) avant toute correction.",
    );
  }
}

export function assertStatus(
  tournament: LockedTournament,
  allowed: readonly TournamentStatusCode[],
  message: string,
): void {
  if (!allowed.includes(tournament.status)) throw new AppError("CONFLICT", message);
}

/** Tournoi d'un participant, d'une équipe, d'une manche ou d'une partie, verrouillé. */
export async function lockByParticipant(tx: Db, participantId: string) {
  const row = await tx.tournamentParticipant.findUnique({
    where: { id: participantId },
    select: { tournamentId: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Participant introuvable.");
  return lockTournament(tx, row.tournamentId);
}

export async function lockByTeam(tx: Db, teamId: string) {
  const row = await tx.team.findUnique({ where: { id: teamId }, select: { tournamentId: true } });
  if (!row) throw new AppError("NOT_FOUND", "Équipe introuvable.");
  return lockTournament(tx, row.tournamentId);
}

export async function lockByRound(tx: Db, roundId: string) {
  const row = await tx.round.findUnique({ where: { id: roundId }, select: { tournamentId: true } });
  if (!row) throw new AppError("NOT_FOUND", "Manche introuvable.");
  return lockTournament(tx, row.tournamentId);
}

export async function lockByMatch(tx: Db, matchId: string) {
  const row = await tx.match.findUnique({
    where: { id: matchId },
    select: { round: { select: { tournamentId: true } } },
  });
  if (!row) throw new AppError("NOT_FOUND", "Partie introuvable.");
  return lockTournament(tx, row.round.tournamentId);
}

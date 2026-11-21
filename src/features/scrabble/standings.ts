import type { Db } from "@/lib/prisma";
import { computeRanking, type RankingResult } from "@/features/scrabble/ranking";
import { adminPlayerName, expectedEntries, type PlayerIdentity } from "@/features/scrabble/rules";

/**
 * Lecture d'un tournoi complet (joueurs, manches, parties, scores) et calcul de son classement.
 * Partagé par la validation, la fiche d'administration et la fiche publique.
 */
export type LoadedParticipant = PlayerIdentity & {
  id: string;
  userId: string | null;
  teamId: string | null;
  finalRank: number | null;
  withdrawnAt: Date | null;
};

export type LoadedRound = {
  id: string;
  number: number;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED";
  matches: {
    id: string;
    tableNumber: number | null;
    participantAId: string;
    participantBId: string;
    status: "SCHEDULED" | "PLAYED" | "FORFEIT";
  }[];
  scores: {
    id: string;
    participantId: string;
    points: number;
    isForfeit: boolean;
    updatedAt: Date;
  }[];
};

export type TournamentSheet = {
  participants: LoadedParticipant[];
  teams: { id: string; name: string }[];
  rounds: LoadedRound[];
  ranking: RankingResult;
  /** État de saisie par manche (scores attendus, saisis, joueurs manquants). */
  entry: { roundId: string; expected: number; entered: number; missing: string[] }[];
  /** Total des scores manquants, toutes manches confondues. */
  missingScores: number;
};

export async function loadTournamentSheet(
  db: Db,
  tournament: {
    id: string;
    format: "INDIVIDUAL" | "TEAMS";
    gameMode: "DUPLICATE" | "CLASSIC";
    rankingRule: "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";
  },
): Promise<TournamentSheet> {
  // L'une après l'autre : la lecture peut tourner dans une transaction (une requête à la fois).
  const participants = await db.tournamentParticipant.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      teamId: true,
      finalRank: true,
      withdrawnAt: true,
      externalName: true,
      externalClub: true,
      user: { select: { firstName: true, lastName: true, hiddenFromRankings: true } },
    },
  });
  const teams = await db.team.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const rounds = await db.round.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      status: true,
      matches: {
        orderBy: [{ tableNumber: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
        select: {
          id: true,
          tableNumber: true,
          participantAId: true,
          participantBId: true,
          status: true,
        },
      },
      scores: {
        select: { id: true, participantId: true, points: true, isForfeit: true, updatedAt: true },
      },
    },
  });
  const classic = tournament.gameMode === "CLASSIC";
  const ranking = computeRanking(
    {
      rule: tournament.rankingRule,
      classic,
      participants: participants.map((p) => ({
        id: p.id,
        teamId: p.teamId,
        withdrawn: p.withdrawnAt !== null,
        sortKey: adminPlayerName(p),
      })),
      matches: rounds.flatMap((r) => r.matches.map((m) => ({ ...m, roundId: r.id }))),
      scores: rounds.flatMap((r) => r.scores.map((s) => ({ ...s, roundId: r.id }))),
    },
    { teams: tournament.format === "TEAMS" },
  );
  const active = participants.filter((p) => !p.withdrawnAt).map((p) => p.id);
  const entry = rounds.map((round) => ({
    roundId: round.id,
    ...expectedEntries({
      classic,
      activeParticipantIds: active,
      matches: round.matches,
      scoredParticipantIds: round.scores.map((s) => s.participantId),
    }),
  }));
  return {
    participants,
    teams,
    rounds,
    ranking,
    entry,
    missingScores: entry.reduce((sum, e) => sum + e.missing.length, 0),
  };
}

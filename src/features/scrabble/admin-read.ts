import { prisma, type Db } from "@/lib/prisma";
import { adminPlayerName, type TournamentStatusCode } from "@/features/scrabble/rules";
import { loadTournamentSheet, type LoadedRound } from "@/features/scrabble/standings";
import type { RankingResult } from "@/features/scrabble/ranking";

/**
 * Lectures de l'administration du Scrabble et de l'espace membre. La page appelante vérifie la
 * permission (`requirePageAccess`) ou la session avant d'appeler ces fonctions.
 */
export type AdminTournamentRow = {
  id: string;
  slug: string;
  name: string;
  status: TournamentStatusCode;
  format: "INDIVIDUAL" | "TEAMS";
  gameMode: "DUPLICATE" | "CLASSIC";
  startsAt: Date;
  participantCount: number;
  roundCount: number;
  resultsValidatedAt: Date | null;
  resultsPublishedAt: Date | null;
  isDemo: boolean;
};

export async function readAdminTournaments(db: Db = prisma): Promise<AdminTournamentRow[]> {
  const rows = await db.tournament.findMany({
    where: { archivedAt: null },
    orderBy: { startsAt: "desc" },
    take: 500,
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      format: true,
      gameMode: true,
      startsAt: true,
      resultsValidatedAt: true,
      resultsPublishedAt: true,
      isDemo: true,
      _count: { select: { participants: true, rounds: true } },
    },
  });
  return rows.map(({ _count, ...row }) => ({
    ...row,
    participantCount: _count.participants,
    roundCount: _count.rounds,
  }));
}

export type AdminParticipant = {
  id: string;
  userId: string | null;
  /** Nom complet (administration seulement). */
  name: string;
  memberNumber: string | null;
  externalClub: string | null;
  isExternal: boolean;
  teamId: string | null;
  withdrawn: boolean;
  finalRank: number | null;
};

export type AdminTournament = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rules: string | null;
  status: TournamentStatusCode;
  format: "INDIVIDUAL" | "TEAMS";
  gameMode: "DUPLICATE" | "CLASSIC";
  rankingRule: "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";
  isInterclub: boolean;
  countsForMonthly: boolean;
  location: string | null;
  reward: string | null;
  startsAt: Date;
  endsAt: Date | null;
  event: { id: string; slug: string; title: string } | null;
  resultsValidatedAt: Date | null;
  resultsValidatedBy: string | null;
  resultsPublishedAt: Date | null;
  isDemo: boolean;
  participants: AdminParticipant[];
  teams: { id: string; name: string }[];
  rounds: LoadedRound[];
  /** Classement calculé en direct sur les scores saisis (aperçu avant validation). */
  ranking: RankingResult;
  entry: { roundId: string; expected: number; entered: number; missing: string[] }[];
  missingScores: number;
  /** Prêt à valider : au moins une manche, aucun score manquant, pas encore validé. */
  canValidate: boolean;
};

export async function readAdminTournament(
  id: string,
  db: Db = prisma,
): Promise<AdminTournament | null> {
  const t = await db.tournament.findFirst({
    where: { id, archivedAt: null },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      rules: true,
      status: true,
      format: true,
      gameMode: true,
      rankingRule: true,
      isInterclub: true,
      countsForMonthly: true,
      location: true,
      reward: true,
      startsAt: true,
      endsAt: true,
      resultsValidatedAt: true,
      resultsPublishedAt: true,
      isDemo: true,
      event: { select: { id: true, slug: true, title: true } },
      resultsValidatedBy: { select: { firstName: true, lastName: true } },
    },
  });
  if (!t) return null;
  const sheet = await loadTournamentSheet(db, t);
  const numbers = await db.user.findMany({
    where: { id: { in: sheet.participants.flatMap((p) => (p.userId ? [p.userId] : [])) } },
    select: { id: true, memberNumber: true },
  });
  const numberOf = new Map(numbers.map((u) => [u.id, u.memberNumber]));
  return {
    ...t,
    resultsValidatedBy: t.resultsValidatedBy
      ? `${t.resultsValidatedBy.firstName} ${t.resultsValidatedBy.lastName}`
      : null,
    participants: sheet.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      name: adminPlayerName(p),
      memberNumber: p.userId ? (numberOf.get(p.userId) ?? null) : null,
      externalClub: p.externalClub,
      isExternal: p.userId === null,
      teamId: p.teamId,
      withdrawn: p.withdrawnAt !== null,
      finalRank: p.finalRank,
    })),
    teams: sheet.teams,
    rounds: sheet.rounds,
    ranking: sheet.ranking,
    entry: sheet.entry,
    missingScores: sheet.missingScores,
    canValidate:
      !t.resultsValidatedAt &&
      (t.status === "IN_PROGRESS" || t.status === "COMPLETED") &&
      sheet.rounds.length > 0 &&
      sheet.missingScores === 0,
  };
}

/** Membres actifs à inscrire (nom, prénom ou numéro), hors joueurs déjà inscrits. */
export async function searchMembersForTournament(
  tournamentId: string,
  q: string,
  db: Db = prisma,
): Promise<{ id: string; name: string; memberNumber: string }[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const rows = await db.user.findMany({
    where: {
      status: "ACTIVE",
      archivedAt: null,
      memberNumber: { not: null },
      tournamentEntries: { none: { tournamentId } },
      OR: [
        { firstName: { contains: term, mode: "insensitive" } },
        { lastName: { contains: term, mode: "insensitive" } },
        { memberNumber: { contains: term, mode: "insensitive" } },
      ],
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 20,
    select: { id: true, firstName: true, lastName: true, memberNumber: true },
  });
  return rows.map((u) => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    memberNumber: u.memberNumber!,
  }));
}

/** Rencontres de Scrabble qu'on peut lier à un tournoi (non archivées, sans autre tournoi). */
export async function readLinkableEvents(tournamentId: string | null, db: Db = prisma) {
  return db.event.findMany({
    where: {
      archivedAt: null,
      activities: { hasSome: ["TOURNOI_SCRABBLE", "INITIATION_SCRABBLE"] },
      OR: [
        { tournament: { is: null } },
        ...(tournamentId ? [{ tournament: { is: { id: tournamentId } } }] : []),
      ],
    },
    orderBy: { startsAt: "desc" },
    take: 100,
    select: { id: true, slug: true, title: true, startsAt: true, type: true },
  });
}

/** Tous les records, battus compris (administration). */
export async function readAdminRecords(db: Db = prisma) {
  const rows = await db.scrabbleRecord.findMany({
    orderBy: [
      { supersededAt: { sort: "desc", nulls: "first" } },
      { position: "asc" },
      { category: "asc" },
    ],
    select: {
      id: true,
      category: true,
      value: true,
      userId: true,
      holderName: true,
      tournamentId: true,
      achievedAt: true,
      supersededAt: true,
      position: true,
      isDemo: true,
      user: { select: { firstName: true, lastName: true } },
      tournament: { select: { name: true } },
    },
  });
  return rows.map(({ user, tournament, ...r }) => ({
    ...r,
    holder: user ? `${user.firstName} ${user.lastName}` : (r.holderName ?? ""),
    tournamentName: tournament?.name ?? null,
  }));
}

export type MemberTournamentEntry = {
  slug: string;
  name: string;
  status: TournamentStatusCode;
  startsAt: Date;
  format: "INDIVIDUAL" | "TEAMS";
  withdrawn: boolean;
  team: string | null;
  /** Rang figé, seulement si les résultats sont publiés. */
  finalRank: number | null;
  rankedCount: number | null;
  resultsPublished: boolean;
};

/** Historique d'un membre : ses tournois (hors brouillons et archivés), le plus récent d'abord. */
export async function readMemberTournamentHistory(
  userId: string,
  db: Db = prisma,
): Promise<MemberTournamentEntry[]> {
  const rows = await db.tournamentParticipant.findMany({
    where: { userId, tournament: { archivedAt: null, status: { not: "DRAFT" } } },
    orderBy: { tournament: { startsAt: "desc" } },
    select: {
      finalRank: true,
      withdrawnAt: true,
      team: { select: { name: true } },
      tournament: {
        select: {
          id: true,
          slug: true,
          name: true,
          status: true,
          startsAt: true,
          format: true,
          resultsPublishedAt: true,
          resultsValidatedAt: true,
        },
      },
    },
  });
  const entries: MemberTournamentEntry[] = [];
  for (const row of rows) {
    const t = row.tournament;
    const published = t.resultsPublishedAt !== null && t.resultsValidatedAt !== null;
    let rankedCount: number | null = null;
    if (published) {
      const ranked = await db.tournamentParticipant.findMany({
        where: { tournamentId: t.id, finalRank: { not: null } },
        select: { teamId: true },
      });
      rankedCount =
        t.format === "TEAMS" ? new Set(ranked.map((r) => r.teamId)).size : ranked.length;
    }
    entries.push({
      slug: t.slug,
      name: t.name,
      status: t.status,
      startsAt: t.startsAt,
      format: t.format,
      withdrawn: row.withdrawnAt !== null,
      team: row.team?.name ?? null,
      finalRank: published ? row.finalRank : null,
      rankedCount,
      resultsPublished: published,
    });
  }
  return entries;
}

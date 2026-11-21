import { prisma, type Db } from "@/lib/prisma";
import { monthBounds, rankStandings, type RankedRow } from "@/features/gamification/rules";
import { placementPoints } from "@/features/scrabble/rules";

/**
 * Classement mensuel du Scrabble (docs/DECISIONS.md, section 13) : sur les tournois comptés
 * (`countsForMonthly`) dont les résultats sont **publiés** dans le mois (heure de Dakar), chaque
 * membre reçoit `classés − rang + 1` points de classement par tournoi (rang figé à la validation ;
 * en équipes, le rang de son équipe parmi les équipes classées). Membres actifs seulement, hors
 * `hiddenFromRankings` ; prénom + initiale ; égalités « 1, 1, 3 ». Calculé à la lecture : une
 * dévalidation retire aussitôt le tournoi du classement (réversible, rien n'est stocké).
 */
export type MonthlyRow = RankedRow & { tournaments: number; isViewer: boolean };

export type MonthlyScrabbleRanking = {
  from: Date;
  to: Date;
  /** Tournois comptés ce mois-ci. */
  tournaments: number;
  top: MonthlyRow[];
  viewer: { rank: number | null; points: number; hidden: boolean } | null;
};

const TOP_SIZE = 10;

export async function getMonthlyScrabbleRanking(
  input: { now: Date; viewerId: string | null },
  db: Db = prisma,
): Promise<MonthlyScrabbleRanking> {
  const { from, to } = monthBounds(input.now);
  const tournaments = await db.tournament.findMany({
    where: {
      countsForMonthly: true,
      archivedAt: null,
      resultsValidatedAt: { not: null },
      resultsPublishedAt: { gte: from, lt: to },
    },
    select: {
      format: true,
      participants: {
        where: { finalRank: { not: null } },
        select: { userId: true, teamId: true, finalRank: true },
      },
    },
  });
  const totals = new Map<string, { points: number; tournaments: number }>();
  for (const tournament of tournaments) {
    const ranked =
      tournament.format === "TEAMS"
        ? new Set(tournament.participants.map((p) => p.teamId).filter(Boolean)).size
        : tournament.participants.length;
    for (const p of tournament.participants) {
      if (!p.userId) continue;
      const points = placementPoints(p.finalRank, ranked);
      const own = totals.get(p.userId) ?? { points: 0, tournaments: 0 };
      totals.set(p.userId, { points: own.points + points, tournaments: own.tournaments + 1 });
    }
  }
  const eligible = { status: "ACTIVE" as const, memberNumber: { not: null }, archivedAt: null };
  const users = await db.user.findMany({
    where: { id: { in: [...totals.keys()] }, ...eligible },
    select: { id: true, firstName: true, lastName: true, hiddenFromRankings: true },
  });
  const shown = users.filter((u) => !u.hiddenFromRankings);
  const ranked = rankStandings(
    shown.map((u) => ({
      userId: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      points: totals.get(u.id)!.points,
    })),
  );
  const top = ranked.slice(0, TOP_SIZE).map((row) => ({
    ...row,
    tournaments: totals.get(row.userId)!.tournaments,
    isViewer: row.userId === input.viewerId,
  }));
  let viewer: MonthlyScrabbleRanking["viewer"] = null;
  if (input.viewerId) {
    const me = await db.user.findFirst({
      where: { id: input.viewerId, ...eligible },
      select: { hiddenFromRankings: true },
    });
    if (me) {
      const own = ranked.find((row) => row.userId === input.viewerId);
      viewer = {
        rank: own?.rank ?? null,
        points: totals.get(input.viewerId)?.points ?? 0,
        hidden: me.hiddenFromRankings,
      };
    }
  }
  return { from, to, tournaments: tournaments.length, top, viewer };
}

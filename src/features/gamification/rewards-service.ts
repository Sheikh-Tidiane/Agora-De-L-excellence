import type { PointSourceType } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/prisma";
import { measureCriteria } from "@/features/gamification/badges-service";
import { levelStanding, type LevelStanding } from "@/features/gamification/levels";
import {
  badgeProgress,
  isAutomaticCriterion,
  monthBounds,
  rankStandings,
  transactionLabel,
  type AutomaticCriterion,
} from "@/features/gamification/rules";

/** Lectures du moteur : récompenses d'un membre, historique, classements. */

export type HistoryLine = {
  id: string;
  points: number;
  label: string;
  sourceType: PointSourceType;
  createdAt: Date;
  /** Une ligne inverse la corrige. */
  reversed: boolean;
  /** Cette ligne est une correction (elle ne se corrige pas). */
  isCorrection: boolean;
  reason: string | null;
  /** Nom de l'auteur de la ligne (`null` : système). */
  createdByName: string | null;
};

const HISTORY_LIMIT = 200;

/** Titres lisibles des sources (rencontre, livre, tournoi, quiz), lus par lot. */
async function sourceTitles(
  db: Db,
  lines: readonly { sourceType: PointSourceType; sourceId: string }[],
): Promise<Map<string, string>> {
  const ids = (type: PointSourceType) => [
    ...new Set(lines.filter((l) => l.sourceType === type).map((l) => l.sourceId)),
  ];
  // L'une après l'autre : la lecture peut tourner dans une transaction (une requête à la fois).
  const registrations = await db.eventRegistration.findMany({
    where: { id: { in: ids("EVENT_ATTENDANCE") } },
    select: { id: true, event: { select: { title: true } } },
  });
  const readings = await db.reading.findMany({
    where: { id: { in: ids("READING") } },
    select: { id: true, book: { select: { title: true } } },
  });
  const reviews = await db.review.findMany({
    where: { id: { in: ids("REVIEW") } },
    select: { id: true, book: { select: { title: true } } },
  });
  const tournaments = await db.tournament.findMany({
    where: { id: { in: ids("TOURNAMENT") } },
    select: { id: true, name: true },
  });
  const quizzes = await db.quiz.findMany({
    where: { id: { in: ids("QUIZ") } },
    select: { id: true, title: true },
  });
  const titles = new Map<string, string>();
  for (const r of registrations) titles.set(`EVENT_ATTENDANCE:${r.id}`, r.event.title);
  for (const r of readings) titles.set(`READING:${r.id}`, r.book.title);
  for (const r of reviews) titles.set(`REVIEW:${r.id}`, r.book.title);
  for (const t of tournaments) titles.set(`TOURNAMENT:${t.id}`, t.name);
  for (const q of quizzes) titles.set(`QUIZ:${q.id}`, q.title);
  return titles;
}

/** Historique d'un membre, du plus récent au plus ancien, avec un libellé lisible par ligne. */
export async function listMemberTransactions(
  userId: string,
  db: Db = prisma,
): Promise<HistoryLine[]> {
  const rows = await db.pointTransaction.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: HISTORY_LIMIT,
    select: {
      id: true,
      points: true,
      sourceType: true,
      sourceId: true,
      reason: true,
      createdAt: true,
      reversesId: true,
      rule: { select: { label: true } },
      reversedBy: { select: { id: true } },
      createdBy: { select: { name: true } },
    },
  });
  const titles = await sourceTitles(db, rows);
  return rows.map((row) => ({
    id: row.id,
    points: row.points,
    label: transactionLabel({
      sourceType: row.sourceType,
      ruleLabel: row.rule?.label ?? null,
      sourceTitle: titles.get(`${row.sourceType}:${row.sourceId}`) ?? null,
      reason: row.reason,
    }),
    sourceType: row.sourceType,
    createdAt: row.createdAt,
    reversed: row.reversedBy !== null,
    isCorrection: row.reversesId !== null,
    reason: row.reason,
    createdByName: row.createdBy?.name ?? null,
  }));
}

/** Total des points d'un membre : somme de tout le grand livre (l'historique, lui, est borné). */
export async function memberPointsTotal(userId: string, db: Db = prisma): Promise<number> {
  const sum = await db.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } });
  return sum._sum.points ?? 0;
}

export type MemberRewards = {
  total: number;
  level: LevelStanding;
  earned: {
    code: string;
    name: string;
    description: string;
    awardedAt: Date;
    manual: boolean;
    reason: string | null;
  }[];
  toEarn: {
    code: string;
    name: string;
    description: string;
    manual: boolean;
    progress: { current: number; threshold: number; ratio: number } | null;
  }[];
  history: HistoryLine[];
};

export async function getMemberRewards(userId: string, db: Db = prisma): Promise<MemberRewards> {
  const total = await memberPointsTotal(userId, db);
  const levels = await db.level.findMany({ select: { code: true, name: true, minPoints: true } });
  const held = await db.userBadge.findMany({
    where: { userId },
    orderBy: { awardedAt: "desc" },
    select: {
      awardedAt: true,
      reason: true,
      badge: { select: { code: true, name: true, description: true, criterion: true } },
    },
  });
  const badges = await db.badge.findMany({
    where: { isActive: true },
    orderBy: [{ threshold: "asc" }, { name: "asc" }],
    select: { code: true, name: true, description: true, criterion: true, threshold: true },
  });
  const history = await listMemberTransactions(userId, db);
  const heldCodes = new Set(held.map((row) => row.badge.code));
  const missing = badges.filter((badge) => !heldCodes.has(badge.code));
  const counts = await measureCriteria(
    userId,
    missing.map((b) => b.criterion).filter((c): c is AutomaticCriterion => isAutomaticCriterion(c)),
    db,
  );
  return {
    total,
    level: levelStanding(levels, total),
    earned: held.map(({ badge, awardedAt, reason }) => ({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      awardedAt,
      manual: badge.criterion === "MANUAL",
      reason: badge.criterion === "MANUAL" ? reason : null,
    })),
    toEarn: missing.map((badge) => ({
      code: badge.code,
      name: badge.name,
      description: badge.description,
      manual: badge.criterion === "MANUAL",
      progress: badgeProgress(badge, counts),
    })),
    history,
  };
}

export type RankingRow = {
  rank: number;
  userId: string;
  firstName: string;
  lastNameInitial: string;
  points: number;
  isViewer: boolean;
};

export type PointRankings = {
  top: RankingRow[];
  /** `null` : pas de membre connecté, ou un compte qui n'est pas un membre classable. */
  viewer: { rank: number | null; points: number; hidden: boolean } | null;
};

const TOP_SIZE = 10;

/**
 * Classements de points (membres seulement) : mensuel (mois calendaire de Dakar, chaque ligne
 * comptée au mois où elle est écrite, corrections comprises) ou général. Membres actifs, non
 * retirés ; prénom et initiale seulement ; égalités « 1, 1, 3 ».
 */
export async function getPointRankings(
  input: { period: "month" | "all"; viewerId: string | null; now: Date },
  db: Db = prisma,
): Promise<PointRankings> {
  const eligible = { status: "ACTIVE" as const, memberNumber: { not: null }, archivedAt: null };
  const createdAt =
    input.period === "month"
      ? (() => {
          const { from, to } = monthBounds(input.now);
          return { gte: from, lt: to };
        })()
      : undefined;
  const sums = await db.pointTransaction.groupBy({
    by: ["userId"],
    where: { createdAt, user: { is: { ...eligible, hiddenFromRankings: false } } },
    _sum: { points: true },
  });
  const users = await db.user.findMany({
    where: { id: { in: sums.map((row) => row.userId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const byId = new Map(users.map((user) => [user.id, user]));
  const ranked = rankStandings(
    sums.flatMap((row) => {
      const user = byId.get(row.userId);
      return user
        ? [
            {
              userId: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              points: row._sum.points ?? 0,
            },
          ]
        : [];
    }),
  );
  const top = ranked
    .slice(0, TOP_SIZE)
    .map((row) => ({ ...row, isViewer: row.userId === input.viewerId }));

  let viewer: PointRankings["viewer"] = null;
  if (input.viewerId) {
    const me = await db.user.findFirst({
      where: { id: input.viewerId, ...eligible },
      select: { hiddenFromRankings: true },
    });
    if (me) {
      const own = ranked.find((row) => row.userId === input.viewerId);
      const points = own
        ? own.points
        : ((
            await db.pointTransaction.aggregate({
              where: { userId: input.viewerId, createdAt },
              _sum: { points: true },
            })
          )._sum.points ?? 0);
      viewer = { rank: own?.rank ?? null, points, hidden: me.hiddenFromRankings };
    }
  }
  return { top, viewer };
}

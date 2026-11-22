import { lastNameInitial, rankStandings } from "@/features/gamification/rules";
import { finalizeStaleAttempts } from "@/features/quizzes/attempt-core";
import { durationSeconds, rankAttempts } from "@/features/quizzes/rules";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Classements des quiz (membres seulement, prénom + initiale, top 10 + position du membre) :
 * - par quiz : tentatives terminées, score décroissant puis durée croissante ;
 * - général : total des bonnes réponses sur tous les quiz terminés (ex æquo « 1, 1, 3 »).
 * Membres actifs (numéro, non archivés) ; un membre retiré des classements n'y figure pas.
 */
const TOP_SIZE = 10;
const eligible = { status: "ACTIVE" as const, memberNumber: { not: null }, archivedAt: null };

export type QuizRankingRow = {
  rank: number;
  userId: string;
  firstName: string;
  lastNameInitial: string;
  score: number;
  durationSeconds: number;
  isViewer: boolean;
};

export type QuizRanking = {
  maxScore: number;
  participants: number;
  top: QuizRankingRow[];
  /** `null` : pas de tentative terminée du membre (ou pas de membre). */
  viewer: { rank: number | null; score: number; durationSeconds: number; hidden: boolean } | null;
};

export async function getQuizRanking(
  input: { quizId: string; viewerId: string | null; now?: Date },
  db: Db = prisma,
): Promise<QuizRanking> {
  const now = input.now ?? new Date();
  await finalizeStaleAttempts(db, { quizId: input.quizId }, now);
  const attempts = await db.quizAttempt.findMany({
    where: { quizId: input.quizId, finishedAt: { not: null } },
    select: {
      userId: true,
      score: true,
      maxScore: true,
      startedAt: true,
      finishedAt: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          status: true,
          memberNumber: true,
          archivedAt: true,
          hiddenFromRankings: true,
        },
      },
    },
  });
  const rows = attempts.map((a) => ({
    userId: a.userId,
    firstName: a.user.firstName,
    lastName: a.user.lastName,
    score: a.score ?? 0,
    durationSeconds: durationSeconds(a.startedAt, a.finishedAt!),
    classable:
      a.user.status === "ACTIVE" &&
      a.user.memberNumber !== null &&
      !a.user.archivedAt &&
      !a.user.hiddenFromRankings,
    hidden: a.user.hiddenFromRankings,
  }));
  const ranked = rankAttempts(rows.filter((r) => r.classable));
  const own = rows.find((r) => r.userId === input.viewerId) ?? null;
  const ownRank = ranked.find((r) => r.userId === input.viewerId) ?? null;
  return {
    maxScore: attempts[0]?.maxScore ?? 0,
    participants: ranked.length,
    top: ranked.slice(0, TOP_SIZE).map((r) => ({
      rank: r.rank,
      userId: r.userId,
      firstName: r.firstName,
      lastNameInitial: lastNameInitial(r.lastName),
      score: r.score,
      durationSeconds: r.durationSeconds,
      isViewer: r.userId === input.viewerId,
    })),
    viewer: own
      ? {
          rank: ownRank?.rank ?? null,
          score: own.score,
          durationSeconds: own.durationSeconds,
          hidden: own.hidden,
        }
      : null,
  };
}

export type GeneralQuizRanking = {
  top: {
    rank: number;
    userId: string;
    firstName: string;
    lastNameInitial: string;
    correctAnswers: number;
    isViewer: boolean;
  }[];
  viewer: { rank: number | null; correctAnswers: number; quizzes: number; hidden: boolean } | null;
};

export async function getGeneralQuizRanking(
  input: { viewerId: string | null },
  db: Db = prisma,
): Promise<GeneralQuizRanking> {
  const sums = await db.quizAttempt.groupBy({
    by: ["userId"],
    where: { finishedAt: { not: null }, user: { is: { ...eligible, hiddenFromRankings: false } } },
    _sum: { score: true },
  });
  const users = await db.user.findMany({
    where: { id: { in: sums.map((row) => row.userId) } },
    select: { id: true, firstName: true, lastName: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const ranked = rankStandings(
    sums.flatMap((row) => {
      const user = byId.get(row.userId);
      return user
        ? [
            {
              userId: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              points: row._sum.score ?? 0,
            },
          ]
        : [];
    }),
  );
  let viewer: GeneralQuizRanking["viewer"] = null;
  if (input.viewerId) {
    const me = await db.user.findFirst({
      where: { id: input.viewerId, ...eligible },
      select: { hiddenFromRankings: true },
    });
    if (me) {
      const mine = await db.quizAttempt.aggregate({
        where: { userId: input.viewerId, finishedAt: { not: null } },
        _sum: { score: true },
        _count: { _all: true },
      });
      const own = ranked.find((r) => r.userId === input.viewerId);
      viewer = {
        rank: own?.rank ?? null,
        correctAnswers: mine._sum.score ?? 0,
        quizzes: mine._count._all,
        hidden: me.hiddenFromRankings,
      };
    }
  }
  return {
    top: ranked.slice(0, TOP_SIZE).map((r) => ({
      rank: r.rank,
      userId: r.userId,
      firstName: r.firstName,
      lastNameInitial: r.lastNameInitial,
      correctAnswers: r.points,
      isViewer: r.userId === input.viewerId,
    })),
    viewer,
  };
}

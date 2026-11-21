import { evaluateBadges } from "@/features/gamification/badges-service";
import {
  awardForSource,
  memberStatus,
  runInTransaction,
  skipped,
  type AwardResult,
  type Tx,
} from "@/features/gamification/ledger";
import { RULE_CODES } from "@/features/gamification/rules";
import { effectiveDeadline, finishTime, NETWORK_GRACE_MS, scoreOf } from "@/features/quizzes/rules";
import type { Db } from "@/lib/prisma";

/**
 * Briques transactionnelles partagées par le parcours du membre et l'administration :
 * verrous, fin de tentative (score calculé par le serveur) et points du quiz terminé.
 */

/** Verrou de ligne sur le quiz : `UPDATE` pour le modifier, `SHARE` pour démarrer une tentative. */
export async function lockQuiz(tx: Tx, quizId: string, mode: "UPDATE" | "SHARE"): Promise<boolean> {
  const rows =
    mode === "UPDATE"
      ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Quiz" WHERE id = ${quizId} FOR UPDATE`
      : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Quiz" WHERE id = ${quizId} FOR SHARE`;
  return rows.length > 0;
}

/** Verrou de la tentative du membre. `false` : introuvable ou tentative d'un autre membre. */
export async function lockOwnAttempt(tx: Tx, attemptId: string, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "QuizAttempt" WHERE id = ${attemptId} AND "userId" = ${userId} FOR UPDATE`;
  return rows.length > 0;
}

/** Points « quiz terminé » : source `QUIZ` + identifiant du quiz, une seule fois (anti-doublon du grand livre). */
async function awardQuizPoints(tx: Tx, userId: string, quizId: string): Promise<AwardResult> {
  let result: AwardResult;
  if ((await memberStatus(tx, userId)) !== "member") {
    result = skipped("not_member");
  } else {
    const rule = await tx.pointRule.findUnique({
      where: { code: RULE_CODES.quizCompleted },
      select: { id: true, code: true, label: true, points: true, isActive: true },
    });
    if (!rule) result = skipped("no_rule");
    else if (!rule.isActive) result = skipped("inactive_rule");
    else if (rule.points <= 0) result = skipped("zero_points");
    // Attribution par le système (`actorId: null`) : personne ne s'attribue ses points.
    else
      result = await awardForSource(tx, {
        userId,
        rule,
        sourceType: "QUIZ",
        sourceId: quizId,
        actorId: null,
      });
  }
  // Le quiz terminé compte pour les badges même sans points.
  return { ...result, badges: await evaluateBadges(userId, tx) };
}

export type FinalizeResult = {
  score: number;
  maxScore: number;
  finishedAt: Date;
  /** `false` : la tentative était déjà terminée (rien n'a changé). */
  finalized: boolean;
  award: AwardResult | null;
};

/**
 * Termine une tentative **déjà verrouillée** par l'appelant. Idempotent : une tentative finie
 * n'est ni recalculée ni payée deux fois. L'heure de fin ne dépasse jamais l'échéance.
 */
export async function finalizeLocked(
  tx: Tx,
  attemptId: string,
  now: Date,
): Promise<FinalizeResult> {
  const attempt = await tx.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      userId: true,
      quizId: true,
      startedAt: true,
      expiresAt: true,
      finishedAt: true,
      score: true,
      maxScore: true,
      quiz: { select: { closesAt: true } },
    },
  });
  if (attempt.finishedAt) {
    return {
      score: attempt.score ?? 0,
      maxScore: attempt.maxScore,
      finishedAt: attempt.finishedAt,
      finalized: false,
      award: null,
    };
  }
  const answers = await tx.quizAnswer.findMany({
    where: { attemptId },
    select: { isCorrect: true },
  });
  const score = Math.min(scoreOf(answers), attempt.maxScore);
  const deadline = effectiveDeadline(attempt.expiresAt, attempt.quiz.closesAt);
  const end = finishTime(deadline, now);
  const finishedAt = end < attempt.startedAt ? attempt.startedAt : end;
  await tx.quizAttempt.update({ where: { id: attemptId }, data: { finishedAt, score } });
  const award = await awardQuizPoints(tx, attempt.userId, attempt.quizId);
  return { score, maxScore: attempt.maxScore, finishedAt, finalized: true, award };
}

/**
 * Termine les tentatives dont le temps est écoulé (tolérance réseau passée) ou dont le quiz
 * n'est plus publié : pour un membre (avant d'afficher ses quiz) ou pour un quiz (avant ses
 * résultats). Chaque tentative dans sa propre transaction, verrouillée puis revérifiée.
 */
export async function finalizeStaleAttempts(
  db: Db,
  scope: { userId?: string; quizId?: string },
  now: Date,
): Promise<number> {
  const limit = new Date(now.getTime() - NETWORK_GRACE_MS);
  const stale = await db.quizAttempt.findMany({
    where: {
      ...scope,
      finishedAt: null,
      OR: [
        { expiresAt: { lt: limit } },
        { quiz: { closesAt: { lt: limit } } },
        { quiz: { status: { not: "PUBLISHED" } } },
      ],
    },
    select: { id: true, userId: true },
    take: 200,
  });
  let count = 0;
  for (const attempt of stale) {
    const done = await runInTransaction(db, async (tx) => {
      if (!(await lockOwnAttempt(tx, attempt.id, attempt.userId))) return false;
      return (await finalizeLocked(tx, attempt.id, now)).finalized;
    });
    if (done) count += 1;
  }
  return count;
}

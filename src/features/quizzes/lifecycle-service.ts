import { runInTransaction } from "@/features/gamification/ledger";
import { loadLocked } from "@/features/quizzes/admin-service";
import { finalizeLocked } from "@/features/quizzes/attempt-core";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";

/** Fin de vie d'un quiz : clôture, archivage, suppression (jamais d'un quiz joué). */

/** Clôt un quiz publié. Les tentatives en cours sont terminées avec les réponses déjà données. */
export async function closeQuiz(
  quizId: string,
  actorId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ finalized: number }> {
  return runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz.status !== "PUBLISHED") throw new AppError("CONFLICT", "Seul un quiz publié se clôt.");
    const open = await tx.quizAttempt.findMany({
      where: { quizId, finishedAt: null },
      select: { id: true },
    });
    for (const attempt of open) {
      await tx.$queryRaw`SELECT id FROM "QuizAttempt" WHERE id = ${attempt.id} FOR UPDATE`;
      await finalizeLocked(tx, attempt.id, now);
    }
    await tx.quiz.update({ where: { id: quizId }, data: { status: "CLOSED", closedAt: now } });
    await audit(
      {
        actorId,
        action: "quiz.closed",
        entityType: "Quiz",
        entityId: quizId,
        metadata: { slug: quiz.slug, attempts: quiz._count.attempts, finalized: open.length },
      },
      tx,
    );
    return { finalized: open.length };
  });
}

/** Archive un quiz clos : il quitte l'espace membre, ses résultats restent dans l'administration. */
export async function archiveQuiz(
  quizId: string,
  actorId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz.status !== "CLOSED" || quiz.archivedAt) {
      throw new AppError("CONFLICT", "Clôturez le quiz avant de l’archiver.");
    }
    await tx.quiz.update({ where: { id: quizId }, data: { archivedAt: now } });
    await audit(
      {
        actorId,
        action: "quiz.archived",
        entityType: "Quiz",
        entityId: quizId,
        metadata: { slug: quiz.slug },
      },
      tx,
    );
  });
}

/** Supprime un quiz que personne n'a joué et qui n'est pas en ligne. */
export async function deleteQuiz(quizId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz._count.attempts > 0) {
      throw new AppError("CONFLICT", "Ce quiz a été joué : il ne se supprime pas, il se clôt.");
    }
    if (quiz.status === "PUBLISHED") {
      throw new AppError("CONFLICT", "Repassez le quiz en brouillon avant de le supprimer.");
    }
    await tx.quiz.delete({ where: { id: quizId } });
  });
}

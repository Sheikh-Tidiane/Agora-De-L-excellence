import { randomUUID } from "node:crypto";
import { runInTransaction, type Tx } from "@/features/gamification/ledger";
import { lockQuiz } from "@/features/quizzes/attempt-core";
import { QUIZ_LIMITS } from "@/features/quizzes/rules";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Questions et propositions d'un quiz. Modifiables seulement en brouillon (un brouillon n'a
 * jamais de tentative : on ne repasse en brouillon que si personne n'a joué). Les schémas Zod
 * garantissent déjà 2 à 6 propositions et exactement une bonne ; l'index unique partiel en base
 * aussi.
 */
type ChoiceData = { label: string; isCorrect: boolean };

async function lockDraft(tx: Tx, quizId: string): Promise<void> {
  if (!(await lockQuiz(tx, quizId, "UPDATE"))) throw new AppError("NOT_FOUND", "Quiz introuvable.");
  const quiz = await tx.quiz.findUniqueOrThrow({
    where: { id: quizId },
    select: { status: true, archivedAt: true },
  });
  if (quiz.status !== "DRAFT" || quiz.archivedAt) {
    throw new AppError(
      "CONFLICT",
      "Les questions ne se modifient qu’en brouillon. Repassez le quiz en brouillon (si personne n’a joué).",
    );
  }
}

async function quizOfQuestion(db: Db, questionId: string): Promise<string> {
  const question = await db.quizQuestion.findUnique({
    where: { id: questionId },
    select: { quizId: true },
  });
  if (!question) throw new AppError("NOT_FOUND", "Question introuvable.");
  return question.quizId;
}

/**
 * Identifiants aléatoires : un `cuid()` croît avec l'ordre de saisie. Envoyés au navigateur pendant
 * le jeu, ils trahiraient l'ordre de l'administration (et la bonne réponse, si elle est saisie en
 * premier) malgré le mélange propre à chaque tentative.
 */
const choicesData = (choices: readonly ChoiceData[]) =>
  choices.map((choice, position) => ({
    id: randomUUID(),
    label: choice.label,
    isCorrect: choice.isCorrect,
    position,
  }));

export async function addQuestion(
  input: { quizId: string; prompt: string; choices: readonly ChoiceData[] },
  db: Db = prisma,
): Promise<{ id: string }> {
  return runInTransaction(db, async (tx) => {
    await lockDraft(tx, input.quizId);
    const count = await tx.quizQuestion.count({ where: { quizId: input.quizId } });
    if (count >= QUIZ_LIMITS.maxQuestions) {
      throw new AppError("CONFLICT", "Un quiz compte au plus 50 questions.");
    }
    const last = await tx.quizQuestion.aggregate({
      where: { quizId: input.quizId },
      _max: { position: true },
    });
    return tx.quizQuestion.create({
      data: {
        quizId: input.quizId,
        prompt: input.prompt,
        position: (last._max.position ?? -1) + 1,
        choices: { create: choicesData(input.choices) },
      },
      select: { id: true },
    });
  });
}

/** Remplace l'énoncé et toutes les propositions (formulaire d'une question complète). */
export async function updateQuestion(
  input: { questionId: string; prompt: string; choices: readonly ChoiceData[] },
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const quizId = await quizOfQuestion(tx, input.questionId);
    await lockDraft(tx, quizId);
    // Suppression d'abord : l'index « une seule bonne réponse » ne voit jamais deux bonnes.
    await tx.quizChoice.deleteMany({ where: { questionId: input.questionId } });
    await tx.quizQuestion.update({
      where: { id: input.questionId },
      data: { prompt: input.prompt, choices: { create: choicesData(input.choices) } },
    });
  });
}

export async function deleteQuestion(questionId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const quizId = await quizOfQuestion(tx, questionId);
    await lockDraft(tx, quizId);
    await tx.quizQuestion.delete({ where: { id: questionId } });
  });
}

/** Nouvel ordre : la liste complète des questions du quiz, chacune une fois. */
export async function reorderQuestions(
  input: { quizId: string; questionIds: readonly string[] },
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    await lockDraft(tx, input.quizId);
    const existing = await tx.quizQuestion.findMany({
      where: { quizId: input.quizId },
      select: { id: true },
    });
    const ids = new Set(existing.map((q) => q.id));
    const given = new Set(input.questionIds);
    if (
      given.size !== input.questionIds.length ||
      given.size !== ids.size ||
      input.questionIds.some((id) => !ids.has(id))
    ) {
      throw new AppError("VALIDATION", "Indiquez chaque question du quiz une fois.");
    }
    for (const [position, id] of input.questionIds.entries()) {
      await tx.quizQuestion.update({ where: { id }, data: { position } });
    }
  });
}

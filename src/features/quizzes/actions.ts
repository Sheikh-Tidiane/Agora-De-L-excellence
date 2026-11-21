"use server";

import { refresh } from "next/cache";
import {
  createQuiz,
  publishQuiz,
  unpublishQuiz,
  updateQuiz,
} from "@/features/quizzes/admin-service";
import { archiveQuiz, closeQuiz, deleteQuiz } from "@/features/quizzes/lifecycle-service";
import {
  answerQuestion,
  finishAttempt,
  startAttempt,
  type AnswerOutcome,
  type FinishedState,
  type PlayState,
} from "@/features/quizzes/attempt-service";
import {
  addQuestion,
  deleteQuestion,
  reorderQuestions,
  updateQuestion,
} from "@/features/quizzes/question-service";
import {
  addQuestionSchema,
  answerSchema,
  attemptIdSchema,
  questionIdSchema,
  quizIdSchema,
  quizSettingsSchema,
  reorderQuestionsSchema,
  updateQuestionSchema,
  type AddQuestionInput,
  type AnswerInput,
  type QuizSettingsInput,
  type ReorderQuestionsInput,
  type UpdateQuestionInput,
} from "@/features/quizzes/schemas";
import { AppError, parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Quiz. Administration : `quizzes.manage`. Membre : `member.access`, compte tiré de la session ;
 * le service ne touche qu'à la tentative de ce compte (une autre est « introuvable »).
 * Ordre : contrôle d'accès, validation Zod, limite de débit (membre), service.
 */

// --- Administration ---

export async function createQuizAction(
  input: QuizSettingsInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return runAction("quizzes.create", async () => {
    const actor = await requirePermission("quizzes.manage");
    const data = parseInput(quizSettingsSchema, input);
    const quiz = await createQuiz(data, actor.id);
    refresh();
    return quiz;
  });
}

export async function updateQuizAction(
  input: QuizSettingsInput,
): Promise<ActionResult<{ slug: string }>> {
  return runAction("quizzes.update", async () => {
    await requirePermission("quizzes.manage");
    const data = parseInput(quizSettingsSchema, input);
    if (!data.quizId) {
      throw new AppError("VALIDATION", undefined, { fieldErrors: { quizId: "Quiz manquant." } });
    }
    const result = await updateQuiz(data.quizId, data);
    refresh();
    return result;
  });
}

export async function deleteQuizAction(input: { quizId: string }): Promise<ActionResult> {
  return runAction("quizzes.delete", async () => {
    await requirePermission("quizzes.manage");
    await deleteQuiz(parseInput(quizIdSchema, input).quizId);
    refresh();
    return undefined;
  });
}

export async function publishQuizAction(input: {
  quizId: string;
}): Promise<ActionResult<{ notified: number }>> {
  return runAction("quizzes.publish", async () => {
    const actor = await requirePermission("quizzes.manage");
    const result = await publishQuiz(parseInput(quizIdSchema, input).quizId, actor.id);
    refresh();
    return result;
  });
}

export async function unpublishQuizAction(input: { quizId: string }): Promise<ActionResult> {
  return runAction("quizzes.unpublish", async () => {
    const actor = await requirePermission("quizzes.manage");
    await unpublishQuiz(parseInput(quizIdSchema, input).quizId, actor.id);
    refresh();
    return undefined;
  });
}

export async function closeQuizAction(input: {
  quizId: string;
}): Promise<ActionResult<{ finalized: number }>> {
  return runAction("quizzes.close", async () => {
    const actor = await requirePermission("quizzes.manage");
    const result = await closeQuiz(parseInput(quizIdSchema, input).quizId, actor.id);
    refresh();
    return result;
  });
}

export async function archiveQuizAction(input: { quizId: string }): Promise<ActionResult> {
  return runAction("quizzes.archive", async () => {
    const actor = await requirePermission("quizzes.manage");
    await archiveQuiz(parseInput(quizIdSchema, input).quizId, actor.id);
    refresh();
    return undefined;
  });
}

export async function addQuestionAction(
  input: AddQuestionInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction("quizzes.question.add", async () => {
    await requirePermission("quizzes.manage");
    const question = await addQuestion(parseInput(addQuestionSchema, input));
    refresh();
    return question;
  });
}

export async function updateQuestionAction(input: UpdateQuestionInput): Promise<ActionResult> {
  return runAction("quizzes.question.update", async () => {
    await requirePermission("quizzes.manage");
    await updateQuestion(parseInput(updateQuestionSchema, input));
    refresh();
    return undefined;
  });
}

export async function deleteQuestionAction(input: { questionId: string }): Promise<ActionResult> {
  return runAction("quizzes.question.delete", async () => {
    await requirePermission("quizzes.manage");
    await deleteQuestion(parseInput(questionIdSchema, input).questionId);
    refresh();
    return undefined;
  });
}

export async function reorderQuestionsAction(input: ReorderQuestionsInput): Promise<ActionResult> {
  return runAction("quizzes.question.reorder", async () => {
    await requirePermission("quizzes.manage");
    await reorderQuestions(parseInput(reorderQuestionsSchema, input));
    refresh();
    return undefined;
  });
}

// --- Membre ---

export async function startQuizAction(input: { quizId: string }): Promise<ActionResult<PlayState>> {
  return runAction("quizzes.start", async () => {
    const user = await requirePermission("member.access");
    const { quizId } = parseInput(quizIdSchema, input);
    await enforceRateLimit("quiz.play.user", user.id);
    return startAttempt(user.id, quizId);
  });
}

export async function answerQuestionAction(
  input: AnswerInput,
): Promise<ActionResult<AnswerOutcome>> {
  return runAction("quizzes.answer", async () => {
    const user = await requirePermission("member.access");
    const data = parseInput(answerSchema, input);
    await enforceRateLimit("quiz.play.user", user.id);
    return answerQuestion(user.id, data);
  });
}

export async function finishQuizAction(input: {
  attemptId: string;
}): Promise<ActionResult<FinishedState>> {
  return runAction("quizzes.finish", async () => {
    const user = await requirePermission("member.access");
    const { attemptId } = parseInput(attemptIdSchema, input);
    await enforceRateLimit("quiz.play.user", user.id);
    const state = await finishAttempt(user.id, attemptId);
    refresh();
    return state;
  });
}

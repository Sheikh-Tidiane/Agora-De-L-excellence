import type { QuizStatus } from "@/generated/prisma/client";
import { publicationProblems } from "@/features/quizzes/admin-service";
import { finalizeStaleAttempts } from "@/features/quizzes/attempt-core";
import {
  durationSeconds,
  quizPhase,
  rankAttempts,
  successRate,
  type QuizPhase,
} from "@/features/quizzes/rules";
import { prisma, type Db } from "@/lib/prisma";

/** Lectures de l'administration des quiz (`quizzes.manage` vérifié par la page). */

export type AdminQuizListItem = {
  id: string;
  slug: string;
  title: string;
  status: QuizStatus;
  phase: QuizPhase;
  opensAt: Date;
  closesAt: Date;
  durationMinutes: number;
  archivedAt: Date | null;
  isDemo: boolean;
  questionCount: number;
  attemptCount: number;
  event: { id: string; title: string; startsAt: Date } | null;
};

export async function listQuizzesForAdmin(
  input: { includeArchived?: boolean; now?: Date } = {},
  db: Db = prisma,
): Promise<AdminQuizListItem[]> {
  const now = input.now ?? new Date();
  const rows = await db.quiz.findMany({
    where: input.includeArchived ? {} : { archivedAt: null },
    orderBy: [{ opensAt: "desc" }, { id: "desc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      durationMinutes: true,
      archivedAt: true,
      isDemo: true,
      event: { select: { id: true, title: true, startsAt: true } },
      _count: { select: { questions: true, attempts: true } },
    },
  });
  return rows.map(({ _count, ...row }) => ({
    ...row,
    phase: quizPhase(row, now),
    questionCount: _count.questions,
    attemptCount: _count.attempts,
  }));
}

/** Rencontres « Génies du soir » proposées au lien (non archivées, des 3 derniers mois et à venir). */
export async function listGeniesEvents(now: Date = new Date(), db: Db = prisma) {
  return db.event.findMany({
    where: {
      type: "GENIES_DU_SOIR",
      archivedAt: null,
      startsAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, startsAt: true },
  });
}

/** Fiche d'un quiz : réglages, questions avec la bonne réponse, état et gestes permis. */
export async function getQuizForAdmin(quizId: string, now: Date = new Date(), db: Db = prisma) {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      slug: true,
      title: true,
      instructions: true,
      durationMinutes: true,
      opensAt: true,
      closesAt: true,
      status: true,
      publishedAt: true,
      closedAt: true,
      archivedAt: true,
      isDemo: true,
      event: { select: { id: true, title: true, startsAt: true } },
      questions: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: {
          id: true,
          prompt: true,
          position: true,
          choices: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: { id: true, label: true, isCorrect: true },
          },
        },
      },
      _count: { select: { attempts: true } },
    },
  });
  if (!quiz) return null;
  const { _count, ...rest } = quiz;
  const draft = quiz.status === "DRAFT" && !quiz.archivedAt;
  const problems = draft ? await publicationProblems(db, quizId, now) : [];
  const attempts = _count.attempts;
  return {
    ...rest,
    phase: quizPhase(quiz, now),
    attemptCount: attempts,
    problems,
    can: {
      editContent: draft,
      editSettings: !quiz.archivedAt,
      publish: draft && problems.length === 0,
      unpublish: quiz.status === "PUBLISHED" && attempts === 0,
      close: quiz.status === "PUBLISHED",
      archive: quiz.status === "CLOSED" && !quiz.archivedAt,
      delete: attempts === 0 && quiz.status !== "PUBLISHED",
    },
  };
}
export type AdminQuiz = NonNullable<Awaited<ReturnType<typeof getQuizForAdmin>>>;

/** Aperçu : le quiz tel que le joueur le verra (sans la bonne réponse, propositions dans l'ordre saisi). */
export async function getQuizPreview(quizId: string, db: Db = prisma) {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      title: true,
      instructions: true,
      durationMinutes: true,
      questions: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: {
          id: true,
          prompt: true,
          choices: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: { id: true, label: true },
          },
        },
      },
    },
  });
  if (!quiz) return null;
  const total = quiz.questions.length;
  return {
    id: quiz.id,
    title: quiz.title,
    instructions: quiz.instructions,
    durationMinutes: quiz.durationMinutes,
    questionCount: total,
    questions: quiz.questions.map((q, index) => ({ ...q, number: index + 1, total })),
  };
}

/** Résultats : tentatives classées (score, puis durée) et réussite par question. */
export async function getQuizResults(quizId: string, now: Date = new Date(), db: Db = prisma) {
  const quiz = await db.quiz.findUnique({
    where: { id: quizId },
    select: { id: true, title: true },
  });
  if (!quiz) return null;
  await finalizeStaleAttempts(db, { quizId }, now);
  const attempts = await db.quizAttempt.findMany({
    where: { quizId },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      finishedAt: true,
      score: true,
      maxScore: true,
      user: { select: { firstName: true, lastName: true, memberNumber: true } },
    },
  });
  const finished = attempts.filter((a) => a.finishedAt);
  const ranked = rankAttempts(
    finished.map((a) => ({
      attemptId: a.id,
      userId: a.userId,
      firstName: a.user.firstName,
      lastName: a.user.lastName,
      memberNumber: a.user.memberNumber,
      score: a.score ?? 0,
      maxScore: a.maxScore,
      durationSeconds: durationSeconds(a.startedAt, a.finishedAt!),
      finishedAt: a.finishedAt!,
    })),
  );
  const questions = await db.quizQuestion.findMany({
    where: { quizId },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      id: true,
      prompt: true,
      choices: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { id: true, label: true, isCorrect: true },
      },
      answers: {
        where: { attempt: { finishedAt: { not: null } } },
        select: { choiceId: true, isCorrect: true },
      },
    },
  });
  return {
    quiz,
    finishedCount: finished.length,
    inProgressCount: attempts.length - finished.length,
    attempts: ranked,
    questions: questions.map((q, index) => {
      const correct = q.answers.filter((a) => a.isCorrect).length;
      return {
        id: q.id,
        number: index + 1,
        prompt: q.prompt,
        correct,
        skipped: q.answers.filter((a) => a.choiceId === null).length,
        /** Sans réponse : la tentative s'est terminée avant cette question. */
        unanswered: finished.length - q.answers.length,
        successRate: successRate(correct, finished.length),
        choices: q.choices.map((c) => ({
          id: c.id,
          label: c.label,
          isCorrect: c.isCorrect,
          picks: q.answers.filter((a) => a.choiceId === c.id).length,
        })),
      };
    }),
  };
}
export type QuizResults = NonNullable<Awaited<ReturnType<typeof getQuizResults>>>;

import { randomUUID } from "node:crypto";
import { memberStatus, runInTransaction } from "@/features/gamification/ledger";
import { finalizeLocked, lockOwnAttempt, lockQuiz } from "@/features/quizzes/attempt-core";
import {
  canStillAnswer,
  computeExpiresAt,
  currentQuestion,
  durationSeconds,
  effectiveDeadline,
  isPlayable,
  remainingSeconds,
  shuffleForAttempt,
} from "@/features/quizzes/rules";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Parcours du membre (anti-triche) :
 * - le client ne reçoit jamais `isCorrect` ni le corrigé pendant la tentative (les requêtes ne
 *   sélectionnent même pas la colonne) ; une seule question à la fois, la première sans réponse ;
 * - le chrono est tenu par le serveur (`expiresAt` posé au départ) ;
 * - une réponse ne vaut que pour la question courante, une seule fois, avec une proposition de
 *   cette question ; `isCorrect` est figé au moment de la réponse ;
 * - le score est calculé par le serveur à la fin (explicite, ou automatique).
 */

export type InProgressState = {
  status: "in_progress";
  attemptId: string;
  quizId: string;
  /** Échéance (sans la tolérance réseau). */
  deadline: Date;
  remainingSeconds: number;
  question: {
    id: string;
    /** Numéro affiché, à partir de 1. */
    number: number;
    total: number;
    prompt: string;
    /** Ordre propre à la tentative, stable. Jamais la bonne réponse. */
    choices: { id: string; label: string }[];
  };
};

export type FinishedState = {
  status: "finished";
  attemptId: string;
  quizId: string;
  score: number;
  maxScore: number;
  finishedAt: Date;
  durationSeconds: number;
};

export type PlayState = InProgressState | FinishedState;

const membersOnly = () => new AppError("FORBIDDEN", "Les quiz sont réservés aux membres du club.");

/** Le compte peut jouer : actif, membre (numéro attribué), non archivé. */
export async function assertCanPlay(db: Db, userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!user || user.status !== "ACTIVE" || (await memberStatus(db, userId)) !== "member") {
    throw membersOnly();
  }
}

const orderedQuestions = { orderBy: [{ position: "asc" as const }, { id: "asc" as const }] };

/**
 * Démarre la tentative, ou reprend celle en cours (rechargement de page). Une seule tentative
 * par membre et par quiz : l'unicité en base tranche deux départs simultanés.
 */
export async function startAttempt(
  userId: string,
  quizId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<PlayState> {
  const attemptId = await runInTransaction(db, async (tx) => {
    await assertCanPlay(tx, userId);
    // Verrou partagé : un responsable ne peut pas repasser le quiz en brouillon pendant le départ.
    if (!(await lockQuiz(tx, quizId, "SHARE")))
      throw new AppError("NOT_FOUND", "Quiz introuvable.");
    const quiz = await tx.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        status: true,
        opensAt: true,
        closesAt: true,
        archivedAt: true,
        durationMinutes: true,
        _count: { select: { questions: true } },
      },
    });
    if (quiz.status === "DRAFT") throw new AppError("NOT_FOUND", "Quiz introuvable.");
    const existing = await tx.quizAttempt.findUnique({
      where: { userId_quizId: { userId, quizId } },
      select: { id: true, finishedAt: true },
    });
    if (existing?.finishedAt) throw new AppError("CONFLICT", "Vous avez déjà joué ce quiz.");
    if (existing) return existing.id;
    if (!isPlayable(quiz, now))
      throw new AppError("CONFLICT", "Ce quiz n’est pas ouvert en ce moment.");
    if (quiz._count.questions === 0) throw new AppError("CONFLICT", "Ce quiz n’a pas de question.");
    const id = randomUUID();
    // `ON CONFLICT DO NOTHING` : le second départ simultané attend le premier, puis le reprend.
    const { count } = await tx.quizAttempt.createMany({
      data: [
        {
          id,
          quizId,
          userId,
          startedAt: now,
          expiresAt: computeExpiresAt(now, quiz.durationMinutes, quiz.closesAt),
          maxScore: quiz._count.questions,
        },
      ],
      skipDuplicates: true,
    });
    if (count === 1) return id;
    const other = await tx.quizAttempt.findUniqueOrThrow({
      where: { userId_quizId: { userId, quizId } },
      select: { id: true, finishedAt: true },
    });
    if (other.finishedAt) throw new AppError("CONFLICT", "Vous avez déjà joué ce quiz.");
    return other.id;
  });
  return getPlayState(userId, attemptId, now, db);
}

/**
 * État de la tentative du membre. Termine automatiquement la tentative quand le temps est écoulé
 * (tolérance réseau passée), quand le quiz n'est plus publié, ou quand tout est répondu.
 */
export async function getPlayState(
  userId: string,
  attemptId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<PlayState> {
  return runInTransaction(db, async (tx) => {
    if (!(await lockOwnAttempt(tx, attemptId, userId))) {
      throw new AppError("NOT_FOUND", "Tentative introuvable.");
    }
    const attempt = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
      select: {
        id: true,
        quizId: true,
        startedAt: true,
        expiresAt: true,
        finishedAt: true,
        score: true,
        maxScore: true,
        quiz: { select: { status: true, closesAt: true } },
        answers: { select: { questionId: true } },
      },
    });
    const finished = (score: number, finishedAt: Date): FinishedState => ({
      status: "finished",
      attemptId,
      quizId: attempt.quizId,
      score,
      maxScore: attempt.maxScore,
      finishedAt,
      durationSeconds: durationSeconds(attempt.startedAt, finishedAt),
    });
    if (attempt.finishedAt) return finished(attempt.score ?? 0, attempt.finishedAt);
    const deadline = effectiveDeadline(attempt.expiresAt, attempt.quiz.closesAt);
    const questions = await tx.quizQuestion.findMany({
      where: { quizId: attempt.quizId },
      ...orderedQuestions,
      select: {
        id: true,
        prompt: true,
        // Jamais `isCorrect` : la colonne n'est pas lue.
        choices: { select: { id: true, label: true } },
      },
    });
    const current = currentQuestion(questions, new Set(attempt.answers.map((a) => a.questionId)));
    if (!current || attempt.quiz.status !== "PUBLISHED" || !canStillAnswer(deadline, now)) {
      const result = await finalizeLocked(tx, attemptId, now);
      return finished(result.score, result.finishedAt);
    }
    return {
      status: "in_progress",
      attemptId,
      quizId: attempt.quizId,
      deadline,
      remainingSeconds: remainingSeconds(deadline, now),
      question: {
        id: current.question.id,
        number: current.index + 1,
        total: questions.length,
        prompt: current.question.prompt,
        choices: shuffleForAttempt(attemptId, current.question.choices).map((c) => ({
          id: c.id,
          label: c.label,
        })),
      },
    };
  });
}

export type AnswerOutcome = {
  /** `false` : temps écoulé (la tentative vient d'être terminée), rien n'est enregistré. */
  accepted: boolean;
  /** Prochaine question, ou résultat. Ne dit jamais si la réponse était juste. */
  state: PlayState;
};

/** Répond à la question courante (`choiceId: null` : question passée). */
export async function answerQuestion(
  userId: string,
  input: { attemptId: string; questionId: string; choiceId: string | null },
  now: Date = new Date(),
  db: Db = prisma,
): Promise<AnswerOutcome> {
  const accepted = await runInTransaction(db, async (tx) => {
    if (!(await lockOwnAttempt(tx, input.attemptId, userId))) {
      throw new AppError("NOT_FOUND", "Tentative introuvable.");
    }
    const attempt = await tx.quizAttempt.findUniqueOrThrow({
      where: { id: input.attemptId },
      select: {
        quizId: true,
        expiresAt: true,
        finishedAt: true,
        quiz: { select: { status: true, closesAt: true } },
        answers: { select: { questionId: true } },
      },
    });
    if (attempt.finishedAt) throw new AppError("CONFLICT", "Cette tentative est terminée.");
    const deadline = effectiveDeadline(attempt.expiresAt, attempt.quiz.closesAt);
    if (attempt.quiz.status !== "PUBLISHED" || !canStillAnswer(deadline, now)) {
      await finalizeLocked(tx, input.attemptId, now);
      return false;
    }
    const questions = await tx.quizQuestion.findMany({
      where: { quizId: attempt.quizId },
      ...orderedQuestions,
      select: { id: true },
    });
    const current = currentQuestion(questions, new Set(attempt.answers.map((a) => a.questionId)));
    if (!current) {
      await finalizeLocked(tx, input.attemptId, now);
      return false;
    }
    // Ni saut en avant, ni retour, ni seconde réponse : seule la question courante est recevable.
    if (current.question.id !== input.questionId) {
      throw new AppError("CONFLICT", "Cette question n’est plus la question en cours.");
    }
    let isCorrect = false;
    if (input.choiceId !== null) {
      const choice = await tx.quizChoice.findFirst({
        where: { id: input.choiceId, questionId: input.questionId },
        select: { isCorrect: true },
      });
      if (!choice)
        throw new AppError("VALIDATION", "Cette proposition n’existe pas pour cette question.");
      isCorrect = choice.isCorrect;
    }
    await tx.quizAnswer.create({
      data: {
        attemptId: input.attemptId,
        questionId: input.questionId,
        choiceId: input.choiceId,
        isCorrect,
        answeredAt: now,
      },
    });
    if (current.index + 1 === questions.length) await finalizeLocked(tx, input.attemptId, now);
    return true;
  });
  return { accepted, state: await getPlayState(userId, input.attemptId, now, db) };
}

/** Fin explicite (« Terminer »). Idempotente : une tentative finie renvoie son résultat. */
export async function finishAttempt(
  userId: string,
  attemptId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<FinishedState> {
  await runInTransaction(db, async (tx) => {
    if (!(await lockOwnAttempt(tx, attemptId, userId))) {
      throw new AppError("NOT_FOUND", "Tentative introuvable.");
    }
    await finalizeLocked(tx, attemptId, now);
  });
  const state = await getPlayState(userId, attemptId, now, db);
  if (state.status !== "finished") throw new AppError("INTERNAL");
  return state;
}

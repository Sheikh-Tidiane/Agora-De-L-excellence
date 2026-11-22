import { memberStatus } from "@/features/gamification/ledger";
import { finalizeStaleAttempts } from "@/features/quizzes/attempt-core";
import {
  getPlayState,
  type FinishedState,
  type InProgressState,
} from "@/features/quizzes/attempt-service";
import { correctionVisible, isPlayable, quizPhase, type QuizPhase } from "@/features/quizzes/rules";
import { prisma, type Db } from "@/lib/prisma";

/** Lectures de l'espace membre : liste des quiz, écran de jeu, résultat et corrigé. */

export type MemberQuizAttempt =
  | { status: "in_progress"; attemptId: string; expiresAt: Date }
  | { status: "finished"; attemptId: string; score: number; maxScore: number };

export type MemberQuizItem = {
  id: string;
  slug: string;
  title: string;
  instructions: string | null;
  durationMinutes: number;
  questionCount: number;
  opensAt: Date;
  closesAt: Date;
  phase: Exclude<QuizPhase, "draft">;
  event: { title: string; slug: string; startsAt: Date } | null;
  attempt: MemberQuizAttempt | null;
};

const quizCard = {
  id: true,
  slug: true,
  title: true,
  instructions: true,
  durationMinutes: true,
  opensAt: true,
  closesAt: true,
  status: true,
  archivedAt: true,
  event: { select: { title: true, slug: true, startsAt: true } },
  _count: { select: { questions: true } },
} as const;

/** Quiz ouverts, à venir et terminés (20 plus récents), avec l'état de la tentative du membre. */
export async function listQuizzesForMember(
  userId: string,
  now: Date = new Date(),
  db: Db = prisma,
) {
  await finalizeStaleAttempts(db, { userId }, now);
  const rows = await db.quiz.findMany({
    where: { status: { in: ["PUBLISHED", "CLOSED"] }, archivedAt: null },
    orderBy: [{ closesAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      ...quizCard,
      attempts: {
        where: { userId },
        select: { id: true, expiresAt: true, finishedAt: true, score: true, maxScore: true },
      },
    },
  });
  const items: MemberQuizItem[] = rows.map(
    ({ attempts, _count, status: _s, archivedAt: _a, ...row }) => {
      const attempt = attempts[0];
      return {
        ...row,
        questionCount: _count.questions,
        phase: quizPhase({ ...row, status: _s, archivedAt: _a }, now) as MemberQuizItem["phase"],
        attempt: !attempt
          ? null
          : attempt.finishedAt
            ? {
                status: "finished",
                attemptId: attempt.id,
                score: attempt.score ?? 0,
                maxScore: attempt.maxScore,
              }
            : { status: "in_progress", attemptId: attempt.id, expiresAt: attempt.expiresAt },
      };
    },
  );
  const byOpening = (a: MemberQuizItem, b: MemberQuizItem) =>
    a.opensAt.getTime() - b.opensAt.getTime();
  return {
    open: items
      .filter((q) => q.phase === "open")
      .sort((a, b) => a.closesAt.getTime() - b.closesAt.getTime()),
    upcoming: items.filter((q) => q.phase === "upcoming").sort(byOpening),
    ended: items.filter((q) => q.phase === "ended").slice(0, 20),
  };
}

export type QuizCorrection = {
  number: number;
  prompt: string;
  outcome: "correct" | "wrong" | "skipped" | "unanswered";
  choices: { id: string; label: string; isCorrect: boolean; chosen: boolean }[];
}[];

export type QuizResult = Omit<FinishedState, "status"> & {
  /** `null` tant que le quiz n'est pas terminé pour tous (pas de fuite entre membres). */
  correction: QuizCorrection | null;
};

export type MemberQuizScreen = {
  quiz: Omit<MemberQuizItem, "attempt">;
  view:
    | {
        kind: "intro";
        canStart: boolean;
        /** Pourquoi on ne peut pas commencer. */
        blocker: "members_only" | "upcoming" | "ended" | "no_question" | null;
      }
    | { kind: "playing"; state: InProgressState }
    | { kind: "finished"; result: QuizResult };
};

async function correctionFor(db: Db, attemptId: string, quizId: string): Promise<QuizCorrection> {
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
      answers: { where: { attemptId }, select: { choiceId: true, isCorrect: true } },
    },
  });
  return questions.map((q, index) => {
    const answer = q.answers[0];
    return {
      number: index + 1,
      prompt: q.prompt,
      outcome: !answer
        ? "unanswered"
        : answer.choiceId === null
          ? "skipped"
          : answer.isCorrect
            ? "correct"
            : "wrong",
      choices: q.choices.map((c) => ({ ...c, chosen: answer?.choiceId === c.id })),
    };
  });
}

/** Page d'un quiz pour le membre : présentation, question en cours, ou résultat. `null` : introuvable. */
export async function getMemberQuizScreen(
  userId: string,
  slug: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<MemberQuizScreen | null> {
  const row = await db.quiz.findUnique({ where: { slug }, select: quizCard });
  if (!row || row.status === "DRAFT" || row.archivedAt) return null;
  const { _count, status, archivedAt, ...rest } = row;
  const window = { status, archivedAt, opensAt: row.opensAt, closesAt: row.closesAt };
  const phase = quizPhase(window, now) as MemberQuizItem["phase"];
  const quiz = { ...rest, questionCount: _count.questions, phase };
  const attempt = await db.quizAttempt.findUnique({
    where: { userId_quizId: { userId, quizId: row.id } },
    select: { id: true },
  });
  if (attempt) {
    const state = await getPlayState(userId, attempt.id, now, db);
    if (state.status === "in_progress") return { quiz, view: { kind: "playing", state } };
    const { attemptId, quizId, score, maxScore, finishedAt, durationSeconds } = state;
    const result = { attemptId, quizId, score, maxScore, finishedAt, durationSeconds };
    const correction = correctionVisible(window, now)
      ? await correctionFor(db, attempt.id, row.id)
      : null;
    return { quiz, view: { kind: "finished", result: { ...result, correction } } };
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  const member = user?.status === "ACTIVE" && (await memberStatus(db, userId)) === "member";
  const blocker = !member
    ? "members_only"
    : phase === "upcoming"
      ? "upcoming"
      : !isPlayable(window, now)
        ? "ended"
        : _count.questions === 0
          ? "no_question"
          : null;
  return { quiz, view: { kind: "intro", canStart: blocker === null, blocker } };
}

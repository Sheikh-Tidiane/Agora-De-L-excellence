import { createHash } from "node:crypto";
import { QUIZ_LIMITS } from "@/features/quizzes/schemas";

/**
 * Règles pures des quiz en ligne (docs/REGLES-METIER.md, « Quiz en ligne ») : fenêtre, chrono,
 * tolérance réseau, score, ordre des propositions, classement. Aucune dépendance à la base.
 */
export { QUIZ_LIMITS };

/**
 * Tolérance réseau : une réponse envoyée juste avant la fin du chrono peut arriver un peu après.
 * Elle est acceptée jusqu'à 5 secondes après l'échéance ; au-delà, la tentative se clôt.
 */
export const NETWORK_GRACE_MS = 5_000;

type Window = { status: string; opensAt: Date; closesAt: Date; archivedAt: Date | null };

/** Jouable maintenant : publié, non archivé, entre l'ouverture (incluse) et la fermeture (exclue). */
export function isPlayable(quiz: Window, now: Date): boolean {
  return (
    quiz.status === "PUBLISHED" &&
    !quiz.archivedAt &&
    quiz.opensAt.getTime() <= now.getTime() &&
    now.getTime() < quiz.closesAt.getTime()
  );
}

export type QuizPhase = "draft" | "upcoming" | "open" | "ended";

/** Phase vue par un membre. « ended » : clos, archivé ou fenêtre passée. */
export function quizPhase(quiz: Window, now: Date): QuizPhase {
  if (quiz.status === "DRAFT") return "draft";
  if (quiz.status === "CLOSED" || quiz.archivedAt) return "ended";
  if (now.getTime() < quiz.opensAt.getTime()) return "upcoming";
  if (now.getTime() >= quiz.closesAt.getTime()) return "ended";
  return "open";
}

/** Échéance fixée au début : début + durée, sans dépasser la fermeture du quiz. */
export function computeExpiresAt(startedAt: Date, durationMinutes: number, closesAt: Date): Date {
  const end = startedAt.getTime() + durationMinutes * 60_000;
  return new Date(Math.min(end, closesAt.getTime()));
}

/** Échéance effective : la fermeture du quiz a pu être avancée depuis le début de la tentative. */
export function effectiveDeadline(expiresAt: Date, closesAt: Date): Date {
  return new Date(Math.min(expiresAt.getTime(), closesAt.getTime()));
}

/** Une réponse est encore recevable (tolérance réseau comprise). */
export function canStillAnswer(deadline: Date, now: Date): boolean {
  return now.getTime() <= deadline.getTime() + NETWORK_GRACE_MS;
}

/** Secondes restantes affichées (sans la tolérance), jamais négatives. */
export function remainingSeconds(deadline: Date, now: Date): number {
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

/** Heure de fin enregistrée : jamais après l'échéance (un retour tardif ne rallonge pas la durée). */
export function finishTime(deadline: Date, now: Date): Date {
  return new Date(Math.min(now.getTime(), deadline.getTime()));
}

/** Score : bonnes réponses. Une question passée ou sans réponse compte comme fausse. */
export function scoreOf(answers: readonly { isCorrect: boolean }[]): number {
  return answers.filter((answer) => answer.isCorrect).length;
}

/** Question courante : la première, dans l'ordre, qui n'a pas de réponse. `null` : toutes répondues. */
export function currentQuestion<Q extends { id: string }>(
  orderedQuestions: readonly Q[],
  answeredIds: ReadonlySet<string>,
): { question: Q; index: number } | null {
  const index = orderedQuestions.findIndex((q) => !answeredIds.has(q.id));
  return index === -1 ? null : { question: orderedQuestions[index]!, index };
}

/**
 * Ordre des propositions propre à chaque tentative, stable d'un affichage à l'autre : tri par
 * empreinte (tentative, proposition). Deux membres ne voient pas « la bonne réponse est la B ».
 */
export function shuffleForAttempt<C extends { id: string }>(
  attemptId: string,
  choices: readonly C[],
): C[] {
  const key = (choice: C) => createHash("sha256").update(`${attemptId}:${choice.id}`).digest("hex");
  return choices
    .map((choice) => ({ choice, key: key(choice) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ choice }) => choice);
}

export type QuestionDraft = {
  prompt: string;
  choices: readonly { label: string; isCorrect: boolean }[];
};

/** Problème d'une question, ou `null` si elle est jouable (énoncé, 2 à 6 propositions, une seule bonne). */
export function questionProblem(question: QuestionDraft): string | null {
  if (question.prompt.trim().length === 0) return "L’énoncé est vide.";
  const count = question.choices.length;
  if (count < QUIZ_LIMITS.minChoices || count > QUIZ_LIMITS.maxChoices) {
    return `Il faut de ${QUIZ_LIMITS.minChoices} à ${QUIZ_LIMITS.maxChoices} propositions.`;
  }
  if (question.choices.some((choice) => choice.label.trim().length === 0)) {
    return "Une proposition est vide.";
  }
  const labels = new Set(question.choices.map((c) => c.label.trim().toLocaleLowerCase("fr-FR")));
  if (labels.size !== count) return "Deux propositions sont identiques.";
  const correct = question.choices.filter((choice) => choice.isCorrect).length;
  if (correct !== 1) return "Il faut exactement une bonne réponse.";
  return null;
}

/** Le corrigé n'est montré qu'une fois le quiz terminé pour tous : pas de fuite entre membres. */
export function correctionVisible(quiz: Window, now: Date): boolean {
  return quizPhase(quiz, now) === "ended";
}

export function durationSeconds(startedAt: Date, finishedAt: Date): number {
  return Math.max(0, Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000));
}

export type AttemptStanding = {
  userId: string;
  firstName: string;
  lastName: string;
  score: number;
  durationSeconds: number;
};

const collator = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * Classement d'un quiz : score décroissant, puis durée croissante (à la seconde).
 * Même score et même durée : même rang (« 1, 1, 3 »). Ordre d'affichage stable à égalité.
 */
export function rankAttempts<T extends AttemptStanding>(
  rows: readonly T[],
): (T & { rank: number })[] {
  const sorted = [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      a.durationSeconds - b.durationSeconds ||
      collator.compare(a.firstName, b.firstName) ||
      collator.compare(a.lastName, b.lastName) ||
      (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
  );
  const ranked: (T & { rank: number })[] = [];
  for (const [index, row] of sorted.entries()) {
    const previous = ranked[index - 1];
    const tied =
      previous && previous.score === row.score && previous.durationSeconds === row.durationSeconds;
    ranked.push({ ...row, rank: tied ? previous.rank : index + 1 });
  }
  return ranked;
}

/** Taux de réussite d'une question (0 à 1) ; `null` sans tentative terminée. */
export function successRate(correct: number, finishedAttempts: number): number | null {
  return finishedAttempts === 0 ? null : correct / finishedAttempts;
}

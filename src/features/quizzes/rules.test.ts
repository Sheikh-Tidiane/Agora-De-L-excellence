import { describe, expect, it } from "vitest";
import {
  canStillAnswer,
  computeExpiresAt,
  correctionVisible,
  currentQuestion,
  effectiveDeadline,
  finishTime,
  isPlayable,
  NETWORK_GRACE_MS,
  questionProblem,
  quizPhase,
  rankAttempts,
  remainingSeconds,
  scoreOf,
  shuffleForAttempt,
  successRate,
} from "@/features/quizzes/rules";
import { addQuestionSchema, answerSchema, quizSettingsSchema } from "@/features/quizzes/schemas";

const at = (iso: string) => new Date(iso);
const quiz = (extra: Partial<{ status: string; archivedAt: Date | null }> = {}) => ({
  status: "PUBLISHED",
  archivedAt: null,
  opensAt: at("2026-11-14T10:00:00Z"),
  closesAt: at("2026-11-14T12:00:00Z"),
  ...extra,
});

describe("fenêtre du quiz", () => {
  it("jouable de l'ouverture (incluse) à la fermeture (exclue), publié et non archivé", () => {
    expect(isPlayable(quiz(), at("2026-11-14T09:59:59Z"))).toBe(false);
    expect(isPlayable(quiz(), at("2026-11-14T10:00:00Z"))).toBe(true);
    expect(isPlayable(quiz(), at("2026-11-14T11:59:59Z"))).toBe(true);
    expect(isPlayable(quiz(), at("2026-11-14T12:00:00Z"))).toBe(false);
    expect(isPlayable(quiz({ status: "DRAFT" }), at("2026-11-14T11:00:00Z"))).toBe(false);
    expect(isPlayable(quiz({ status: "CLOSED" }), at("2026-11-14T11:00:00Z"))).toBe(false);
    expect(isPlayable(quiz({ archivedAt: new Date() }), at("2026-11-14T11:00:00Z"))).toBe(false);
  });

  it("phases : brouillon, à venir, ouvert, terminé ; corrigé visible seulement une fois terminé", () => {
    expect(quizPhase(quiz({ status: "DRAFT" }), at("2026-11-14T11:00:00Z"))).toBe("draft");
    expect(quizPhase(quiz(), at("2026-11-14T09:00:00Z"))).toBe("upcoming");
    expect(quizPhase(quiz(), at("2026-11-14T11:00:00Z"))).toBe("open");
    expect(quizPhase(quiz(), at("2026-11-14T12:00:00Z"))).toBe("ended");
    expect(quizPhase(quiz({ status: "CLOSED" }), at("2026-11-14T11:00:00Z"))).toBe("ended");
    expect(correctionVisible(quiz(), at("2026-11-14T11:00:00Z"))).toBe(false);
    expect(correctionVisible(quiz({ status: "CLOSED" }), at("2026-11-14T11:00:00Z"))).toBe(true);
  });
});

describe("chrono tenu par le serveur", () => {
  const closes = at("2026-11-14T12:00:00Z");

  it("échéance = début + durée, sans dépasser la fermeture", () => {
    expect(computeExpiresAt(at("2026-11-14T10:00:00Z"), 5, closes)).toEqual(
      at("2026-11-14T10:05:00Z"),
    );
    expect(computeExpiresAt(at("2026-11-14T11:58:00Z"), 5, closes)).toEqual(closes);
    expect(computeExpiresAt(at("2026-11-14T09:00:00Z"), 180, closes)).toEqual(closes);
  });

  it("une fermeture avancée raccourcit l'échéance", () => {
    expect(effectiveDeadline(at("2026-11-14T10:05:00Z"), at("2026-11-14T10:03:00Z"))).toEqual(
      at("2026-11-14T10:03:00Z"),
    );
  });

  it("tolérance réseau de 5 secondes, pas une de plus", () => {
    const deadline = at("2026-11-14T10:05:00Z");
    expect(NETWORK_GRACE_MS).toBe(5000);
    expect(canStillAnswer(deadline, at("2026-11-14T10:04:59Z"))).toBe(true);
    expect(canStillAnswer(deadline, at("2026-11-14T10:05:05Z"))).toBe(true);
    expect(canStillAnswer(deadline, at("2026-11-14T10:05:05.001Z"))).toBe(false);
  });

  it("temps restant arrondi à la seconde supérieure, jamais négatif", () => {
    const deadline = at("2026-11-14T10:05:00Z");
    expect(remainingSeconds(deadline, at("2026-11-14T10:04:58.500Z"))).toBe(2);
    expect(remainingSeconds(deadline, at("2026-11-14T10:06:00Z"))).toBe(0);
  });

  it("l'heure de fin ne dépasse jamais l'échéance (retour tardif)", () => {
    const deadline = at("2026-11-14T10:05:00Z");
    expect(finishTime(deadline, at("2026-11-15T08:00:00Z"))).toEqual(deadline);
    expect(finishTime(deadline, at("2026-11-14T10:02:00Z"))).toEqual(at("2026-11-14T10:02:00Z"));
  });
});

describe("score et question courante", () => {
  it("bonnes réponses seulement ; passée ou absente = fausse", () => {
    expect(scoreOf([])).toBe(0);
    expect(scoreOf([{ isCorrect: true }, { isCorrect: false }, { isCorrect: true }])).toBe(2);
  });

  it("première question sans réponse, dans l'ordre", () => {
    const qs = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(currentQuestion(qs, new Set())).toEqual({ question: { id: "a" }, index: 0 });
    expect(currentQuestion(qs, new Set(["a"]))).toEqual({ question: { id: "b" }, index: 1 });
    expect(currentQuestion(qs, new Set(["a", "b", "c"]))).toBeNull();
  });

  it("mélange stable par tentative, différent d'une tentative à l'autre", () => {
    const choices = ["c1", "c2", "c3", "c4", "c5", "c6"].map((id) => ({ id }));
    const first = shuffleForAttempt("attempt-1", choices);
    expect(shuffleForAttempt("attempt-1", choices)).toEqual(first);
    expect([...first].sort((a, b) => a.id.localeCompare(b.id))).toEqual(choices);
    const orders = new Set(
      Array.from({ length: 10 }, (_, i) =>
        shuffleForAttempt(`a-${i}`, choices)
          .map((c) => c.id)
          .join(),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("validité d'une question", () => {
  const ok = {
    prompt: "Q ?",
    choices: [
      { label: "A", isCorrect: true },
      { label: "B", isCorrect: false },
    ],
  };
  it("2 à 6 propositions, distinctes, non vides, exactement une bonne", () => {
    expect(questionProblem(ok)).toBeNull();
    expect(questionProblem({ ...ok, prompt: " " })).not.toBeNull();
    expect(questionProblem({ ...ok, choices: [ok.choices[0]!] })).not.toBeNull();
    expect(
      questionProblem({ ...ok, choices: ok.choices.map((c) => ({ ...c, isCorrect: true })) }),
    ).not.toBeNull();
    expect(
      questionProblem({ ...ok, choices: ok.choices.map((c) => ({ ...c, isCorrect: false })) }),
    ).not.toBeNull();
    expect(
      questionProblem({ ...ok, choices: [ok.choices[0]!, { label: "a", isCorrect: false }] }),
    ).not.toBeNull();
  });

  it("le schéma Zod applique les mêmes règles", () => {
    expect(addQuestionSchema.safeParse({ quizId: "q", ...ok, prompt: "Qui ?" }).success).toBe(true);
    expect(
      addQuestionSchema.safeParse({
        quizId: "q",
        prompt: "Qui ?",
        choices: ok.choices.map((c) => ({ ...c, isCorrect: true })),
      }).success,
    ).toBe(false);
  });
});

describe("schémas", () => {
  const base = {
    title: "Quiz",
    instructions: "",
    durationMinutes: "5",
    opensAt: "2026-11-14T10:00",
    closesAt: "2026-11-14T12:00",
  };
  it("durée 1 à 180, fermeture après l'ouverture, champs vides → null", () => {
    const parsed = quizSettingsSchema.parse(base);
    expect(parsed).toMatchObject({
      durationMinutes: 5,
      eventId: null,
      slug: null,
      instructions: null,
    });
    expect(quizSettingsSchema.safeParse({ ...base, durationMinutes: "0" }).success).toBe(false);
    expect(quizSettingsSchema.safeParse({ ...base, durationMinutes: "181" }).success).toBe(false);
    expect(quizSettingsSchema.safeParse({ ...base, closesAt: base.opensAt }).success).toBe(false);
  });
  it("passer une question = `choiceId: null` explicite", () => {
    expect(
      answerSchema.safeParse({ attemptId: "a", questionId: "q", choiceId: null }).success,
    ).toBe(true);
    expect(answerSchema.safeParse({ attemptId: "a", questionId: "q" }).success).toBe(false);
  });
});

describe("classement d'un quiz", () => {
  const row = (userId: string, score: number, durationSeconds: number) => ({
    userId,
    firstName: userId,
    lastName: "X",
    score,
    durationSeconds,
  });
  it("score décroissant, puis durée croissante ; égalité parfaite = même rang (1, 1, 3)", () => {
    const ranked = rankAttempts([
      row("c", 3, 90),
      row("a", 4, 120),
      row("b", 4, 60),
      row("d", 4, 60),
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["b", 1],
      ["d", 1],
      ["a", 3],
      ["c", 4],
    ]);
  });
  it("taux de réussite", () => {
    expect(successRate(0, 0)).toBeNull();
    expect(successRate(3, 4)).toBe(0.75);
  });
});

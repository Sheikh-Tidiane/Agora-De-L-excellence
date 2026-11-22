import { afterAll, describe, expect, it, vi } from "vitest";
import { databaseReachable, inRollback, realPrisma, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const { answerQuestion, finishAttempt, getPlayState, startAttempt } =
  await import("@/features/quizzes/attempt-service");
const { publishQuiz, updateQuiz } = await import("@/features/quizzes/admin-service");
const { closeQuiz, deleteQuiz } = await import("@/features/quizzes/lifecycle-service");
const { addQuestion } = await import("@/features/quizzes/question-service");
const { getQuizRanking } = await import("@/features/quizzes/ranking-service");
const { getQuizResults } = await import("@/features/quizzes/admin-queries");
const { getMemberQuizScreen } = await import("@/features/quizzes/member-queries");
const { measureCriteria } = await import("@/features/gamification/badges-service");

/**
 * Quiz contre la vraie base. Les services ouvrent leurs propres transactions (verrous, unicité) :
 * chaque test crée ses données avec un préfixe unique, nettoyées à la fin — jamais de
 * suppression globale (d'autres tests tournent sur la même base).
 */
const reachable = await databaseReachable();
const PREFIX = `vtquiz-${uniq()}`;
const users: string[] = [];
const quizzes: string[] = [];
const MIN = 60_000;

async function member(
  extra: { memberNumber?: string | null; status?: "ACTIVE" | "SUSPENDED" } = {},
) {
  const u = uniq();
  const user = await realPrisma.user.create({
    data: {
      name: `Quiz ${u}`,
      firstName: "Quiz",
      lastName: `T${u}`,
      email: `${PREFIX}-${u}@test.localhost`,
      status: extra.status ?? "ACTIVE",
      memberNumber: extra.memberNumber === undefined ? `VQ-${u}` : extra.memberNumber,
      // Données validées hors transaction : le nettoyage passe par le préfixe.
      isDemo: false,
    },
  });
  users.push(user.id);
  return user;
}

async function makeQuiz(
  options: {
    status?: "DRAFT" | "PUBLISHED" | "CLOSED";
    opensAt?: Date;
    closesAt?: Date;
    duration?: number;
    questions?: number;
  } = {},
) {
  const now = Date.now();
  const quiz = await realPrisma.quiz.create({
    data: {
      slug: `${PREFIX}-${uniq()}`,
      title: "Quiz de test",
      durationMinutes: options.duration ?? 5,
      opensAt: options.opensAt ?? new Date(now - 60 * MIN),
      closesAt: options.closesAt ?? new Date(now + 60 * MIN),
      status: options.status ?? "PUBLISHED",
      // Données validées hors transaction : le nettoyage passe par le préfixe.
      isDemo: false,
      questions: {
        create: Array.from({ length: options.questions ?? 3 }, (_, position) => ({
          prompt: `Question ${position + 1}`,
          position,
          choices: {
            create: ["Juste", "Faux A", "Faux B"].map((label, index) => ({
              label,
              position: index,
              isCorrect: index === 0,
            })),
          },
        })),
      },
    },
    include: { questions: { orderBy: { position: "asc" }, include: { choices: true } } },
  });
  quizzes.push(quiz.id);
  const correct = (questionId: string) =>
    quiz.questions.find((q) => q.id === questionId)!.choices.find((c) => c.isCorrect)!.id;
  const wrong = (questionId: string) =>
    quiz.questions.find((q) => q.id === questionId)!.choices.find((c) => !c.isCorrect)!.id;
  return { ...quiz, correct, wrong };
}

const inProgress = <S extends { status: string }>(state: S) => {
  if (state.status !== "in_progress") throw new Error(`état inattendu : ${state.status}`);
  return state as Extract<S, { status: "in_progress" }>;
};

afterAll(async () => {
  if (!reachable) return;
  const txIds = (
    await realPrisma.pointTransaction.findMany({
      where: { userId: { in: users } },
      select: { id: true },
    })
  ).map((t) => t.id);
  await realPrisma.pointTransaction.deleteMany({
    where: { userId: { in: users }, reversesId: { not: null } },
  });
  await realPrisma.pointTransaction.deleteMany({ where: { userId: { in: users } } });
  await realPrisma.quizAttempt.deleteMany({ where: { quizId: { in: quizzes } } });
  await realPrisma.quiz.deleteMany({ where: { id: { in: quizzes } } });
  await realPrisma.userBadge.deleteMany({ where: { userId: { in: users } } });
  await realPrisma.notification.deleteMany({ where: { userId: { in: users } } });
  await realPrisma.auditLog.deleteMany({
    where: { entityId: { in: [...quizzes, ...users, ...txIds] } },
  });
  await realPrisma.user.deleteMany({ where: { id: { in: users } } });
});

describe.skipIf(!reachable)("quiz en ligne (base réelle)", () => {
  it("départ : réservé aux membres actifs, quiz publié dans sa fenêtre", async () => {
    const quiz = await makeQuiz();
    const staff = await member({ memberNumber: null });
    const suspended = await member({ status: "SUSPENDED" });
    await expect(startAttempt(staff.id, quiz.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(startAttempt(suspended.id, quiz.id)).rejects.toMatchObject({ code: "FORBIDDEN" });

    const m = await member();
    const draft = await makeQuiz({ status: "DRAFT" });
    await expect(startAttempt(m.id, draft.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const closed = await makeQuiz({ status: "CLOSED" });
    await expect(startAttempt(m.id, closed.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const upcoming = await makeQuiz({ opensAt: new Date(Date.now() + 10 * MIN) });
    await expect(startAttempt(m.id, upcoming.id)).rejects.toMatchObject({ code: "CONFLICT" });
    const past = await makeQuiz({
      opensAt: new Date(Date.now() - 120 * MIN),
      closesAt: new Date(Date.now() - 60 * MIN),
    });
    await expect(startAttempt(m.id, past.id)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await realPrisma.quizAttempt.count({ where: { userId: m.id } })).toBe(0);
  });

  it("échéance fixée par le serveur, bornée par la fermeture ; jamais `isCorrect` côté client", async () => {
    const now = new Date();
    const quiz = await makeQuiz({ closesAt: new Date(now.getTime() + 2 * MIN), duration: 5 });
    const m = await member();
    const state = inProgress(await startAttempt(m.id, quiz.id, now));
    const row = await realPrisma.quizAttempt.findUniqueOrThrow({ where: { id: state.attemptId } });
    expect(row.expiresAt).toEqual(quiz.closesAt);
    expect(row.maxScore).toBe(3);
    expect(state.question).toMatchObject({ number: 1, total: 3, id: quiz.questions[0]!.id });
    expect(state.remainingSeconds).toBe(120);
    const json = JSON.stringify(state);
    expect(json).not.toContain("isCorrect");
    expect(Object.keys(state.question.choices[0]!).sort()).toEqual(["id", "label"]);
    const outcome = await answerQuestion(
      m.id,
      {
        attemptId: state.attemptId,
        questionId: state.question.id,
        choiceId: quiz.correct(state.question.id),
      },
      now,
    );
    expect(JSON.stringify(outcome)).not.toMatch(/isCorrect|correct"/);
  });

  it("une seule tentative, même avec deux départs simultanés ; reprise si en cours", async () => {
    const quiz = await makeQuiz();
    const m = await member();
    const [a, b] = await Promise.all([startAttempt(m.id, quiz.id), startAttempt(m.id, quiz.id)]);
    expect(a.attemptId).toBe(b.attemptId);
    expect(await realPrisma.quizAttempt.count({ where: { userId: m.id, quizId: quiz.id } })).toBe(
      1,
    );
    const again = await startAttempt(m.id, quiz.id);
    expect(again.attemptId).toBe(a.attemptId);
    await finishAttempt(m.id, a.attemptId);
    await expect(startAttempt(m.id, quiz.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("question courante seulement : ni saut, ni retour, ni seconde réponse, ni choix d'une autre question", async () => {
    const quiz = await makeQuiz();
    const m = await member();
    const s1 = inProgress(await startAttempt(m.id, quiz.id));
    const [q1, q2, q3] = quiz.questions.map((q) => q.id) as [string, string, string];
    await expect(
      answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q2, choiceId: quiz.correct(q2) }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q1, choiceId: quiz.correct(q2) }),
    ).rejects.toMatchObject({ code: "VALIDATION" });

    // Deux réponses simultanées à la même question : une seule passe.
    const results = await Promise.allSettled([
      answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q1, choiceId: quiz.correct(q1) }),
      answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q1, choiceId: quiz.correct(q1) }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });

    const s2 = inProgress(await getPlayState(m.id, s1.attemptId));
    expect(s2.question).toMatchObject({ id: q2, number: 2 });
    await expect(
      answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q1, choiceId: quiz.wrong(q1) }),
    ).rejects.toMatchObject({ code: "CONFLICT" });

    // Un autre membre ne touche pas à cette tentative.
    const intruder = await member();
    await expect(
      answerQuestion(intruder.id, { attemptId: s1.attemptId, questionId: q2, choiceId: null }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(getPlayState(intruder.id, s1.attemptId)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    // Passer la question 2, rater la 3 : fin automatique, score 1 sur 3.
    await answerQuestion(m.id, { attemptId: s1.attemptId, questionId: q2, choiceId: null });
    const last = await answerQuestion(m.id, {
      attemptId: s1.attemptId,
      questionId: q3,
      choiceId: quiz.wrong(q3),
    });
    expect(last).toMatchObject({
      accepted: true,
      state: { status: "finished", score: 1, maxScore: 3 },
    });
    const answers = await realPrisma.quizAnswer.findMany({ where: { attemptId: s1.attemptId } });
    expect(answers).toHaveLength(3);
    expect(answers.find((a) => a.questionId === q1)?.isCorrect).toBe(true);
  });

  it("temps écoulé : réponse refusée au-delà de la tolérance, acceptée dans la tolérance", async () => {
    const quiz = await makeQuiz({ duration: 1 });
    const m = await member();
    const start = new Date();
    const s = inProgress(await startAttempt(m.id, quiz.id, start));
    const q1 = s.question.id;
    const inGrace = new Date(start.getTime() + MIN + 3_000);
    const ok = await answerQuestion(
      m.id,
      { attemptId: s.attemptId, questionId: q1, choiceId: quiz.correct(q1) },
      inGrace,
    );
    expect(ok.accepted).toBe(true);
    const q2 = inProgress(ok.state).question.id;
    expect(inProgress(ok.state).remainingSeconds).toBe(0);
    const late = new Date(start.getTime() + MIN + 6_000);
    const refused = await answerQuestion(
      m.id,
      { attemptId: s.attemptId, questionId: q2, choiceId: quiz.correct(q2) },
      late,
    );
    expect(refused).toMatchObject({ accepted: false, state: { status: "finished", score: 1 } });
    expect(await realPrisma.quizAnswer.count({ where: { attemptId: s.attemptId } })).toBe(1);
    const row = await realPrisma.quizAttempt.findUniqueOrThrow({ where: { id: s.attemptId } });
    // L'heure de fin ne dépasse pas l'échéance.
    expect(row.finishedAt).toEqual(row.expiresAt);
  });

  it("fin idempotente, points « quiz terminé » une seule fois (source QUIZ + quiz), badge mesuré", async () => {
    const quiz = await makeQuiz();
    const m = await member();
    const s = inProgress(await startAttempt(m.id, quiz.id));
    await answerQuestion(m.id, {
      attemptId: s.attemptId,
      questionId: s.question.id,
      choiceId: quiz.correct(s.question.id),
    });
    const [a, b] = await Promise.all([
      finishAttempt(m.id, s.attemptId),
      finishAttempt(m.id, s.attemptId),
    ]);
    expect(a).toEqual(b);
    expect(a).toMatchObject({ status: "finished", score: 1, maxScore: 3 });
    await finishAttempt(m.id, s.attemptId);
    const rule = await realPrisma.pointRule.findUnique({ where: { code: "quiz_completed" } });
    const lines = await realPrisma.pointTransaction.findMany({ where: { userId: m.id } });
    const expected = rule && rule.isActive && rule.points > 0 ? 1 : 0;
    expect(lines).toHaveLength(expected);
    if (expected)
      expect(lines[0]).toMatchObject({
        sourceType: "QUIZ",
        sourceId: quiz.id,
        points: rule!.points,
        createdById: null,
      });
    expect((await measureCriteria(m.id, ["QUIZZES_COMPLETED"])).QUIZZES_COMPLETED).toBe(1);
  });

  it("classement du quiz, résultats, corrigé après la fermeture seulement ; clôture termine les tentatives", async () => {
    const quiz = await makeQuiz({ questions: 2 });
    const [fast, slow, playing] = [await member(), await member(), await member()];
    const t0 = new Date();
    for (const [user, offset] of [
      [fast, 10_000],
      [slow, 40_000],
    ] as const) {
      const s = inProgress(await startAttempt(user.id, quiz.id, t0));
      for (const q of quiz.questions) {
        await answerQuestion(
          user.id,
          { attemptId: s.attemptId, questionId: q.id, choiceId: quiz.correct(q.id) },
          new Date(t0.getTime() + offset),
        );
      }
    }
    await startAttempt(playing.id, quiz.id, t0);
    const ranking = await getQuizRanking({
      quizId: quiz.id,
      viewerId: slow.id,
      now: new Date(t0.getTime() + 60_000),
    });
    expect(ranking.top.map((r) => [r.userId, r.rank])).toEqual([
      [fast.id, 1],
      [slow.id, 2],
    ]);
    expect(ranking.viewer).toMatchObject({ rank: 2, score: 2, durationSeconds: 40 });
    expect(ranking.top[0]!.lastNameInitial).toBe("T.");

    const screen = await getMemberQuizScreen(fast.id, quiz.slug);
    expect(screen?.view).toMatchObject({
      kind: "finished",
      result: { score: 2, correction: null },
    });

    const results = await getQuizResults(quiz.id);
    expect(results).toMatchObject({ finishedCount: 2, inProgressCount: 1 });
    expect(results!.questions[0]).toMatchObject({ correct: 2, successRate: 1 });

    const actor = await member();
    expect(await closeQuiz(quiz.id, actor.id)).toEqual({ finalized: 1 });
    const closedRow = await realPrisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
    expect(closedRow.status).toBe("CLOSED");
    expect(closedRow.closedAt).not.toBeNull();
    expect(
      await realPrisma.quizAttempt.count({ where: { quizId: quiz.id, finishedAt: null } }),
    ).toBe(0);
    expect(
      await realPrisma.auditLog.count({ where: { action: "quiz.closed", entityId: quiz.id } }),
    ).toBe(1);

    const after = await getMemberQuizScreen(fast.id, quiz.slug);
    if (after?.view.kind !== "finished") throw new Error("résultat attendu");
    expect(after.view.result.correction).toHaveLength(2);
    expect(after.view.result.correction![0]).toMatchObject({ outcome: "correct" });

    await expect(deleteQuiz(quiz.id)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("après publication avec tentatives : durée figée, titre modifiable", async () => {
    const quiz = await makeQuiz();
    const m = await member();
    await startAttempt(m.id, quiz.id);
    const base = {
      title: "Nouveau titre",
      instructions: null,
      durationMinutes: quiz.durationMinutes,
      opensAt: quiz.opensAt,
      closesAt: quiz.closesAt,
      eventId: null,
      slug: null,
    };
    await expect(updateQuiz(quiz.id, { ...base, durationMinutes: 10 })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await updateQuiz(quiz.id, base);
    expect((await realPrisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).title).toBe(
      "Nouveau titre",
    );
    await expect(
      addQuestion({
        quizId: quiz.id,
        prompt: "Ajout ?",
        choices: [
          { label: "A", isCorrect: true },
          { label: "B", isCorrect: false },
        ],
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("fermeture passée : le corrigé est visible, le quiz ne se rouvre pas", async () => {
    const now = Date.now();
    const quiz = await makeQuiz({
      opensAt: new Date(now - 120 * MIN),
      closesAt: new Date(now - 30 * MIN),
      questions: 1,
    });
    const played = await member();
    await realPrisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        userId: played.id,
        startedAt: new Date(now - 100 * MIN),
        expiresAt: new Date(now - 95 * MIN),
        finishedAt: new Date(now - 96 * MIN),
        score: 1,
        maxScore: 1,
      },
    });
    const screen = await getMemberQuizScreen(played.id, quiz.slug);
    if (screen?.view.kind !== "finished") throw new Error("résultat attendu");
    expect(screen.view.result.correction).not.toBeNull();

    const reopen = {
      title: quiz.title,
      instructions: null,
      durationMinutes: quiz.durationMinutes,
      opensAt: quiz.opensAt,
      closesAt: new Date(now + 60 * MIN),
      eventId: null,
      slug: null,
    };
    await expect(updateQuiz(quiz.id, reopen)).rejects.toMatchObject({ code: "CONFLICT" });
    const after = await realPrisma.quiz.findUniqueOrThrow({ where: { id: quiz.id } });
    expect(after.closesAt.getTime()).toBe(quiz.closesAt.getTime());
    // Le titre reste modifiable.
    await updateQuiz(quiz.id, { ...reopen, closesAt: quiz.closesAt, title: "Titre corrigé" });
  });

  it("propositions : identifiants aléatoires, sans lien avec l'ordre de saisie", async () => {
    const quiz = await makeQuiz({ status: "DRAFT", questions: 0 });
    const { id } = await addQuestion({
      quizId: quiz.id,
      prompt: "Capitale du Sénégal ?",
      choices: [
        { label: "Dakar", isCorrect: true },
        { label: "Thiès", isCorrect: false },
        { label: "Saint-Louis", isCorrect: false },
      ],
    });
    const choices = await realPrisma.quizChoice.findMany({ where: { questionId: id } });
    expect(choices).toHaveLength(3);
    for (const choice of choices) {
      expect(choice.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });

  it("publication : refusée sans question ; sinon notifie les membres actifs et trace (transaction annulée)", async () => {
    const empty = await makeQuiz({ status: "DRAFT", questions: 0 });
    const ready = await makeQuiz({ status: "DRAFT" });
    const m = await member();
    const actor = await member({ memberNumber: null });
    await expect(publishQuiz(empty.id, actor.id)).rejects.toMatchObject({ code: "CONFLICT" });
    await inRollback(async (tx) => {
      const { notified } = await publishQuiz(ready.id, actor.id, new Date(), tx);
      expect(notified).toBeGreaterThan(0);
      expect(await tx.notification.count({ where: { userId: m.id, type: "quiz.published" } })).toBe(
        1,
      );
      expect(await tx.notification.count({ where: { userId: actor.id } })).toBe(0);
      expect(
        await tx.auditLog.count({ where: { action: "quiz.published", entityId: ready.id } }),
      ).toBe(1);
      expect((await tx.quiz.findUniqueOrThrow({ where: { id: ready.id } })).status).toBe(
        "PUBLISHED",
      );
    });
  });
});

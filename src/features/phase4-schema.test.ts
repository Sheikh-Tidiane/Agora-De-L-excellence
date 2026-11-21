import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { demoQuiz } from "../../prisma/demo-data";
import { levelStanding, type LevelRow } from "@/features/gamification/levels";

/**
 * Phase 4 (partie A) : schéma, contraintes écrites à la main, données de départ et suppression
 * des données de démonstration. Les contraintes ont aussi été vérifiées par exécution sur une
 * base vide (voir docs/DECISIONS.md, section 10) ; ici, on s'assure qu'elles restent dans la migration.
 */
const migration = readFileSync(
  "prisma/migrations/20261114120000_phase4_communaute/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");
const seed = readFileSync("prisma/seed.ts", "utf8");

describe("migration phase4_communaute", () => {
  it.each([
    ["EventRegistration_check_in_method", "présence ⇔ méthode de pointage"],
    ["Score_forfeit_zero", "un forfait vaut zéro"],
    ["Reading_completion_requires_finished", "seule une lecture terminée part en validation"],
    ["User_card_version_positive", "version de carte ≥ 1"],
    ["Level_min_points_positive", "seuil de niveau ≥ 0"],
    ["Quiz_duration_range", "durée de 1 à 180 minutes"],
    ["Quiz_window", "fermeture après l'ouverture"],
    ["QuizChoice_one_correct_per_question", "une seule bonne réponse"],
    ["QuizAttempt_expires_after_start", "chrono après le début"],
    ["QuizAttempt_score_range", "score entre 0 et le maximum"],
    ["QuizAttempt_score_when_finished", "score posé à la fin seulement"],
    ["QuizAnswer_skipped_is_wrong", "question passée jamais juste"],
  ])("contient la contrainte %s (%s)", (name) => {
    expect(migration).toContain(`"${name}"`);
  });

  it("une tentative par membre et par quiz, une réponse par question", () => {
    expect(migration).toContain('"QuizAttempt_userId_quizId_key"');
    expect(migration).toContain('"QuizAnswer_attemptId_questionId_key"');
  });

  it("la réponse choisie appartient à la question (clé étrangère composée)", () => {
    expect(migration).toMatch(
      /FOREIGN KEY \("choiceId", "questionId"\) REFERENCES "QuizChoice"\("id", "questionId"\)/,
    );
  });

  it("un quiz déjà joué ne se supprime pas ; un membre ayant joué non plus", () => {
    expect(migration).toMatch(/"QuizAttempt_quizId_fkey".*ON DELETE RESTRICT/);
    expect(migration).toMatch(/"QuizAttempt_userId_fkey".*ON DELETE RESTRICT/);
  });

  it("les présences d'avant la migration sont marquées « manuelles »", () => {
    expect(migration).toMatch(
      /UPDATE "EventRegistration" SET "checkInMethod" = 'MANUAL' WHERE "attendedAt" IS NOT NULL/,
    );
  });

  it("le numéro de série de carte est unique", () => {
    expect(migration).toContain('"User_cardSerial_key"');
  });
});

describe("schéma", () => {
  it.each(["Level", "Quiz", "QuizQuestion", "QuizChoice", "QuizAttempt", "QuizAnswer"])(
    "déclare le modèle %s",
    (model) => {
      expect(schema).toMatch(new RegExp(`^model ${model} \\{`, "m"));
    },
  );

  it("les points de quiz ont leur source, les badges leur critère", () => {
    expect(schema).toMatch(/enum PointSourceType \{[^}]*\bQUIZ\b/);
    expect(schema).toMatch(/enum BadgeCriterion \{[^}]*\bQUIZZES_COMPLETED\b/);
  });

  it("aucune donnée personnelle dans les champs de la carte", () => {
    const user = /^model User \{([\s\S]*?)^\}/m.exec(schema)![1]!;
    expect(user).toMatch(/cardSerial\s+String\?\s+@unique/);
    expect(user).toMatch(/cardVersion\s+Int\s+@default\(1\)/);
  });
});

describe("données de départ", () => {
  it("sème les cinq niveaux aux seuils 0, 100, 300, 700, 1 500", () => {
    const thresholds = [...seed.matchAll(/minPoints: (\d+) \}/g)].map((m) => Number(m[1]));
    expect(thresholds).toEqual([0, 100, 300, 700, 1500]);
  });

  it("sème la règle de points du quiz, notée « à valider par le comité »", () => {
    expect(seed).toMatch(/code: "quiz_completed"[\s\S]{0,200}à valider par le comité/);
  });

  it("le quiz de démonstration : quatre propositions et une seule bonne réponse par question", () => {
    expect(demoQuiz.questions.length).toBeGreaterThanOrEqual(3);
    expect(demoQuiz.durationMinutes).toBeGreaterThanOrEqual(1);
    expect(demoQuiz.durationMinutes).toBeLessThanOrEqual(180);
    for (const question of demoQuiz.questions) {
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.correct).toBeGreaterThanOrEqual(0);
      expect(question.correct).toBeLessThan(4);
    }
    // La bonne réponse n'est pas toujours à la même place.
    expect(new Set(demoQuiz.questions.map((q) => q.correct)).size).toBeGreaterThan(1);
  });
});

describe("niveaux", () => {
  const levels: LevelRow[] = [
    { code: "c", name: "Voix affirmée", minPoints: 300 },
    { code: "a", name: "Esprit curieux", minPoints: 0 },
    { code: "b", name: "Plume en éveil", minPoints: 100 },
  ];

  it("le niveau atteint est le plus haut seuil sans dépasser le total", () => {
    expect(levelStanding(levels, 0).current?.code).toBe("a");
    expect(levelStanding(levels, 99).current?.code).toBe("a");
    expect(levelStanding(levels, 100).current?.code).toBe("b");
    expect(levelStanding(levels, 5000).current?.code).toBe("c");
  });

  it("donne le suivant, ce qui manque et l'avancée", () => {
    expect(levelStanding(levels, 150)).toMatchObject({
      next: { code: "c" },
      remaining: 150,
      progress: 0.25,
    });
    expect(levelStanding(levels, 300)).toMatchObject({ next: null, remaining: 0, progress: 1 });
  });

  it("un total négatif (après corrections) compte comme zéro ; sans niveau défini : rien", () => {
    expect(levelStanding(levels, -40)).toMatchObject({ current: { code: "a" }, remaining: 100 });
    expect(levelStanding([], 50)).toEqual({ current: null, next: null, remaining: 0, progress: 0 });
  });
});

describe("pnpm db:clear-demo", () => {
  it("retire quiz, tentatives et points liés, dans un ordre que les clés étrangères acceptent", async () => {
    const calls: string[] = [];
    const tx = new Proxy(
      {},
      {
        get: (_t, model: string) =>
          new Proxy(
            {},
            {
              get: (_m, method: string) => async (args?: { where?: unknown }) => {
                calls.push(`${model}.${method}`);
                if (method === "count") return 1;
                if (method === "findMany") return [{ id: `${model}-demo` }];
                if (method === "deleteMany") {
                  calls.push(JSON.stringify(args?.where));
                  return { count: 1 };
                }
                return {};
              },
            },
          ),
      },
    );
    const client = { $transaction: (fn: (db: unknown) => unknown) => fn(tx) };
    vi.doMock("@/lib/prisma", () => ({ prisma: client }));
    const { clearDemoData } = await import("@/lib/demo-data");
    const counts = await clearDemoData(client as never);

    expect(counts.quizzes).toBe(1);
    const order = calls.filter((call) => call.endsWith(".deleteMany"));
    const at = (target: string) => order.indexOf(target);
    // Points et tentatives avant les quiz et les membres ; quiz avant les rencontres liées.
    expect(at("pointTransaction.deleteMany")).toBeLessThan(at("quizAttempt.deleteMany"));
    expect(at("quizAttempt.deleteMany")).toBeLessThan(at("quiz.deleteMany"));
    expect(at("quiz.deleteMany")).toBeLessThan(at("event.deleteMany"));
    expect(at("quizAttempt.deleteMany")).toBeLessThan(at("user.deleteMany"));
    // Les points gagnés sur le quiz de démonstration, même par un vrai membre, sont visés.
    const where = calls.join("\n");
    expect(where).toContain('"sourceType":"QUIZ","sourceId":{"in":["quiz-demo"]}');
    expect(where).toContain(
      '"sourceType":"EVENT_ATTENDANCE","sourceId":{"in":["eventRegistration-demo"]}',
    );
    // Les corrections d'abord : elles référencent la ligne corrigée.
    const pointDeletes = calls
      .map((call, i) => (call === "pointTransaction.deleteMany" ? calls[i + 1]! : null))
      .filter(Boolean);
    expect(pointDeletes[0]).toContain('"reverses"');
    expect(calls).toContain("auditLog.create");
    vi.doUnmock("@/lib/prisma");
  });
});

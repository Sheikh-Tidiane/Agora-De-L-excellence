import { describe, expect, it } from "vitest";
import {
  badgeProgress,
  badgesDue,
  canReverse,
  decideAward,
  lastNameInitial,
  monthBounds,
  rankStandings,
  transactionLabel,
  type CriterionCounts,
} from "@/features/gamification/rules";

/** Règles pures du moteur de points et badges (sans base). */

const zero: CriterionCounts = {
  BOOKS_FINISHED: 0,
  REVIEWS_APPROVED: 0,
  EVENTS_ATTENDED: 0,
  DEBATES_ATTENDED: 0,
  TOURNAMENTS_PLAYED: 0,
  TOURNAMENTS_WON: 0,
  TOTAL_POINTS: 0,
  QUIZZES_COMPLETED: 0,
};

describe("decideAward (anti-doublon et nouvelle attribution)", () => {
  it("première attribution : ligne d'origine", () => {
    expect(decideAward([], "r1")).toEqual({ kind: "create_original" });
  });
  it("une ligne active : déjà attribué, quel que soit le nombre d'appels", () => {
    const lines = [{ id: "t1", points: 20, ruleId: "r1", reversed: false }];
    expect(decideAward(lines, "r1")).toEqual({ kind: "already_awarded", transactionId: "t1" });
  });
  it("ligne d'origine corrigée : nouvelle attribution (présence recochée)", () => {
    const lines = [{ id: "t1", points: 20, ruleId: "r1", reversed: true }];
    expect(decideAward(lines, "r1")).toEqual({ kind: "create_regrant" });
  });
  it("nouvelle attribution encore active : déjà attribué", () => {
    const lines = [
      { id: "t1", points: 20, ruleId: "r1", reversed: true },
      { id: "t2", points: 20, ruleId: null, reversed: false },
    ];
    expect(decideAward(lines, "r1")).toEqual({ kind: "already_awarded", transactionId: "t2" });
  });
});

describe("canReverse (corrections)", () => {
  it("une ligne ordinaire se corrige une fois", () => {
    expect(canReverse({ reversesId: null, reversed: false, points: 20 })).toEqual({ ok: true });
    expect(canReverse({ reversesId: null, reversed: false, points: -5 })).toEqual({ ok: true });
  });
  it("jamais l'inverse d'une inverse", () => {
    expect(canReverse({ reversesId: "t1", reversed: false, points: -20 })).toEqual({
      ok: false,
      reason: "is_reversal",
    });
  });
  it("jamais deux inverses", () => {
    expect(canReverse({ reversesId: null, reversed: true, points: 20 })).toEqual({
      ok: false,
      reason: "already_reversed",
    });
  });
});

describe("badges automatiques", () => {
  const badges = [
    { code: "lecteur", criterion: "BOOKS_FINISHED" as const, threshold: 5, isActive: true },
    { code: "debat", criterion: "DEBATES_ATTENDED" as const, threshold: 10, isActive: true },
    { code: "manuel", criterion: "MANUAL" as const, threshold: null, isActive: true },
    { code: "inactif", criterion: "BOOKS_FINISHED" as const, threshold: 1, isActive: false },
    { code: "sans_seuil", criterion: "EVENTS_ATTENDED" as const, threshold: null, isActive: true },
    { code: "seuil_zero", criterion: "EVENTS_ATTENDED" as const, threshold: 0, isActive: true },
  ];

  it("seuil non atteint : rien ; seuil atteint exactement : badge", () => {
    expect(badgesDue(badges, { ...zero, BOOKS_FINISHED: 4 }, new Set())).toEqual([]);
    expect(badgesDue(badges, { ...zero, BOOKS_FINISHED: 5 }, new Set())).toEqual(["lecteur"]);
    expect(badgesDue(badges, { ...zero, BOOKS_FINISHED: 9 }, new Set())).toEqual(["lecteur"]);
  });
  it("jamais un badge déjà obtenu, manuel, inactif ou mal configuré", () => {
    const counts = { ...zero, BOOKS_FINISHED: 50, EVENTS_ATTENDED: 50 };
    expect(badgesDue(badges, counts, new Set(["lecteur"]))).toEqual([]);
  });
  it("avancée mesurable, plafonnée au seuil ; badge manuel sans avancée", () => {
    expect(badgeProgress(badges[0]!, { ...zero, BOOKS_FINISHED: 3 })).toEqual({
      current: 3,
      threshold: 5,
      ratio: 0.6,
    });
    expect(badgeProgress(badges[0]!, { ...zero, BOOKS_FINISHED: 8 })).toEqual({
      current: 5,
      threshold: 5,
      ratio: 1,
    });
    expect(badgeProgress(badges[2]!, zero)).toBeNull();
    expect(badgeProgress(badges[4]!, zero)).toBeNull();
  });
});

describe("classements", () => {
  const row = (userId: string, firstName: string, lastName: string, points: number) => ({
    userId,
    firstName,
    lastName,
    points,
  });

  it("égalités « 1, 1, 3 »", () => {
    const ranked = rankStandings([
      row("u1", "Awa", "Diop", 50),
      row("u2", "Moussa", "Fall", 70),
      row("u3", "Binta", "Sow", 50),
      row("u4", "Cheikh", "Ba", 30),
    ]);
    expect(ranked.map((r) => [r.userId, r.rank])).toEqual([
      ["u2", 1],
      ["u1", 2],
      ["u3", 2],
      ["u4", 4],
    ]);
  });
  it("départage d'affichage stable, indépendant de l'ordre reçu", () => {
    const a = [
      row("u9", "Awa", "Diop", 10),
      row("u1", "Awa", "Diop", 10),
      row("u5", "Ali", "Ka", 10),
    ];
    const order = (rows: typeof a) => rankStandings(rows).map((r) => r.userId);
    expect(order(a)).toEqual(["u5", "u1", "u9"]);
    expect(order([...a].reverse())).toEqual(["u5", "u1", "u9"]);
    expect(rankStandings(a).every((r) => r.rank === 1)).toBe(true);
  });
  it("un total nul ou négatif n'est pas classé", () => {
    expect(rankStandings([row("u1", "Awa", "Diop", 0), row("u2", "Ali", "Ka", -10)])).toEqual([]);
  });
  it("prénom et initiale seulement", () => {
    const [first] = rankStandings([row("u1", "Awa", "  ndiaye", 10)]);
    expect(first).toEqual({
      rank: 1,
      userId: "u1",
      firstName: "Awa",
      lastNameInitial: "N.",
      points: 10,
    });
    expect(JSON.stringify(first)).not.toContain("ndiaye");
    expect(lastNameInitial("")).toBe("");
    expect(lastNameInitial("Élimane")).toBe("É.");
  });
  it("mois calendaire de Dakar (UTC+0)", () => {
    expect(monthBounds(new Date("2026-11-30T23:59:59Z"))).toEqual({
      from: new Date("2026-11-01T00:00:00Z"),
      to: new Date("2026-12-01T00:00:00Z"),
    });
    expect(monthBounds(new Date("2026-12-15T10:00:00Z")).to).toEqual(
      new Date("2027-01-01T00:00:00Z"),
    );
  });
});

describe("libellés de l'historique", () => {
  it("source lisible, correction et ajustement avec leur motif", () => {
    expect(
      transactionLabel({
        sourceType: "READING",
        ruleLabel: "Terminer un livre",
        sourceTitle: "Une si longue lettre",
        reason: null,
      }),
    ).toBe("Terminer un livre · Une si longue lettre");
    expect(
      transactionLabel({
        sourceType: "EVENT_ATTENDANCE",
        ruleLabel: null,
        sourceTitle: null,
        reason: "x",
      }),
    ).toBe("Présence à une rencontre");
    expect(
      transactionLabel({
        sourceType: "CORRECTION",
        ruleLabel: null,
        sourceTitle: null,
        reason: "Erreur de saisie",
      }),
    ).toBe("Correction : Erreur de saisie");
    expect(
      transactionLabel({
        sourceType: "MANUAL",
        ruleLabel: null,
        sourceTitle: null,
        reason: "Animation",
      }),
    ).toBe("Ajustement : Animation");
  });
});

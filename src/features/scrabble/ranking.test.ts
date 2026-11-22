import { describe, expect, it } from "vitest";
import {
  computeRanking,
  winnersOf,
  type RankingMatch,
  type RankingParticipant,
  type RankingScore,
} from "@/features/scrabble/ranking";

const p = (id: string, extra: Partial<RankingParticipant> = {}): RankingParticipant => ({
  id,
  teamId: null,
  withdrawn: false,
  sortKey: id,
  ...extra,
});
const s = (
  roundId: string,
  participantId: string,
  points: number,
  isForfeit = false,
): RankingScore => ({
  roundId,
  participantId,
  points: isForfeit ? 0 : points,
  isForfeit,
});
const m = (id: string, roundId: string, a: string, b: string): RankingMatch => ({
  id,
  roundId,
  participantAId: a,
  participantBId: b,
});

const ranksOf = (result: ReturnType<typeof computeRanking>) =>
  Object.fromEntries(result.standings.map((row) => [row.participantId, row.rank]));

describe("duplicate (cumul des scores)", () => {
  it("classe par cumul, toutes manches confondues", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("a"), p("b"), p("c")],
        scores: [
          s("r1", "a", 400),
          s("r1", "b", 500),
          s("r1", "c", 300),
          s("r2", "a", 450),
          s("r2", "b", 300),
          s("r2", "c", 300),
        ],
      },
      { teams: false },
    );
    expect(result.standings.map((row) => [row.participantId, row.rank, row.totalScore])).toEqual([
      ["a", 1, 850],
      ["b", 2, 800],
      ["c", 3, 600],
    ]);
  });

  it("égalité à deux : 1, 1, 3", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("a"), p("b"), p("c")],
        scores: [s("r1", "a", 500), s("r1", "b", 500), s("r1", "c", 300)],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ a: 1, b: 1, c: 3 });
    expect(winnersOf(result, { teams: false }).sort()).toEqual(["a", "b"]);
  });

  it("ex æquo affichés dans l'ordre du nom, pas de la saisie", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("z", { sortKey: "Ousmane" }), p("y", { sortKey: "Babacar" })],
        scores: [s("r1", "z", 500), s("r1", "y", 500)],
      },
      { teams: false },
    );
    expect(result.standings.map((row) => row.participantId)).toEqual(["y", "z"]);
  });

  it("égalité à trois au milieu : 1, 2, 2, 2, 5", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: ["a", "b", "c", "d", "e"].map((id) => p(id)),
        scores: [
          s("r1", "a", 600),
          s("r1", "b", 400),
          s("r1", "c", 400),
          s("r1", "d", 400),
          s("r1", "e", 100),
        ],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ a: 1, b: 2, c: 2, d: 2, e: 5 });
  });

  it("forfait : 0 point et une défaite", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("a"), p("b")],
        scores: [s("r1", "a", 300), s("r1", "b", 0, true), s("r2", "a", 200), s("r2", "b", 350)],
      },
      { teams: false },
    );
    const b = result.standings.find((row) => row.participantId === "b")!;
    expect(b).toMatchObject({ totalScore: 350, forfeits: 1, losses: 1, played: 2, rank: 2 });
  });
});

describe("classique (victoires, cumul, différentiel)", () => {
  it("victoires d'abord, puis cumul, puis différentiel", () => {
    // r1 : a bat b, c bat d ; r2 : a bat c, b bat d.
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: ["a", "b", "c", "d"].map((id) => p(id)),
        matches: [
          m("m1", "r1", "a", "b"),
          m("m2", "r1", "c", "d"),
          m("m3", "r2", "a", "c"),
          m("m4", "r2", "b", "d"),
        ],
        scores: [
          s("r1", "a", 400),
          s("r1", "b", 350),
          s("r1", "c", 420),
          s("r1", "d", 300),
          s("r2", "a", 380),
          s("r2", "c", 370),
          s("r2", "b", 500),
          s("r2", "d", 200),
        ],
      },
      { teams: false },
    );
    const rows = Object.fromEntries(result.standings.map((r) => [r.participantId, r]));
    expect(rows.a).toMatchObject({ rank: 1, wins: 2, losses: 0, spread: 60 });
    // b et c : une victoire ; b a 850 points, c 790.
    expect(rows.b).toMatchObject({ rank: 2, wins: 1, totalScore: 850 });
    expect(rows.c).toMatchObject({ rank: 3, wins: 1, totalScore: 790 });
    expect(rows.d).toMatchObject({ rank: 4, wins: 0, spread: -420 });
  });

  it("le différentiel départage à victoires et cumul égaux", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: ["a", "b", "c", "d"].map((id) => p(id)),
        matches: [m("m1", "r1", "a", "b"), m("m2", "r1", "c", "d")],
        scores: [s("r1", "a", 400), s("r1", "b", 100), s("r1", "c", 400), s("r1", "d", 300)],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ a: 1, c: 2, d: 3, b: 4 });
  });

  it("égalité parfaite sur les trois critères : même rang", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: ["a", "b", "c", "d"].map((id) => p(id)),
        matches: [m("m1", "r1", "a", "b"), m("m2", "r1", "c", "d")],
        scores: [s("r1", "a", 400), s("r1", "b", 300), s("r1", "c", 400), s("r1", "d", 300)],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ a: 1, c: 1, b: 3, d: 3 });
  });

  it("partie nulle : une demi-victoire chacun", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: [p("a"), p("b")],
        matches: [m("m1", "r1", "a", "b")],
        scores: [s("r1", "a", 350), s("r1", "b", 350)],
      },
      { teams: false },
    );
    expect(result.standings.every((r) => r.wins === 0.5 && r.draws === 1 && r.spread === 0)).toBe(
      true,
    );
    expect(ranksOf(result)).toEqual({ a: 1, b: 1 });
  });

  it("forfait simple : l'adversaire présent gagne, l'absent marque 0", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: [p("a"), p("b")],
        matches: [m("m1", "r1", "a", "b")],
        scores: [s("r1", "a", 0, true), s("r1", "b", 0)],
      },
      { teams: false },
    );
    const rows = Object.fromEntries(result.standings.map((r) => [r.participantId, r]));
    expect(rows.b).toMatchObject({ rank: 1, wins: 1 });
    expect(rows.a).toMatchObject({ rank: 2, wins: 0, losses: 1, forfeits: 1, totalScore: 0 });
  });

  it("double forfait : deux défaites", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: [p("a"), p("b")],
        matches: [m("m1", "r1", "a", "b")],
        scores: [s("r1", "a", 0, true), s("r1", "b", 0, true)],
      },
      { teams: false },
    );
    expect(result.standings.every((r) => r.losses === 1 && r.wins === 0 && r.forfeits === 1)).toBe(
      true,
    );
  });

  it("partie à moitié saisie : ignorée et signalée ; score sans partie : ignoré", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: [p("a"), p("b"), p("c")],
        matches: [m("m1", "r1", "a", "b")],
        scores: [s("r1", "a", 400), s("r1", "c", 999)],
      },
      { teams: false },
    );
    expect(result.incompleteMatches).toEqual(["m1"]);
    expect(result.standings.every((r) => r.rank === null && r.played === 0)).toBe(true);
  });
});

describe("cas particuliers", () => {
  it("participant extérieur : classé comme les autres (le classement ignore le compte)", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("membre"), p("exterieur")],
        scores: [s("r1", "membre", 300), s("r1", "exterieur", 450)],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ exterieur: 1, membre: 2 });
    expect(winnersOf(result, { teams: false })).toEqual(["exterieur"]);
  });

  it("retiré : gardé avec ses manches, signalé, classé après les joueurs non retirés", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("a"), p("b"), p("parti", { withdrawn: true })],
        scores: [s("r1", "a", 300), s("r1", "b", 200), s("r1", "parti", 900)],
      },
      { teams: false },
    );
    expect(
      result.standings.map((r) => [r.participantId, r.rank, r.withdrawn, r.totalScore]),
    ).toEqual([
      ["a", 1, false, 300],
      ["b", 2, false, 200],
      ["parti", 3, true, 900],
    ]);
  });

  it("tournoi sans score : personne n'est classé, aucun vainqueur", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        matches: [],
        participants: [p("a"), p("b")],
        scores: [],
      },
      { teams: false },
    );
    expect(result.standings.every((r) => r.rank === null)).toBe(true);
    expect(winnersOf(result, { teams: false })).toEqual([]);
  });

  it("joueur sans manche : non classé, les autres gardent leur rang", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants: [p("a"), p("absent")],
        scores: [s("r1", "a", 100)],
      },
      { teams: false },
    );
    expect(ranksOf(result)).toEqual({ a: 1, absent: null });
  });
});

describe("équipes", () => {
  const participants = [
    p("a1", { teamId: "A" }),
    p("a2", { teamId: "A" }),
    p("b1", { teamId: "B" }),
    p("b2", { teamId: "B", withdrawn: true }),
  ];

  it("additionne les bilans des joueurs ; vainqueurs = joueurs non retirés de l'équipe 1re", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants,
        scores: [s("r1", "a1", 300), s("r1", "a2", 300), s("r1", "b1", 400), s("r1", "b2", 250)],
      },
      { teams: true },
    );
    expect(result.teams.map((t) => [t.teamId, t.rank, t.totalScore])).toEqual([
      ["B", 1, 650],
      ["A", 2, 600],
    ]);
    expect(winnersOf(result, { teams: true })).toEqual(["b1"]);
  });

  it("équipes ex æquo : chacune 1re, tous leurs joueurs vainqueurs", () => {
    const result = computeRanking(
      {
        rule: "WINS_SCORE_SPREAD",
        classic: true,
        participants: participants.map((x) => ({ ...x, withdrawn: false })),
        matches: [m("m1", "r1", "a1", "b1"), m("m2", "r1", "a2", "b2")],
        scores: [s("r1", "a1", 400), s("r1", "b1", 300), s("r1", "a2", 300), s("r1", "b2", 400)],
      },
      { teams: true },
    );
    expect(result.teams.map((t) => t.rank)).toEqual([1, 1]);
    expect(winnersOf(result, { teams: true }).sort()).toEqual(["a1", "a2", "b1", "b2"]);
  });

  it("équipe sans manche jouée : non classée", () => {
    const result = computeRanking(
      {
        rule: "CUMULATIVE_SCORE",
        classic: false,
        matches: [],
        participants,
        scores: [s("r1", "a1", 300)],
      },
      { teams: true },
    );
    expect(Object.fromEntries(result.teams.map((t) => [t.teamId, t.rank]))).toEqual({
      A: 1,
      B: null,
    });
  });
});

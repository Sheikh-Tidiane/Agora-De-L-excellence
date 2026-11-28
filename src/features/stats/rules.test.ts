import { describe, expect, it } from "vitest";
import { columnGeometry, niceMax } from "@/features/stats/components/charts";
import {
  activityStats,
  attendanceRows,
  attendanceSummary,
  continuousSince,
  inactiveMembers,
  maskRate,
  maskSmall,
  newMembersByMonth,
  parseStatsPeriod,
  parseThreshold,
  partnerView,
  presentByMonth,
  waitlistStats,
  type StatsEvent,
} from "@/features/stats/rules";

const at = (iso: string) => new Date(iso);
const NOW = at("2026-11-28T15:00:00Z");
const reg = (
  status: "CONFIRMED" | "CANCELLED" | "WAITLISTED" | "PENDING",
  extra: { present?: boolean; waited?: boolean; promoted?: boolean } = {},
) => ({
  status,
  attendedAt: extra.present ? at("2026-10-01T18:00:00Z") : null,
  waitlistedAt: extra.waited ? at("2026-09-20T10:00:00Z") : null,
  promotedAt: extra.promoted ? at("2026-09-25T10:00:00Z") : null,
});
const event = (over: Partial<StatsEvent> = {}): StatsEvent => ({
  id: "e1",
  title: "Rendez-vous",
  startsAt: at("2026-10-01T18:00:00Z"),
  type: "RENDEZ_VOUS_LECTURE",
  activities: ["RENDEZ_VOUS_LECTURE"],
  capacity: null,
  registrations: [],
  ratings: [],
  ...over,
});

describe("statistiques : période et seuil", () => {
  it("préréglages, dates libres incluses, dates invalides → 12 mois", () => {
    expect(parseStatsPeriod({ periode: "3m" }, NOW)).toMatchObject({
      du: "2026-08-28",
      au: "2026-11-28",
    });
    expect(parseStatsPeriod({ periode: "annee" }, NOW)).toMatchObject({
      du: "2026-01-01",
      au: "2026-11-28",
    });
    const free = parseStatsPeriod({ du: "2026-03-01", au: "2026-03-31" }, NOW);
    expect(free).toMatchObject({
      preset: "libre",
      from: at("2026-03-01T00:00:00Z"),
      toExcl: at("2026-04-01T00:00:00Z"),
    });
    for (const query of [
      { du: "2026-04-01", au: "2026-03-01" },
      { du: "2026-02-30", au: "2026-03-01" },
      { du: "2010-01-01", au: "2026-03-01" },
      {},
    ]) {
      expect(parseStatsPeriod(query, NOW)).toMatchObject({
        preset: "12m",
        du: "2025-11-28",
        au: "2026-11-28",
      });
    }
  });

  it("seuil d'inactivité : 2 à 26 semaines, 6 par défaut", () => {
    expect(parseThreshold("8")).toBe(8);
    expect(parseThreshold(["2"])).toBe(2);
    for (const bad of ["1", "27", "6.5", "abc", undefined]) expect(parseThreshold(bad)).toBe(6);
  });
});

describe("statistiques : présence et activités", () => {
  const events = [
    event({
      registrations: [
        reg("CONFIRMED", { present: true }),
        reg("CONFIRMED", { present: true }),
        reg("CONFIRMED"),
        reg("CANCELLED"),
        reg("WAITLISTED", { waited: true }),
      ],
      ratings: [5, 4, 4],
    }),
    event({
      id: "e2",
      startsAt: at("2026-11-05T18:00:00Z"),
      type: "GENIES_DU_SOIR",
      activities: ["GENIES_DU_SOIR", "RENDEZ_VOUS_LECTURE"],
      registrations: [reg("CONFIRMED", { present: true })],
    }),
    event({ id: "e3", startsAt: at("2026-11-12T18:00:00Z") }),
  ];

  it("inscrits = confirmés ; taux pondéré et moyenne des taux ; pas de taux sans inscrit", () => {
    const rows = attendanceRows(events);
    expect(rows.map((r) => [r.registered, r.present, r.rate])).toEqual([
      [3, 2, 2 / 3],
      [1, 1, 1],
      [0, 0, null],
    ]);
    expect(attendanceSummary(rows)).toMatchObject({
      events: 3,
      registered: 4,
      present: 3,
      rate: 0.75,
      averageRate: (2 / 3 + 1) / 2,
      averagePresent: 1,
    });
    expect(presentByMonth(rows, at("2026-09-15T00:00:00Z"), at("2026-11-29T00:00:00Z"))).toEqual([
      { month: "2026-09", present: 0, events: 0 },
      { month: "2026-10", present: 2, events: 1 },
      { month: "2026-11", present: 1, events: 2 },
    ]);
  });

  it("rencontre à plusieurs activités : chacune, ou la principale seule ; note à partir de 3 avis", () => {
    const all = activityStats(events, "all");
    expect(all.find((a) => a.code === "RENDEZ_VOUS_LECTURE")).toMatchObject({
      events: 3,
      present: 3,
      ratings: 3,
      averageRating: 4.3,
    });
    expect(all.find((a) => a.code === "GENIES_DU_SOIR")).toMatchObject({
      events: 1,
      present: 1,
      averageRating: null,
    });
    const primary = activityStats(events, "primary");
    expect(primary.find((a) => a.code === "RENDEZ_VOUS_LECTURE")).toMatchObject({
      events: 2,
      present: 2,
    });
    expect(primary.find((a) => a.code === "GENIES_DU_SOIR")).toMatchObject({
      events: 1,
      present: 1,
    });
  });

  it("listes d'attente : rencontres complètes, promues, restées, sorties", () => {
    const result = waitlistStats([
      event({
        capacity: 2,
        registrations: [
          reg("CONFIRMED"),
          reg("CONFIRMED", { waited: true, promoted: true }),
          reg("WAITLISTED", { waited: true }),
          reg("CANCELLED", { waited: true }),
        ],
      }),
      event({ id: "pas-complete", capacity: 10, registrations: [reg("CONFIRMED")] }),
      event({ id: "sans-limite", registrations: [reg("CONFIRMED")] }),
    ]);
    expect(result).toMatchObject({ full: 1, waited: 3, promoted: 1, stayed: 1 });
    expect(result.rows[0]).toMatchObject({ left: 1, confirmed: 2 });
  });
});

describe("statistiques : membres", () => {
  it("nouveaux membres par mois, mois vides compris, hors période ignorés", () => {
    expect(
      newMembersByMonth(
        [
          at("2026-09-02T10:00:00Z"),
          at("2026-11-01T00:00:00Z"),
          at("2026-11-30T00:00:00Z"),
          at("2025-01-01T00:00:00Z"),
        ],
        at("2026-09-01T00:00:00Z"),
        at("2026-11-29T00:00:00Z"),
      ),
    ).toEqual([
      { month: "2026-09", count: 1 },
      { month: "2026-10", count: 0 },
      { month: "2026-11", count: 1 },
    ]);
  });

  it("membres qui ne reviennent plus : au-delà du seuil exactement, jamais venus, les plus anciens d'abord", () => {
    const base = { email: "x@e.test", phone: null, memberNumber: null };
    const limit = new Date(NOW.getTime() - 6 * 7 * 86_400_000);
    const members = [
      { ...base, id: "recent", name: "Récent", memberSince: at("2025-01-01T00:00:00Z") },
      { ...base, id: "juste", name: "Juste au seuil", memberSince: at("2025-01-01T00:00:00Z") },
      { ...base, id: "ancien", name: "Ancien", memberSince: at("2025-01-01T00:00:00Z") },
      { ...base, id: "jamais", name: "Jamais venu", memberSince: at("2026-01-01T00:00:00Z") },
      { ...base, id: "nouveau", name: "Nouveau", memberSince: at("2026-11-20T00:00:00Z") },
    ];
    const last = new Map([
      ["recent", at("2026-11-20T18:00:00Z")],
      ["juste", limit],
      ["ancien", at("2026-05-01T18:00:00Z")],
    ]);
    expect(inactiveMembers(members, last, NOW, 6).map((m) => m.id)).toEqual(["jamais", "ancien"]);
  });
});

describe("statistiques : adhésion en cours", () => {
  const m = (start: string, end: string) => ({ startsAt: at(start), endsAt: at(end) });
  it("renouvellements qui se suivent : depuis la première ; après une interruption : depuis le retour", () => {
    expect(
      continuousSince(
        [
          m("2024-01-01T00:00:00Z", "2025-01-01T00:00:00Z"),
          m("2025-01-01T00:00:00Z", "2026-01-01T00:00:00Z"),
          m("2026-01-01T00:00:00Z", "2027-01-01T00:00:00Z"),
        ],
        NOW,
      ),
    ).toEqual(at("2024-01-01T00:00:00Z"));
    expect(
      continuousSince(
        [
          m("2022-01-01T00:00:00Z", "2023-01-01T00:00:00Z"),
          m("2026-11-20T00:00:00Z", "2027-11-20T00:00:00Z"),
        ],
        NOW,
      ),
    ).toEqual(at("2026-11-20T00:00:00Z"));
    expect(continuousSince([m("2022-01-01T00:00:00Z", "2023-01-01T00:00:00Z")], NOW)).toBeNull();
  });

  it("un membre revenu au club n'est pas relancé, même si sa dernière présence est ancienne", () => {
    const back = {
      id: "retour",
      name: "Retour",
      email: "r@e.test",
      phone: null,
      memberNumber: null,
      memberSince: at("2026-11-20T00:00:00Z"),
    };
    expect(
      inactiveMembers([back], new Map([["retour", at("2024-03-01T18:00:00Z")]]), NOW, 6),
    ).toEqual([]);
  });

  it("dates invalides : repli sur 12 mois, signalé", () => {
    expect(parseStatsPeriod({ du: "2026-02-30", au: "2026-03-01" }, NOW).fallback).toBe(true);
    expect(parseStatsPeriod({}, NOW).fallback).toBe(false);
  });
});

describe("statistiques : version partenaires", () => {
  it("effectifs < 3 masqués, taux sur au moins 5 personnes, aucune donnée personnelle", () => {
    expect([maskSmall(0), maskSmall(2), maskSmall(3)]).toEqual([0, "< 3", 3]);
    expect([maskRate(2, 4), maskRate(4, 5)]).toEqual([null, 0.8]);
    const view = partnerView({
      summary: {
        events: 2,
        registered: 4,
        present: 2,
        rate: 0.5,
        averageRate: 0.5,
        averagePresent: 1,
      },
      byMonth: [{ month: "2026-11", present: 2, events: 2 }],
      activities: [
        {
          code: "RENDEZ_VOUS_LECTURE",
          label: "Rendez-vous lecture",
          events: 2,
          present: 2,
          averagePresent: 1,
          ratings: 0,
          averageRating: null,
        },
      ],
      waitlists: {
        rows: [
          {
            id: "e1",
            title: "Secret",
            startsAt: NOW,
            capacity: 1,
            confirmed: 1,
            waited: 1,
            promoted: 1,
            stayed: 0,
            left: 0,
          },
        ],
        full: 1,
        waited: 1,
        promoted: 1,
        stayed: 0,
      },
      newMembers: 1,
      currentMembers: 40,
    });
    expect(view).toMatchObject({
      present: "< 3",
      rate: null,
      newMembers: "< 3",
      currentMembers: 40,
    });
    const keys = JSON.stringify(view);
    for (const forbidden of ["name", "email", "phone", "title", "Secret", '"id"']) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("statistiques : graphiques", () => {
  it("graduation ronde, barres proportionnelles, valeurs nulles et vides", () => {
    expect([niceMax(0), niceMax(7), niceMax(12), niceMax(48), niceMax(100)]).toEqual([
      1, 10, 20, 50, 100,
    ]);
    const { top, bars } = columnGeometry([0, 5, 10], {
      width: 300,
      height: 100,
      gap: 6,
      maxBar: 24,
    });
    expect(top).toBe(10);
    expect(bars.map((b) => b.height)).toEqual([0, 50, 100]);
    expect(bars.every((b) => b.width === 24)).toBe(true);
    expect(columnGeometry([], { width: 300, height: 100, gap: 6, maxBar: 24 }).bars).toEqual([]);
  });
});

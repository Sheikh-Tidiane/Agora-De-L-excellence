import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  decisionSchema,
  reviewDecisionSchema,
  reviewSchema,
  updateReadingSchema,
} from "@/features/readings/schemas";

/**
 * Lectures et critiques : propriété, validation « livre terminé », modération, points.
 * La base est une petite table en mémoire ; le moteur de points est observé, pas exécuté.
 */
type Row = Record<string, unknown> & { id: string };
const readings = new Map<string, Row>();
const reviews = new Map<string, Row>();

/** Filtre `where` simple : égalité (dates comprises) ou `{ in: [...] }`. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];
    if (expected instanceof Date) return actual instanceof Date && +actual === +expected;
    if (expected && typeof expected === "object" && "in" in expected) {
      return (expected as { in: unknown[] }).in.includes(actual);
    }
    return actual === expected;
  });
}

let clock = Date.parse("2026-11-14T10:00:00.000Z");
const stamp = () => new Date((clock += 1000));

function model(table: Map<string, Row>) {
  return {
    updateMany: vi.fn(async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
      const hits = [...table.values()].filter((row) => matches(row, where));
      for (const row of hits) {
        for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
        row.updatedAt = stamp();
      }
      return { count: hits.length };
    }),
    deleteMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      const hits = [...table.values()].filter((row) => matches(row, where));
      for (const row of hits) table.delete(row.id);
      return { count: hits.length };
    }),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
      if (typeof where.id === "string") return table.get(where.id) ?? null;
      const key = Object.values(where)[0] as { userId: string; bookId: string };
      return (
        [...table.values()].find((r) => r.userId === key.userId && r.bookId === key.bookId) ?? null
      );
    }),
    update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
      const row = table.get(where.id)!;
      for (const [k, v] of Object.entries(data)) if (v !== undefined) row[k] = v;
      return row;
    }),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => table.delete(where.id)),
    upsert: vi.fn(
      async ({
        create,
        update,
        where,
      }: {
        create: Row;
        update: Row;
        where: Record<string, { userId: string; bookId: string }>;
      }) => {
        const key = Object.values(where)[0]!;
        const found = [...table.values()].find(
          (r) => r.userId === key.userId && r.bookId === key.bookId,
        );
        if (found) return Object.assign(found, update, { updatedAt: stamp() });
        const row: Row = { ...create, id: `rv${table.size + 1}`, updatedAt: stamp() };
        table.set(row.id, row);
        return row;
      },
    ),
  };
}

const db = {
  reading: model(readings),
  review: model(reviews),
  auditLog: { create: vi.fn(async () => ({})) },
  book: { findUnique: vi.fn(async () => ({ title: "Une si longue lettre" })) },
};
vi.mock("@/lib/prisma", () => ({
  prisma: { ...db, $transaction: async (fn: (tx: typeof db) => unknown) => fn(db) },
}));
const awardReadingPoints = vi.fn(async () => undefined);
const awardReviewPoints = vi.fn(async () => undefined);
vi.mock("@/features/gamification/service", () => ({ awardReadingPoints, awardReviewPoints }));
const notify = vi.fn(async () => undefined);
vi.mock("@/features/notifications/service", () => ({ notify }));

const service = await import("@/features/readings/service");
const MEMBER = "u-awa";
const OTHER = "u-moussa";
const STAFF = { id: "u-resp" };

beforeEach(() => {
  readings.clear();
  reviews.clear();
  vi.clearAllMocks();
  readings.set("r1", {
    id: "r1",
    userId: MEMBER,
    bookId: "b1",
    status: "READING",
    completionStatus: "NONE",
    startedAt: new Date("2026-11-01"),
  });
});

const update = (data: Partial<Record<string, unknown>> = {}) =>
  updateReadingSchema.parse({
    readingId: "r1",
    status: "FINISHED",
    progress: 100,
    personalNote: "",
    isFavorite: false,
    ...data,
  });
const decision = (id: string, d: "approve" | "reject", note = "") =>
  decisionSchema.parse({ id, decision: d, note: d === "reject" && !note ? "À reprendre." : note });
/** Décision sur une critique, pour la version que le modérateur a sous les yeux. */
const reviewDecision = (id: string, d: "approve" | "reject", version?: Date) =>
  reviewDecisionSchema.parse({
    id,
    decision: d,
    note: d === "reject" ? "À reprendre." : "",
    version: (version ?? (reviews.get(id)!.updatedAt as Date)).toISOString(),
  });

/** Simule un geste concurrent : la ligne change juste après avoir été lue par le service. */
function changeRightAfterRead(table: "reading" | "review", change: (row: Row) => void) {
  db[table].findUnique.mockImplementationOnce(async ({ where }) => {
    const row = (table === "reading" ? readings : reviews).get(where.id as string)!;
    const snapshot = { ...row };
    change(row);
    return snapshot;
  });
}

describe("propriété", () => {
  it("un membre ne modifie, n'envoie ni ne retire la lecture d'un autre", async () => {
    await expect(service.updateReading(OTHER, update())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.submitReadingForValidation(OTHER, "r1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(service.removeReading(OTHER, "r1")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(readings.get("r1")!.status).toBe("READING");
  });
});

describe("validation « livre terminé »", () => {
  it("exige un livre terminé, puis passe en attente", async () => {
    await expect(service.submitReadingForValidation(MEMBER, "r1")).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await service.updateReading(MEMBER, update());
    await service.submitReadingForValidation(MEMBER, "r1");
    expect(readings.get("r1")).toMatchObject({ completionStatus: "PENDING", progress: 100 });
  });

  it("donne les points à la validation, une fois, et verrouille la lecture", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    await service.decideReading(STAFF, decision("r1", "approve"));
    expect(awardReadingPoints).toHaveBeenCalledWith("r1", STAFF.id, expect.anything());
    expect(readings.get("r1")!.completionStatus).toBe("APPROVED");
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        userId: MEMBER,
        type: "reading.validated",
        title: "Lecture validée : Une si longue lettre",
      }),
      { email: true },
    );
    // Deuxième décision : refusée, pas de seconds points.
    await expect(service.decideReading(STAFF, decision("r1", "approve"))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(awardReadingPoints).toHaveBeenCalledTimes(1);
    // Une lecture validée reste terminée et ne se retire pas.
    await expect(
      service.updateReading(MEMBER, update({ status: "READING", progress: 30 })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(service.removeReading(MEMBER, "r1")).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("refuse avec un mot, sans points ; le membre peut redemander", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    await service.decideReading(
      STAFF,
      decision("r1", "reject", "Parlons-en à la prochaine rencontre."),
    );
    expect(awardReadingPoints).not.toHaveBeenCalled();
    expect(readings.get("r1")).toMatchObject({
      completionStatus: "REJECTED",
      validationNote: "Parlons-en à la prochaine rencontre.",
    });
    expect(notify).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "reading.rejected",
        body: expect.stringContaining("Parlons-en à la prochaine rencontre."),
      }),
      { email: true },
    );
    await service.submitReadingForValidation(MEMBER, "r1");
    expect(readings.get("r1")!.completionStatus).toBe("PENDING");
  });

  it("un responsable ne valide pas sa propre lecture", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    await expect(
      service.decideReading({ id: MEMBER }, decision("r1", "approve")),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("valider et refuser en même temps : la seconde décision échoue, pas de lecture refusée payée", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    // Un autre responsable valide pendant que celui-ci refuse.
    changeRightAfterRead("reading", (row) => Object.assign(row, { completionStatus: "APPROVED" }));
    await expect(service.decideReading(STAFF, decision("r1", "reject"))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(readings.get("r1")!.completionStatus).toBe("APPROVED");
  });

  it("le membre quitte « terminé » pendant la validation : pas de points sur une lecture retirée", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    changeRightAfterRead("reading", (row) =>
      Object.assign(row, { status: "READING", completionStatus: "NONE" }),
    );
    await expect(service.decideReading(STAFF, decision("r1", "approve"))).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(awardReadingPoints).not.toHaveBeenCalled();
    expect(readings.get("r1")).toMatchObject({ status: "READING", completionStatus: "NONE" });
  });

  it("validée pendant que le membre la modifie ou la retire : la validation reste", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    changeRightAfterRead("reading", (row) => Object.assign(row, { completionStatus: "APPROVED" }));
    await expect(
      service.updateReading(MEMBER, update({ status: "READING", progress: 40 })),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(readings.get("r1")).toMatchObject({ status: "FINISHED", completionStatus: "APPROVED" });
    // Retrait d'une lecture refusée, validée entre-temps après une nouvelle demande.
    Object.assign(readings.get("r1")!, { completionStatus: "REJECTED" });
    changeRightAfterRead("reading", (row) => Object.assign(row, { completionStatus: "APPROVED" }));
    await expect(service.removeReading(MEMBER, "r1")).rejects.toMatchObject({ code: "CONFLICT" });
    expect(readings.has("r1")).toBe(true);
  });

  it("quitter « terminé » retire la demande en attente", async () => {
    Object.assign(readings.get("r1")!, { status: "FINISHED", completionStatus: "PENDING" });
    await service.updateReading(MEMBER, update({ status: "READING", progress: 60 }));
    expect(readings.get("r1")).toMatchObject({
      status: "READING",
      completionStatus: "NONE",
      progress: 60,
    });
  });
});

describe("critiques", () => {
  const review = reviewSchema.parse({
    bookId: "b1",
    rating: 5,
    content:
      "Une lecture qui m’a accompagné pendant des semaines, et que j’ai envie de partager au club.",
    publishWithFirstName: true,
  });

  it("seulement pour un livre terminé", async () => {
    await expect(service.saveReview(MEMBER, review)).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("approuvée : points ; réécrite : repasse en relecture", async () => {
    readings.get("r1")!.status = "FINISHED";
    await service.saveReview(MEMBER, review);
    const id = [...reviews.keys()][0]!;
    expect(reviews.get(id)!.status).toBe("PENDING");
    await service.decideReview(STAFF, reviewDecision(id, "approve"));
    expect(awardReviewPoints).toHaveBeenCalledWith(id, STAFF.id, expect.anything());
    expect(reviews.get(id)!.status).toBe("APPROVED");
    await service.saveReview(MEMBER, { ...review, rating: 4 });
    expect(reviews.get(id)).toMatchObject({ status: "PENDING", rating: 4, moderatedById: null });
  });

  it("critique réécrite pendant la relecture : la version lue n'approuve pas la nouvelle", async () => {
    readings.get("r1")!.status = "FINISHED";
    await service.saveReview(MEMBER, review);
    const id = [...reviews.keys()][0]!;
    const seen = reviews.get(id)!.updatedAt as Date;
    // Le membre remplace son texte pendant que le modérateur lit l'ancien.
    await service.saveReview(MEMBER, { ...review, content: `${review.content} Texte ajouté.` });
    await expect(
      service.decideReview(STAFF, reviewDecision(id, "approve", seen)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(reviews.get(id)!.status).toBe("PENDING");
    expect(awardReviewPoints).not.toHaveBeenCalled();
    // Même course, mais la réécriture arrive entre la lecture et l'écriture du service.
    const current = reviews.get(id)!.updatedAt as Date;
    changeRightAfterRead("review", (row) => Object.assign(row, { updatedAt: stamp() }));
    await expect(
      service.decideReview(STAFF, reviewDecision(id, "approve", current)),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(reviews.get(id)!.status).toBe("PENDING");
    expect(awardReviewPoints).not.toHaveBeenCalled();
  });

  it("la modération exige la version lue", () => {
    const base = { id: "x", decision: "approve", note: "" };
    expect(reviewDecisionSchema.safeParse(base).success).toBe(false);
    expect(reviewDecisionSchema.safeParse({ ...base, version: "hier" }).success).toBe(false);
    expect(
      reviewDecisionSchema.safeParse({ ...base, version: "2026-11-14T10:00:00.000Z" }).success,
    ).toBe(true);
  });

  it("un refus exige un motif", () => {
    expect(decisionSchema.safeParse({ id: "x", decision: "reject", note: "  " }).success).toBe(
      false,
    );
    expect(decisionSchema.safeParse({ id: "x", decision: "approve", note: "" }).success).toBe(true);
  });
});

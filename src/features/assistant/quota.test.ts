import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  dakarDay,
  nextDakarMidnight,
  quotaKey,
  readQuota,
  refundQuestion,
  reserveQuestion,
} from "@/features/assistant/quota";
import { getAssistantStatus } from "@/features/assistant/queries";
import { databaseReachable, realPrisma, uniq } from "@/test/real-db";

/**
 * Quota quotidien de l'assistant. Les calculs de jour sont purs ; le compteur et la concurrence
 * passent par la vraie base (un `ON CONFLICT … WHERE` ne se simule pas honnêtement). Les tests ne
 * créent et ne suppriment que leurs propres lignes (clés tirées d'identifiants inventés).
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

describe("jour de Dakar", () => {
  it("le jour de Dakar est le jour UTC, y compris juste avant et juste après minuit", () => {
    expect(dakarDay(new Date("2026-11-15T23:59:59.999Z"))).toBe("2026-11-15");
    expect(dakarDay(new Date("2026-11-16T00:00:00.000Z"))).toBe("2026-11-16");
  });

  it("le quota revient au minuit suivant, fin de mois et fin d'année comprises", () => {
    expect(nextDakarMidnight(new Date("2026-11-15T10:00:00Z")).toISOString()).toBe(
      "2026-11-16T00:00:00.000Z",
    );
    expect(nextDakarMidnight(new Date("2026-11-30T23:30:00Z")).toISOString()).toBe(
      "2026-12-01T00:00:00.000Z",
    );
    expect(nextDakarMidnight(new Date("2026-12-31T23:59:59Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
    expect(nextDakarMidnight(new Date("2026-11-16T00:00:00Z")).toISOString()).toBe(
      "2026-11-17T00:00:00.000Z",
    );
  });

  it("la clé ne contient pas l'identifiant en clair et change chaque jour", () => {
    const key = quotaKey("ckmembre000000000000001", "2026-11-15");
    expect(key).not.toContain("ckmembre");
    expect(key.startsWith("assistant.daily:")).toBe(true);
    expect(quotaKey("ckmembre000000000000001", "2026-11-16")).not.toBe(key);
  });

  it("limite nulle : refus sans toucher à la base", async () => {
    const result = await reserveQuestion("personne", 0, new Date("2026-11-15T10:00:00Z"));
    expect(result).toMatchObject({ allowed: false, remaining: 0 });
  });
});

const reachable = await databaseReachable();

describe.skipIf(!reachable)("compteur en base", () => {
  const users: string[] = [];
  const NOW = new Date("2026-11-15T10:00:00Z");
  const newUser = () => {
    const id = `test-assistant-${uniq()}`;
    users.push(id);
    return id;
  };

  beforeAll(async () => {
    await realPrisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    const days = ["2026-11-14", "2026-11-15", "2026-11-16"];
    const keys = users.flatMap((user) => days.map((day) => quotaKey(user, day)));
    await realPrisma.rateLimit.deleteMany({ where: { key: { in: keys } } });
  });

  it("compte les questions jusqu'à la limite, puis refuse", async () => {
    const user = newUser();
    const first = await reserveQuestion(user, 3, NOW);
    expect(first).toMatchObject({ allowed: true, used: 1, remaining: 2, day: "2026-11-15" });
    expect(first.resetsAt.toISOString()).toBe("2026-11-16T00:00:00.000Z");
    await reserveQuestion(user, 3, NOW);
    expect(await reserveQuestion(user, 3, NOW)).toMatchObject({
      allowed: true,
      used: 3,
      remaining: 0,
    });
    expect(await reserveQuestion(user, 3, NOW)).toMatchObject({
      allowed: false,
      used: 3,
      remaining: 0,
    });
    expect(await readQuota(user, 3, NOW)).toMatchObject({ used: 3, remaining: 0 });
  });

  it("un nouveau jour (minuit à Dakar) remet le quota à zéro", async () => {
    const user = newUser();
    await reserveQuestion(user, 1, new Date("2026-11-15T23:59:59Z"));
    expect((await reserveQuestion(user, 1, new Date("2026-11-15T23:59:59Z"))).allowed).toBe(false);
    expect(await reserveQuestion(user, 1, new Date("2026-11-16T00:00:01Z"))).toMatchObject({
      allowed: true,
      day: "2026-11-16",
    });
  });

  it("chaque membre a son propre compteur", async () => {
    const a = newUser();
    const b = newUser();
    await reserveQuestion(a, 1, NOW);
    expect((await reserveQuestion(a, 1, NOW)).allowed).toBe(false);
    expect((await reserveQuestion(b, 1, NOW)).allowed).toBe(true);
  });

  it("une question rendue redevient disponible ; le compteur ne descend pas sous zéro", async () => {
    const user = newUser();
    await reserveQuestion(user, 2, NOW);
    await reserveQuestion(user, 2, NOW);
    await refundQuestion(user, "2026-11-15");
    expect(await readQuota(user, 2, NOW)).toMatchObject({ used: 1, remaining: 1 });
    await refundQuestion(user, "2026-11-15");
    await refundQuestion(user, "2026-11-15");
    expect(await readQuota(user, 2, NOW)).toMatchObject({ used: 0, remaining: 2 });
    // Rendre une question d'un membre sans compteur ne crée rien.
    const ghost = newUser();
    await refundQuestion(ghost, "2026-11-15");
    expect(
      await realPrisma.rateLimit.count({ where: { key: quotaKey(ghost, "2026-11-15") } }),
    ).toBe(0);
  });

  it("concurrence : deux requêtes simultanées au dernier crédit, une seule passe", async () => {
    const user = newUser();
    const limit = 5;
    for (let i = 0; i < limit - 1; i++) await reserveQuestion(user, limit, NOW);
    const results = await Promise.all([
      reserveQuestion(user, limit, NOW),
      reserveQuestion(user, limit, NOW),
    ]);
    expect(results.filter((result) => result.allowed)).toHaveLength(1);
    expect(await readQuota(user, limit, NOW)).toMatchObject({ used: limit, remaining: 0 });
  });

  it("concurrence : une rafale de vingt requêtes sur un quota de six en laisse passer six", async () => {
    const user = newUser();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => reserveQuestion(user, 6, NOW)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(6);
    const counts = results
      .filter((r) => r.allowed)
      .map((r) => r.used)
      .sort((x, y) => x - y);
    expect(counts).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("aucun contenu ni identifiant en clair n'est stocké", async () => {
    const user = newUser();
    await reserveQuestion(user, 5, NOW);
    const row = await realPrisma.rateLimit.findUnique({
      where: { key: quotaKey(user, "2026-11-15") },
    });
    expect(row).not.toBeNull();
    expect(JSON.stringify(row)).not.toContain(user);
    expect(row!.expiresAt.toISOString()).toBe("2026-11-17T00:00:00.000Z");
  });

  it("getAssistantStatus : état sans appeler le modèle (non connecté dans les tests)", async () => {
    const user = newUser();
    await reserveQuestion(user, 20, NOW);
    await reserveQuestion(user, 20, NOW);
    expect(await getAssistantStatus(user, NOW)).toEqual({
      connected: false,
      dailyLimit: 20,
      usedToday: 2,
      remaining: 18,
      resetsAt: new Date("2026-11-16T00:00:00.000Z"),
    });
    expect(await getAssistantStatus(newUser(), NOW)).toMatchObject({ usedToday: 0, remaining: 20 });
  });
});

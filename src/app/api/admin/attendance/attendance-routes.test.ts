import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as scan } from "@/app/api/admin/attendance/scan/route";
import { POST as search } from "@/app/api/admin/attendance/search/route";
import {
  ROLE_CODES,
  businessTargets,
  resetWorld,
  roleHasAny,
  world,
} from "@/test/security-harness";

/**
 * Route Handlers du scan des présences : 401 sans session, 403 sans `attendance.record`,
 * 422 sur une entrée invalide, 429 au-delà de la limite. Un jeton forgé est refusé
 * avant toute lecture en base (signature vérifiée d'abord). Session et base : security-harness.
 */
vi.mock("next/headers", async () => (await import("@/test/security-harness")).headersModule);
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/auth", async () => (await import("@/test/security-harness")).authModule);
vi.mock("@/lib/prisma", async () => (await import("@/test/security-harness")).prismaModule);

beforeEach(() => {
  resetWorld();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
/** Jeton bien formé mais signé avec une autre clé. */
const FORGED = "A1.AAAAAAAAAAAAAAAA.1.AAAAAAAAAAAAAAAAAAAAAA";

const post = (handler: (request: Request) => Promise<Response>, body: unknown, raw = false) =>
  handler(
    new Request("http://localhost/api/admin/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? (body as string) : JSON.stringify(body),
    }),
  );

describe("POST /api/admin/attendance/scan", () => {
  const valid = { mode: "token", eventId: ID, token: FORGED, paid: true };

  it("sans session : 401, ni base ni compteur", async () => {
    const response = await post(scan, valid);
    expect(response.status).toBe(401);
    expect(businessTargets()).toEqual([]);
    expect(world.rateLimitHits).toBe(0);
  });

  it.each(ROLE_CODES)("rôle %s", async (role) => {
    world.role = role;
    const response = await post(scan, valid);
    if (roleHasAny(role, ["attendance.record"])) {
      expect(response.status).toBe(200);
      const body = (await response.json()) as { ok: boolean; reason: string };
      expect(body.ok).toBe(false);
      expect(["bad_signature", "malformed"]).toContain(body.reason);
    } else {
      expect(response.status).toBe(403);
      expect(world.rateLimitHits).toBe(0);
    }
    // Jeton forgé : rien n'est lu ni écrit en base, quel que soit le rôle.
    expect(businessTargets()).toEqual([]);
  });

  it.each([
    ["corps qui n'est pas du JSON", "eventId=1", true],
    ["mode inconnu", { ...valid, mode: "id" }, false],
    ["mode manquant", { eventId: ID, token: FORGED, paid: false }, false],
    ["eventId vide", { ...valid, eventId: "" }, false],
    ["eventId trop long", { ...valid, eventId: "x".repeat(41) }, false],
    ["eventId : objet", { ...valid, eventId: { not: "" } }, false],
    ["jeton vide", { ...valid, token: "  " }, false],
    ["jeton : objet", { ...valid, token: { contains: "A1" } }, false],
    ["jeton géant", { ...valid, token: "A".repeat(201) }, false],
    ["payé : chaîne", { ...valid, paid: "true" }, false],
    ["membre sans userId", { mode: "member", eventId: ID, paid: false }, false],
    ["membre : userId tableau", { mode: "member", eventId: ID, userId: [ID], paid: false }, false],
  ])("%s : 422, rien en base", async (_label, body, raw) => {
    world.role = "admin";
    const response = await post(scan, body, raw);
    expect(response.status).toBe(422);
    expect(businessTargets()).toEqual([]);
  });

  it("limite de débit atteinte : 429", async () => {
    world.role = "admin";
    world.rateLimited = true;
    const response = await post(scan, valid);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(businessTargets()).toEqual([]);
  });
});

describe("POST /api/admin/attendance/search", () => {
  it("sans session : 401", async () => {
    expect((await post(search, { eventId: ID, q: "diop" })).status).toBe(401);
    expect(businessTargets()).toEqual([]);
  });

  it.each(ROLE_CODES)("rôle %s", async (role) => {
    world.role = role;
    world.handlers["eventRegistration.findMany"] = () => [];
    const response = await post(search, { eventId: ID, q: "diop" });
    if (roleHasAny(role, ["attendance.record"])) {
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, matches: [] });
      const query = world.calls[0]!.args[0] as { where: { eventId: string; status: string } };
      expect(query.where).toMatchObject({ eventId: ID, status: "CONFIRMED" });
    } else {
      expect(response.status).toBe(403);
      expect(businessTargets()).toEqual([]);
    }
  });

  it.each([
    ["recherche d'un caractère", { eventId: ID, q: "a" }],
    ["recherche trop longue", { eventId: ID, q: "a".repeat(61) }],
    ["recherche : objet", { eventId: ID, q: { contains: "" } }],
    ["eventId manquant", { q: "diop" }],
  ])("%s : 422", async (_label, body) => {
    world.role = "admin";
    expect((await post(search, body)).status).toBe(422);
    expect(businessTargets()).toEqual([]);
  });
});

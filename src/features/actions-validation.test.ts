import { beforeEach, describe, expect, it, vi } from "vitest";
import { userRolesSchema } from "@/features/auth/roles-schemas";
import { eventSchema } from "@/features/events/schemas";
import { membershipRequestSchema } from "@/features/memberships/schemas";
import { clubSettingsSchema, defaultClubSettings } from "@/features/settings/schemas";
import { ID, eventValid, notObjects, protectedCases, withProto } from "@/test/security-cases";
import { businessTargets, cacheWrites, resetWorld, world } from "@/test/security-harness";
import { membershipValid, publicCases } from "@/test/security-public-cases";

/**
 * Critère 9 de la recette : des saisies mal formées envoyées directement aux Server Actions,
 * validation du navigateur contournée. Les actions protégées sont appelées par un
 * super-administrateur : seul le schéma Zod du serveur peut refuser.
 */
vi.mock("next/headers", async () => (await import("@/test/security-harness")).headersModule);
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/auth", async () => (await import("@/test/security-harness")).authModule);
vi.mock("@/lib/prisma", async () => (await import("@/test/security-harness")).prismaModule);

beforeEach(() => {
  resetWorld();
  cacheWrites.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const cases = (invalid: Record<string, unknown>) => Object.entries({ ...notObjects, ...invalid });

describe.each(protectedCases)("saisie mal formée : $key", (action) => {
  it.each(cases(action.invalid))("%s → VALIDATION, aucune écriture", async (_label, input) => {
    world.role = "super_admin";
    const result = await action.run(input);
    expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
    // Seule la lecture des droits a eu lieu : ni lecture métier, ni écriture, ni cache invalidé.
    expect(world.accessLoads).toBe(1);
    expect(businessTargets()).toEqual([]);
    expect(cacheWrites).toEqual([]);
  });

  it("le refus d'accès passe avant la validation : rien n'est dit de l'entrée sans session", async () => {
    const result = await action.run(null);
    expect(result).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(result).not.toHaveProperty("fieldErrors");
  });
});

describe.each(publicCases)("saisie mal formée : $key", (action) => {
  it.each(cases(action.invalid))(
    "%s → VALIDATION, ni compteur de débit, ni base, ni compte",
    async (_label, input) => {
      const result = await action.run(input);
      expect(result).toMatchObject({ ok: false, code: "VALIDATION" });
      expect(world.rateLimitHits).toBe(0);
      expect(businessTargets()).toEqual([]);
      expect(world.authCalls).toEqual([]);
    },
  );
});

describe("ce que les schémas laissent passer", () => {
  it("les propriétés en trop (`__proto__`, champs glissés) sont retirées, sans polluer les prototypes", () => {
    const parsed = membershipRequestSchema.parse(
      withProto(membershipValid, { status: "APPROVED", memberNumber: "AE-2026-0001" }),
    );
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(membershipValid).sort());
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it("rôles en double : dédoublonnés, pas d'erreur interne à l'écriture", () => {
    const parsed = userRolesSchema.parse({ userId: ID, roles: ["admin", "member", "admin"] });
    expect(parsed.roles).toEqual(["admin", "member"]);
  });

  it("fin d'une rencontre : vide = pas de fin ; illisible = refusée, jamais ignorée en silence", () => {
    expect(eventSchema.parse(eventValid).endsAt).toBeNull();
    expect(eventSchema.parse({ ...eventValid, endsAt: "2027-01-10T18:00" }).endsAt).toEqual(
      new Date("2027-01-10T18:00:00Z"),
    );
    const refused = eventSchema.safeParse({ ...eventValid, endsAt: "18 h" });
    expect(refused.success).toBe(false);
  });

  it("réglages numériques : chiffres seulement ; vide, null, booléen ou tableau ne valent pas 0", () => {
    const parse = (value: unknown) =>
      clubSettingsSchema.safeParse({ ...defaultClubSettings, membershipCardFee: value });
    expect(parse("1500").data?.membershipCardFee).toBe(1500);
    expect(parse(" 1500 ").data?.membershipCardFee).toBe(1500);
    expect(parse(0).data?.membershipCardFee).toBe(0);
    for (const value of [
      "",
      "  ",
      null,
      undefined,
      true,
      false,
      [],
      ["5"],
      {},
      "1e3",
      "0x10",
      "12.5",
      -1,
      1.5,
      NaN,
    ]) {
      expect(parse(value).success, JSON.stringify(value)).toBe(false);
    }
  });
});

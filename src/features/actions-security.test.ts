import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { signOutAction } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/permissions";
import { protectedCases } from "@/test/security-cases";
import {
  ROLE_CODES,
  businessTargets,
  cacheWrites,
  resetWorld,
  roleHasAny,
  world,
} from "@/test/security-harness";
import { publicCases, signOutKey } from "@/test/security-public-cases";

/**
 * Critère 8 de la recette : le refus des Server Actions elles-mêmes, provoqué pour chaque rôle.
 * Session et base sont simulées au plus bas niveau (src/test/security-harness.ts) : c'est le vrai
 * `requirePermission` qui décide, et tout accès à la base autre que la lecture des droits est compté.
 */
vi.mock("next/headers", async () => (await import("@/test/security-harness")).headersModule);
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/auth", async () => (await import("@/test/security-harness")).authModule);
vi.mock("@/lib/prisma", async () => (await import("@/test/security-harness")).prismaModule);

beforeEach(() => {
  resetWorld();
  cacheWrites.length = 0;
  // Les erreurs « base non prévue » des cas autorisés sont journalisées : inutile de les afficher.
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const codeOf = (result: { ok: boolean; code?: string }) => (result.ok ? "OK" : result.code);
const REFUSALS = ["UNAUTHENTICATED", "FORBIDDEN"];

describe("simulation de la session", () => {
  it("ne mémorise pas l'utilisateur d'un cas à l'autre (`cache` de React)", async () => {
    expect(await getCurrentUser()).toBeNull();
    world.role = "library";
    expect((await getCurrentUser())?.roles).toEqual(["library"]);
    world.role = "admin";
    expect((await getCurrentUser())?.permissions).toContain("members.manage");
    world.role = null;
    expect(await getCurrentUser()).toBeNull();
  });
});

describe("liste des Server Actions", () => {
  /** Fichiers dont la première instruction est "use server". */
  function serverFiles(dir: string, found: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== "generated") serverFiles(full, found);
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        if (/^\s*["']use server["']/.test(readFileSync(full, "utf8"))) {
          found.push(full.split(path.sep).join("/"));
        }
      }
    }
    return found;
  }

  it("chaque fonction exportée d'un fichier « use server » est dans la matrice ou déclarée publique", async () => {
    const files = serverFiles("src");
    expect(files.length).toBeGreaterThan(0);
    const exported: string[] = [];
    for (const file of files) {
      const specifier = file.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
      const mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
      for (const [name, value] of Object.entries(mod)) {
        if (typeof value === "function") exported.push(`${file}#${name}`);
      }
    }
    const covered = [
      ...protectedCases.map((c) => c.key),
      ...publicCases.map((c) => c.key),
      signOutKey,
    ];
    expect(new Set(covered).size).toBe(covered.length);
    expect(exported.sort()).toEqual(covered.sort());
  });

  it("aucune directive « use server » en ligne, hors de ces fichiers", () => {
    const inline: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "generated") scan(full);
        } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const source = readFileSync(full, "utf8");
          if (/^\s+["']use server["']/m.test(source.replace(/^\s*["']use server["'];?/, ""))) {
            inline.push(full);
          }
        }
      }
    };
    scan("src");
    expect(inline).toEqual([]);
  });
});

describe.each(protectedCases)("contrôle d'accès : $key", (action) => {
  it("sans session : UNAUTHENTICATED, aucun accès à la base", async () => {
    const result = await action.run(action.valid);
    expect(codeOf(result)).toBe("UNAUTHENTICATED");
    expect(world.accessLoads).toBe(0);
    expect(businessTargets()).toEqual([]);
    expect(world.rateLimitHits).toBe(0);
    expect(cacheWrites).toEqual([]);
  });

  it("compte suspendu, même super-administrateur : UNAUTHENTICATED", async () => {
    world.role = "super_admin";
    world.status = "SUSPENDED";
    const result = await action.run(action.valid);
    expect(codeOf(result)).toBe("UNAUTHENTICATED");
    expect(businessTargets()).toEqual([]);
  });

  it.each(ROLE_CODES)("rôle %s", async (role) => {
    world.role = role;
    const allowed = action.allow === "session" || roleHasAny(role, action.allow);
    const result = await action.run(action.valid);
    if (allowed) {
      // Le contrôle est passé : l'entrée valide est acceptée et l'action va jusqu'à la base.
      expect([...REFUSALS, "VALIDATION"]).not.toContain(codeOf(result));
    } else {
      expect(codeOf(result)).toBe("FORBIDDEN");
      // Seule la lecture des droits de l'utilisateur a eu lieu.
      expect(world.accessLoads).toBe(1);
      expect(businessTargets()).toEqual([]);
      expect(cacheWrites).toEqual([]);
    }
  });

  it("super-administrateur : l'action atteint bien la base (la matrice ne passe pas à vide)", async () => {
    world.role = "super_admin";
    await action.run(action.valid);
    expect(businessTargets().length).toBeGreaterThan(0);
  });
});

describe.each(publicCases)("action publique : $key", (action) => {
  it("limite de débit dépassée : RATE_LIMITED avant tout accès aux comptes ou à la base", async () => {
    world.rateLimited = true;
    const result = await action.run(action.valid);
    expect(codeOf(result)).toBe("RATE_LIMITED");
    expect(world.rateLimitHits).toBeGreaterThan(0);
    expect(businessTargets()).toEqual([]);
    expect(world.authCalls).toEqual([]);
  });

  it("sous la limite : le débit est compté avant le premier accès métier", async () => {
    const result = await action.run(action.valid);
    expect(world.rateLimitHits).toBeGreaterThan(0);
    expect(codeOf(result)).not.toBe("VALIDATION");
  });
});

describe("déconnexion", () => {
  it("ferme la session et redirige vers la connexion, sans toucher à la base", async () => {
    await expect(signOutAction()).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(world.authCalls).toEqual(["signOut"]);
    expect(businessTargets()).toEqual([]);
  });
});

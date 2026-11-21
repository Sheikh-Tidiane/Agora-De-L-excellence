import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/permissions/catalog";

/**
 * Phase 6 : chaque page des zones protégées vérifie l'accès côté serveur. Masquer un lien ne
 * suffit jamais (CLAUDE.md §4) : une page ajoutée sans `requirePageAccess` fait échouer ce test.
 */
function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pages(path);
    return name === "page.tsx" ? [path] : [];
  });
}

const guard = /requirePageAccess\(\s*"([a-z._]+)"/g;

describe.each([
  ["src/app/admin", "admin"],
  ["src/app/member", "member"],
] as const)("pages de %s", (dir, zone) => {
  const files = pages(dir);

  it("existent", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files)("%s vérifie l'accès avec une permission du catalogue", (file) => {
    const source = readFileSync(file, "utf8");
    const permissions = [...source.matchAll(guard)].map((match) => match[1]!);
    expect(permissions.length, 'aucun requirePageAccess("…")').toBeGreaterThan(0);
    for (const permission of permissions) {
      expect(Object.keys(PERMISSIONS)).toContain(permission);
      // L'espace membre n'ouvre qu'avec member.access ; l'administration jamais avec lui.
      if (zone === "member") expect(permission).toBe("member.access");
      else expect(permission).not.toBe("member.access");
    }
  });
});

it("les deux layouts protégés vérifient aussi l'accès", () => {
  expect(readFileSync("src/app/admin/layout.tsx", "utf8")).toMatch(
    /requirePageAccess\(\s*"admin\.access"/,
  );
  expect(readFileSync("src/app/member/layout.tsx", "utf8")).toMatch(
    /requirePageAccess\(\s*"member\.access"/,
  );
});

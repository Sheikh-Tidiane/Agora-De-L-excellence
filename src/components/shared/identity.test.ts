import { describe, expect, it } from "vitest";
import { coverDesign } from "@/components/shared/generated-cover";
import { gradins, hemicycleGeometry } from "@/components/shared/hemicycle";
import { LETTER_VALUES } from "@/components/shared/letter-tile";
import { books } from "../../../prisma/demo-data";
import { hashString } from "@/lib/utils";

describe("hashString", () => {
  it("est déterministe et distingue des chaînes proches", () => {
    expect(hashString("Une si longue lettre")).toBe(hashString("Une si longue lettre"));
    expect(hashString("Lire")).not.toBe(hashString("Lise"));
  });
});

describe("valeurs des lettres", () => {
  it("couvre les 26 lettres avec les valeurs du Scrabble francophone", () => {
    expect(Object.keys(LETTER_VALUES)).toHaveLength(26);
    expect(LETTER_VALUES.A).toBe(1);
    expect(LETTER_VALUES.J).toBe(8);
    expect(LETTER_VALUES.K).toBe(10);
    // Somme des 26 valeurs : garde-fou contre une modification accidentelle du barème.
    expect(Object.values(LETTER_VALUES).reduce((a, b) => a + b, 0)).toBe(103);
  });
});

describe("couvertures générées", () => {
  it("donne toujours la même couverture au même livre", () => {
    const a = coverDesign("L’Aventure ambiguë", "Cheikh Hamidou Kane", "Roman");
    const b = coverDesign("L’Aventure ambiguë", "Cheikh Hamidou Kane", "Roman");
    expect(a).toEqual(b);
  });

  it("varie suffisamment sur l'étagère de démonstration", () => {
    const designs = books.map((b) => coverDesign(b.title, b.author, b.category));
    const distinct = new Set(designs.map((d) => `${d.gabarit}-${d.palette}`));
    expect(new Set(designs.map((d) => d.gabarit)).size).toBeGreaterThanOrEqual(3);
    expect(distinct.size).toBeGreaterThanOrEqual(6);
  });
});

describe("hémicycle", () => {
  const rows = gradins(["a", "b", "c"], { inner: 40, step: 15 });
  const g = hemicycleGeometry(rows, { w: 11, h: 9 }, 4, 20);

  it("place plus de tuiles sur les rangs extérieurs", () => {
    const perRow = [0, 1, 2].map((r) => g.tiles.filter((t) => t.key.startsWith(`${r}-`)).length);
    expect(perRow[0]).toBeLessThan(perRow[1]);
    expect(perRow[1]).toBeLessThan(perRow[2]);
  });

  it("garde toutes les tuiles dans le cadre", () => {
    for (const t of g.tiles) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(g.width);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeLessThanOrEqual(g.height);
    }
  });

  it("est symétrique : la tuile centrale de chaque rang est au sommet", () => {
    for (const [r, row] of rows.entries()) {
      const tiles = g.tiles.filter((t) => t.key.startsWith(`${r}-`));
      const top = tiles.reduce((a, b) => (a.y < b.y ? a : b));
      if (tiles.length % 2 === 1) {
        expect(top.x).toBeCloseTo(g.cx, 1);
        expect(top.y).toBeCloseTo(g.cy - row.radius, 1);
      }
    }
  });
});

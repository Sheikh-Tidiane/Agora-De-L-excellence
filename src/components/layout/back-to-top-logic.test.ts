import { describe, expect, it } from "vitest";
import { boutonVisible, distanceAuBas } from "@/components/layout/back-to-top-logic";

describe("bouton « Revenir en haut »", () => {
  const ecran = 800;

  it("apparaît après deux hauteurs d'écran de défilement", () => {
    expect(boutonVisible(0, ecran, false)).toBe(false);
    expect(boutonVisible(1600, ecran, false)).toBe(false);
    expect(boutonVisible(1601, ecran, false)).toBe(true);
  });

  it("une fois visible, ne disparaît que près du haut", () => {
    expect(boutonVisible(1000, ecran, true)).toBe(true);
    expect(boutonVisible(401, ecran, true)).toBe(true);
    expect(boutonVisible(400, ecran, true)).toBe(false);
  });

  it("se soulève au-dessus du pied de page quand il entre dans l'écran", () => {
    expect(distanceAuBas(null, ecran, 16)).toBe(16);
    expect(distanceAuBas(790, ecran, 16)).toBe(26);
    expect(distanceAuBas(500, ecran, 16)).toBe(316);
  });

  it("s'efface quand le pied de page occupe presque tout l'écran", () => {
    expect(distanceAuBas(279, ecran, 16)).toBeNull();
    expect(distanceAuBas(-200, ecran, 16)).toBeNull();
  });
});

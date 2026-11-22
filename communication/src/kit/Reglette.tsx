import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { courbes, couleurs, durees } from "./tokens";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type RegletteProps = {
  /** Centre de la rangée de tuiles posée dessus, en px. */
  cx: number;
  cy: number;
  /** Largeur d’une tuile, en px. */
  taille: number;
  /** Nombre de tuiles qu’elle porte (7 pour un chevalet complet). */
  places?: number;
  /** Pas entre deux tuiles, en fraction de la taille. */
  pas?: number;
  echelle?: number;
  /** Image où elle apparaît (fondu). Absent : déjà là. */
  debut?: number;
};

/** Centre de la tuile `i` posée sur une réglette (mêmes réglages que la réglette). */
export const placeSurReglette = (i: number, { cx, taille, places = 7, pas = 1.08 }: Pick<RegletteProps, "cx" | "taille" | "places" | "pas">) =>
  cx + (i - (places - 1) / 2) * taille * pas;

/**
 * Le chevalet du Scrabble : une barre terracotta en léger relief, sous les tuiles.
 * À déclarer avant les tuiles (elle passe dessous).
 */
export const Reglette: React.FC<RegletteProps> = ({ cx, cy, taille, places = 7, pas = 1.08, echelle = 1, debut }) => {
  const frame = useCurrentFrame();
  const opacite = debut === undefined ? 1 : interpolate(frame, [debut, debut + durees.transition], [0, 1], { ...borne, easing: courbes.entree });
  const largeur = places * taille * pas + 56 * echelle;
  return (
    <div
      style={{
        position: "absolute",
        left: cx - largeur / 2,
        top: cy + taille * 0.42,
        width: largeur,
        height: 34 * echelle,
        borderRadius: 8 * echelle,
        backgroundColor: couleurs.terracotta,
        boxShadow: `inset 0 ${3 * echelle}px 0 rgba(255,255,255,0.18), 0 ${10 * echelle}px ${18 * echelle}px -8px rgba(10,14,32,0.5)`,
        opacity: opacite,
      }}
    />
  );
};

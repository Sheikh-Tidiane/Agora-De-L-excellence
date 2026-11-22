import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { courbes, durees } from "./tokens";

export type ArcDeGradinsProps = {
  /** Centre de l’arc, en px, dans le repère du parent (il peut être hors du cadre). */
  centre: { x: number; y: number };
  /** Rayon du premier rang, en px. */
  rayon: number;
  /** Nombre de rangs, du plus proche au plus éloigné du centre. */
  rangs?: number;
  /** Largeur d’une place, en px (hauteur : 9/11). */
  place?: number;
  /** Ouverture de l’arc, en degrés de part et d’autre du haut (110 : comme le logo). */
  ouverture?: number;
  couleur: string;
  /** Image où l’arc apparaît, par un fondu lent ; absent : déjà visible. */
  debut?: number;
  style?: React.CSSProperties;
};

/**
 * Motif de l’identité, inspiré des gradins du logo sans le copier : des rangs
 * de places en arc, plats et sans matière, pour habiller un fond (souvent en
 * très faible contraste, en partie hors cadre). Élément secondaire : il ne bouge pas.
 */
export const ArcDeGradins: React.FC<ArcDeGradinsProps> = ({
  centre,
  rayon,
  rangs = 3,
  place = 60,
  ouverture = 110,
  couleur,
  debut,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacite =
    debut === undefined
      ? 1
      : interpolate(frame, [debut, debut + durees.transitionLongue * 2], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: courbes.fondu,
        });
  const pas = place * 1.45;
  const hauteur = (place * 9) / 11;

  const places: React.ReactNode[] = [];
  for (let r = 0; r < rangs; r++) {
    const R = rayon + r * pas;
    // Autant de places que l’arc en contient avec un écart régulier.
    const longueur = (R * Math.PI * 2 * ouverture) / 180;
    const nombre = Math.max(2, Math.round(longueur / (place * 1.55)));
    for (let i = 0; i < nombre; i++) {
      const angle = -ouverture + ((2 * ouverture) / (nombre - 1)) * i;
      const rad = (angle * Math.PI) / 180;
      places.push(
        <div
          key={`${r}-${i}`}
          style={{
            position: "absolute",
            left: centre.x + R * Math.sin(rad) - place / 2,
            top: centre.y - R * Math.cos(rad) - hauteur / 2,
            width: place,
            height: hauteur,
            borderRadius: place * 0.15,
            backgroundColor: couleur,
            transform: `rotate(${angle}deg)`,
          }}
        />,
      );
    }
  }

  return <div style={{ position: "absolute", inset: 0, opacity: opacite, ...style }}>{places}</div>;
};

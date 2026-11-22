import React from "react";
import type { Depart } from "./mouvement";
import { valeurLettre } from "./scrabble";
import { Tuile, type VarianteTuile } from "./Tuile";
import { durees } from "./tokens";

export type RangeeDeTuilesProps = {
  /** Le mot à écrire ; une espace laisse une case vide. */
  mot: string;
  /** Largeur d’une tuile, en px. */
  taille: number;
  /** Image où la première tuile commence son vol. */
  debut: number;
  /** Décalage entre deux tuiles, en images. */
  intervalle?: number;
  /** Écart entre deux tuiles, en fraction de la taille. */
  espacement?: number;
  variante?: VarianteTuile | ((index: number, lettre: string) => VarianteTuile);
  /** D’où viennent les tuiles. Par défaut d’en haut, en alternant légèrement à gauche et à droite. */
  depart?: (index: number) => Depart;
  /** Alignement par rapport au point d’ancrage du parent. */
  alignement?: "centre" | "gauche";
  style?: React.CSSProperties;
};

/** Nombre d’images pour qu’une rangée soit entièrement posée. */
export const dureeRangee = (mot: string, intervalle: number = durees.intervalleTuiles) =>
  ([...mot].filter((l) => l !== " ").length - 1) * intervalle + durees.volTuile + durees.rebondTuile;

const departParDefaut = (taille: number) => (index: number): Depart => {
  const sens = index % 2 === 0 ? -1 : 1;
  return { x: sens * taille * 0.35, y: -taille * 2.6, rotation: sens * (6 + (index % 3) * 2) };
};

/**
 * Un mot qui s’écrit tuile par tuile, de gauche à droite, avec les valeurs
 * du Scrabble francophone. Le composant occupe un point d’ancrage : la rangée
 * est centrée (ou alignée à gauche) sur ce point.
 */
export const RangeeDeTuiles: React.FC<RangeeDeTuilesProps> = ({
  mot,
  taille,
  debut,
  intervalle = durees.intervalleTuiles,
  espacement = 0.1,
  variante = "ivoire",
  depart,
  alignement = "centre",
  style,
}) => {
  const lettres = [...mot];
  const pas = taille * (1 + espacement);
  const largeurTotale = lettres.length * pas - taille * espacement;
  const origine = alignement === "centre" ? -largeurTotale / 2 + taille / 2 : taille / 2;
  const departDe = depart ?? departParDefaut(taille);

  let rang = 0;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, ...style }}>
      {lettres.map((lettre, i) => {
        if (lettre === " ") return null;
        const ordre = rang++;
        const v = typeof variante === "function" ? variante(i, lettre) : variante;
        return (
          <div key={i} style={{ position: "absolute", left: origine + i * pas, top: 0 }}>
            <Tuile
              lettre={lettre}
              valeur={valeurLettre(lettre)}
              taille={taille}
              variante={v}
              debut={debut + ordre * intervalle}
              depart={departDe(ordre)}
            />
          </div>
        );
      })}
    </div>
  );
};

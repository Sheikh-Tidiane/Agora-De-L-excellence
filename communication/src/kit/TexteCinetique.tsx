import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { courbes, durees, polices, tempsLecture } from "./tokens";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type TexteCinetiqueProps = {
  /** Une entrée par ligne. Les sauts de ligne sont maîtrisés, jamais laissés au hasard. */
  lignes: string[];
  debut: number;
  /** « mot » : chaque mot entre à son tour ; « ligne » : chaque ligne entre d’un bloc. */
  mode?: "mot" | "ligne";
  /** Image où le texte commence à sortir. Par défaut : après son temps de lecture. */
  sortie?: number;
  /** Vrai : le texte reste (pas de sortie). */
  reste?: boolean;
  taille: number;
  couleur: string;
  police?: "titre" | "texte";
  graisse?: number;
  interligne?: number;
  alignement?: "left" | "center" | "right";
  /** Mots (ou fragments exacts) à mettre en accent. */
  accent?: { mots: string[]; couleur: string };
  decalage?: number;
  style?: React.CSSProperties;
};

/** Images nécessaires pour que tout le texte soit entré. */
export const dureeEntreeTexte = (lignes: string[], mode: "mot" | "ligne" = "mot", decalage: number = durees.motCinetique) => {
  const unites = mode === "mot" ? lignes.join(" ").split(/\s+/).length : lignes.length;
  const pas = mode === "mot" ? decalage : decalage * 3;
  return (unites - 1) * pas + durees.entreeTexte;
};

/** Images à prévoir entre l’entrée du premier mot et le début de la sortie. */
export const dureeTexteCinetique = (lignes: string[], mode: "mot" | "ligne" = "mot") =>
  dureeEntreeTexte(lignes, mode) + tempsLecture(lignes.join(" "));

/**
 * Typographie animée : les mots (ou les lignes) entrent l’un après l’autre,
 * en montant légèrement depuis leur ligne de base ; ils sortent ensemble, en fondu.
 * Le texte reste au moins le temps de le lire deux fois.
 */
export const TexteCinetique: React.FC<TexteCinetiqueProps> = ({
  lignes,
  debut,
  mode = "mot",
  sortie,
  reste = false,
  taille,
  couleur,
  police = "titre",
  graisse = 400,
  interligne = 1.12,
  alignement = "left",
  accent,
  decalage = durees.motCinetique,
  style,
}) => {
  const frame = useCurrentFrame();
  const finSortie = sortie ?? debut + dureeTexteCinetique(lignes, mode);
  const opaciteSortie = reste
    ? 1
    : interpolate(frame, [finSortie, finSortie + durees.transitionCourte], [1, 0], { ...borne, easing: courbes.sortie });
  const leveeSortie = reste
    ? 0
    : interpolate(frame, [finSortie, finSortie + durees.transitionCourte], [0, -taille * 0.18], {
        ...borne,
        easing: courbes.sortie,
      });

  let index = 0;
  return (
    <div
      style={{
        fontFamily: police === "titre" ? polices.titre : polices.texte,
        fontWeight: police === "titre" ? 400 : graisse,
        fontSize: taille,
        lineHeight: interligne,
        color: couleur,
        textAlign: alignement,
        opacity: opaciteSortie,
        transform: `translateY(${leveeSortie}px)`,
        ...style,
      }}
    >
      {lignes.map((ligne, l) => {
        const mots = ligne.split(/\s+/);
        return (
          <div key={l} style={{ whiteSpace: "nowrap" }}>
            {mots.map((mot, m) => {
              const rang = mode === "mot" ? index++ : l * 3;
              const depart = debut + rang * decalage;
              const p = interpolate(frame, [depart, depart + durees.entreeTexte], [0, 1], {
                ...borne,
                easing: courbes.entree,
              });
              const enAccent = accent?.mots.includes(mot);
              return (
                <React.Fragment key={m}>
                  <span
                    style={{
                      display: "inline-block",
                      opacity: p,
                      transform: `translateY(${(1 - p) * taille * 0.32}px)`,
                      color: enAccent ? accent?.couleur : undefined,
                    }}
                  >
                    {mot}
                  </span>
                  {m < mots.length - 1 ? " " : null}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

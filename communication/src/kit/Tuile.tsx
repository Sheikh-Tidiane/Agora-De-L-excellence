import React from "react";
import { useCurrentFrame } from "remotion";
import { echelleHauteur, etatPose, ombreDouce, versRepereLocal, type Depart } from "./mouvement";
import { lettreDeBase, valeurLettre } from "./scrabble";
import { couleurs, polices } from "./tokens";

export type VarianteTuile = "ivoire" | "indigo" | "terracotta" | "terracottaClair";

export const teintes: Record<VarianteTuile, { fond: string; encre: string }> = {
  ivoire: { fond: couleurs.ivoire, encre: couleurs.indigo },
  indigo: { fond: couleurs.indigo, encre: couleurs.ivoire },
  terracotta: { fond: couleurs.terracotta, encre: couleurs.ivoire },
  terracottaClair: { fond: couleurs.terracottaClair, encre: couleurs.indigo },
};

export type TuileProps = {
  /** Lettre affichée ; sans lettre, la tuile est une « place » des gradins. */
  lettre?: string;
  /** Valeur affichée ; par défaut la valeur Scrabble de la lettre. `null` pour la masquer. */
  valeur?: number | null;
  /** Largeur en px. */
  taille: number;
  /** Hauteur / largeur (1 pour une tuile de lettre, 9/11 pour une place des gradins). */
  ratio?: number;
  variante?: VarianteTuile;
  /** Image où la tuile commence son vol. Absent : la tuile est déjà posée. */
  debut?: number;
  depart?: Depart;
  vol?: number;
  /** Rotation finale (degrés), une fois posée. */
  rotationFinale?: number;
  /** Rayon des coins, en fraction de la largeur. */
  arrondi?: number;
  /** 0–1 : efface reliefs et ombre (passage à un rendu plat, comme le logo). */
  matiere?: number;
  /** Sans `debut` : hauteur imposée (0 posée, 1 en vol), pour un mouvement piloté par le parent. */
  hauteur?: number;
  /** Opacité imposée (fondu entre deux aspects d’une même tuile). */
  opacite?: number;
  /** Couleur de fond imposée (passage d’une variante à une autre pendant un vol). */
  fond?: string;
  /** Opacité de la lettre et de sa valeur seules (une lettre qui s’efface d’une tuile). */
  opaciteLettre?: number;
  style?: React.CSSProperties;
};

const DEPART_DEFAUT: Depart = { x: -40, y: -260, rotation: -9 };

/**
 * Tuile de lettre, avec sa matière : un léger relief, un poids, une ombre douce
 * qui se resserre au contact, une légère rotation en vol et un rebond court à la pose.
 * Positionnée par son centre : le parent place le point (0, 0).
 */
export const Tuile: React.FC<TuileProps> = ({
  lettre,
  valeur,
  taille,
  ratio = 1,
  variante = "ivoire",
  debut,
  depart = DEPART_DEFAUT,
  vol,
  rotationFinale = 0,
  arrondi = 0.13,
  matiere = 1,
  hauteur = 0,
  opacite = 1,
  fond: fondImpose,
  opaciteLettre = 1,
  style,
}) => {
  const frame = useCurrentFrame();
  const etat =
    debut === undefined
      ? { x: 0, y: 0, rotation: 0, hauteur, opacite }
      : etatPose(frame, debut, depart, vol);
  const { fond: fondVariante, encre } = teintes[variante];
  const fond = fondImpose ?? fondVariante;
  const largeur = taille;
  const hauteurTuile = taille * ratio;
  const valeurAffichee = valeur === undefined ? (lettre ? valeurLettre(lettre) : null) : valeur;
  const angle = rotationFinale + etat.rotation;
  // Reliefs et ombre exprimés dans le monde (lumière en haut à gauche), puis ramenés
  // dans le repère de la tuile : une tuile tournée garde la même lumière que ses voisines.
  const [hx, hy] = versRepereLocal(0, taille * 0.03, angle);
  const [bx, by] = versRepereLocal(0, -taille * 0.05, angle);

  return (
    <div
      style={{
        position: "absolute",
        left: -largeur / 2,
        top: -hauteurTuile / 2,
        width: largeur,
        height: hauteurTuile,
        opacity: etat.opacite,
        transform: `translate(${etat.x}px, ${etat.y}px) rotate(${angle}deg) scale(${echelleHauteur(etat.hauteur)})`,
        borderRadius: taille * arrondi,
        backgroundColor: fond,
        // Relief discret : arête claire en haut, épaisseur sombre en bas (lumière en haut à gauche).
        boxShadow: [
          matiere > 0 ? `inset ${hx}px ${hy}px 0 rgba(255, 255, 255, ${0.35 * matiere})` : "",
          matiere > 0 ? `inset ${bx}px ${by}px 0 rgba(15, 20, 45, ${0.1 * matiere})` : "",
          ombreDouce(taille, etat.hauteur, matiere, angle),
        ]
          .filter((v) => v && v !== "none")
          .join(", ") || "none",
        ...style,
      }}
    >
      {lettre ? (
        // Typographie calée sur la tuile A1 du logo (symbole.svg) : lettre en Young Serif,
        // hauteur de capitale = 52,5 % de la tuile, centrée ; valeur en Work Sans 600 en bas à droite.
        <svg
          viewBox="0 0 100 100"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", opacity: opaciteLettre }}
        >
          <text
            x={valeurAffichee !== null ? 47 : 50}
            y={76.25}
            textAnchor="middle"
            fontFamily={polices.titre}
            fontSize={70}
            fill={encre}
          >
            {/* Comme au Scrabble : jamais d’accent ni de cédille sur une tuile. */}
            {lettreDeBase(lettre)}
          </text>
          {valeurAffichee !== null ? (
            <text
              x={88}
              y={86.6}
              textAnchor="end"
              fontFamily={polices.texte}
              fontWeight={600}
              fontSize={valeurAffichee >= 10 ? 17 : 20}
              fill={encre}
            >
              {valeurAffichee}
            </text>
          ) : null}
        </svg>
      ) : null}
    </div>
  );
};

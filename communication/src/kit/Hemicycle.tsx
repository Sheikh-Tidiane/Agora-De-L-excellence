import React from "react";
import { Tuile } from "./Tuile";
import { durees } from "./tokens";

/**
 * Géométrie de « L’Hémicycle », relevée dans public/logos/symbole.svg
 * (repère de 120 × 120). Elle sert à poser les tuiles exactement là où le logo
 * les place, pour que le passage au logo officiel se fasse par un simple fondu.
 */
const CENTRE = { x: 60, y: 70 };
const PLACE = { largeur: 11, hauteur: 9, arrondi: 1.6 };
const A1 = { x: 60, y: 70, cote: 42, arrondi: 5.88 };

type Place = { x: number; y: number; rotation: number };

const rang = (rayon: number, nombre: number): Place[] =>
  Array.from({ length: nombre }, (_, i) => {
    const angle = -110 + (220 / (nombre - 1)) * i; // de -110° à +110°, 0° en haut
    const rad = (angle * Math.PI) / 180;
    return {
      x: CENTRE.x + rayon * Math.sin(rad),
      y: CENTRE.y - rayon * Math.cos(rad),
      rotation: 360 + angle,
    };
  });

export const RANG_EXTERIEUR = rang(50, 13);
export const RANG_INTERIEUR = rang(37, 9);

const INTERVALLE = 2;
const PAUSE_ENTRE_RANGS = 2;
const PAUSE_AVANT_A1 = 4;
const VOL_A1 = 18;

export type PlaceGeometrie = { x: number; y: number; rotation: number; largeur: number; hauteur: number; arrondi: number };

/**
 * Géométrie en px dans un carré de côté `taille` (même cadrage que symbole.svg) :
 * centre, rotation et dimensions de chaque place, et de la tuile A1. Sert à faire
 * arriver d’autres tuiles exactement sur une place (par exemple les lettres d’un mot).
 */
export const geometrieHemicycle = (taille: number) => {
  const k = taille / 120;
  const place = (p: Place): PlaceGeometrie => ({
    x: p.x * k,
    y: p.y * k,
    rotation: p.rotation,
    largeur: PLACE.largeur * k,
    hauteur: PLACE.hauteur * k,
    arrondi: PLACE.arrondi / PLACE.largeur,
  });
  return {
    interieur: RANG_INTERIEUR.map(place),
    exterieur: RANG_EXTERIEUR.map(place),
    a1: { x: A1.x * k, y: A1.y * k, cote: A1.cote * k, arrondi: A1.arrondi / A1.cote },
  };
};

/**
 * Repères temporels de l’animation (en images, à partir de `debut`).
 * Sans A1 (déjà apportée par une autre animation), la fin suit le rang extérieur.
 */
export const chronologieHemicycle = (debut = 0, avecA1 = true) => {
  const debutExterieur = debut + (RANG_INTERIEUR.length - 1) * INTERVALLE + PAUSE_ENTRE_RANGS;
  const finExterieur = debutExterieur + (RANG_EXTERIEUR.length - 1) * INTERVALLE + durees.volTuile;
  const debutA1 = finExterieur + PAUSE_AVANT_A1;
  const poseA1 = debutA1 + VOL_A1;
  return {
    debutInterieur: debut,
    debutExterieur,
    debutA1,
    poseA1,
    /** Tout est immobile : la matière peut s’effacer, le logo peut prendre le relais. */
    fin: (avecA1 ? poseA1 : finExterieur) + durees.rebondTuile,
  };
};

export type HemicycleProps = {
  /** Côté du carré de 120 × 120 unités, en px (même cadrage que symbole.svg). */
  taille: number;
  debut?: number;
  /** Sur fond indigo : tuile A1 ivoire, comme symbole-inverse.svg. */
  inverse?: boolean;
  /** 0–1 : efface reliefs et ombres avant le passage au logo plat. */
  matiere?: number;
  /** Affiche la tuile A1 (faux pour n’animer que les gradins). */
  avecA1?: boolean;
  /** Vrai : tout est déjà posé (image fixe, planche). */
  auRepos?: boolean;
  /** Places laissées vides, car occupées par des tuiles venues d’ailleurs (indices, de gauche à droite). */
  exclusInterieur?: number[];
  exclusExterieur?: number[];
};

/**
 * Les gradins qui se remplissent de tuiles, rang après rang (le rang intérieur,
 * au plus près de la scène, puis le rang extérieur), puis la tuile A1 qui se pose au centre.
 * Chaque place arrive de l’extérieur du théâtre, dans l’axe de son gradin.
 */
export const Hemicycle: React.FC<HemicycleProps> = ({
  taille,
  debut = 0,
  inverse = false,
  matiere = 1,
  avecA1 = true,
  auRepos = false,
  exclusInterieur = [],
  exclusExterieur = [],
}) => {
  const k = taille / 120;
  const t = chronologieHemicycle(debut, avecA1);

  const place = (p: Place, i: number, depuis: number, couleur: "terracotta" | "terracottaClair") => {
    const dx = p.x - CENTRE.x;
    const dy = p.y - CENTRE.y;
    const n = Math.hypot(dx, dy);
    const recul = 34 * k;
    return (
      <div key={`${couleur}-${i}`} style={{ position: "absolute", left: p.x * k, top: p.y * k }}>
        <Tuile
          taille={PLACE.largeur * k}
          ratio={PLACE.hauteur / PLACE.largeur}
          arrondi={PLACE.arrondi / PLACE.largeur}
          variante={couleur}
          debut={auRepos ? undefined : depuis + i * INTERVALLE}
          depart={{ x: (dx / n) * recul, y: (dy / n) * recul, rotation: i % 2 === 0 ? -14 : 14 }}
          rotationFinale={p.rotation}
          matiere={matiere}
        />
      </div>
    );
  };

  return (
    <div style={{ position: "relative", width: taille, height: taille }}>
      {RANG_INTERIEUR.map((p, i) => (exclusInterieur.includes(i) ? null : place(p, i, t.debutInterieur, "terracottaClair")))}
      {RANG_EXTERIEUR.map((p, i) => (exclusExterieur.includes(i) ? null : place(p, i, t.debutExterieur, "terracotta")))}
      {avecA1 ? (
        <div style={{ position: "absolute", left: A1.x * k, top: A1.y * k }}>
          <Tuile
            lettre="A"
            valeur={1}
            taille={A1.cote * k}
            arrondi={A1.arrondi / A1.cote}
            variante={inverse ? "ivoire" : "indigo"}
            debut={auRepos ? undefined : t.debutA1}
            vol={VOL_A1}
            depart={{ x: 0, y: -46 * k, rotation: -7 }}
            matiere={matiere}
          />
        </div>
      ) : null}
    </div>
  );
};

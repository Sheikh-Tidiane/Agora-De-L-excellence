import { interpolate } from "remotion";
import { courbes, durees, lumiere } from "./tokens";

export type Depart = {
  /** Décalage de départ par rapport à la position finale, en px. */
  x: number;
  y: number;
  /** Rotation au départ, en degrés ; la tuile se redresse à la pose. */
  rotation: number;
};

export type EtatPose = {
  x: number;
  y: number;
  rotation: number;
  /** Hauteur au-dessus de la surface : 1 en vol, 0 posée. Pilote l’échelle et l’ombre. */
  hauteur: number;
  opacite: number;
  posee: boolean;
};

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Trajectoire d’une tuile qui se pose :
 * - en vol, elle se rapproche avec inertie (freinage horizontal) pendant que son poids
 *   l’accélère vers la surface ;
 * - au contact, un rebond court et amorti (deux bosses décroissantes, puis le repos).
 */
export const etatPose = (
  frame: number,
  debut: number,
  depart: Depart,
  vol: number = durees.volTuile,
): EtatPose => {
  const t = frame - debut;
  if (t < 0) {
    return { x: depart.x, y: depart.y, rotation: depart.rotation, hauteur: 1, opacite: 0, posee: false };
  }
  const p = Math.min(1, t / vol);
  const approche = courbes.volTuile(p);
  const redressement = courbes.deplacement(p);
  let hauteur = 1 - courbes.chuteTuile(p);

  if (t >= vol) {
    const tau = t - vol;
    const premier = 6;
    const second = durees.rebondTuile - premier;
    if (tau < premier) hauteur = 0.07 * Math.sin((Math.PI * tau) / premier);
    else if (tau < durees.rebondTuile) hauteur = 0.018 * Math.sin((Math.PI * (tau - premier)) / second);
    else hauteur = 0;
  }

  return {
    x: depart.x * (1 - approche),
    y: depart.y * (1 - approche),
    rotation: depart.rotation * (1 - redressement),
    hauteur,
    opacite: interpolate(t, [0, 4], [0, 1], { ...borne, easing: courbes.entree }),
    posee: t >= vol + durees.rebondTuile,
  };
};

/**
 * Ombre douce d’un objet à une hauteur donnée : large et légère en vol,
 * serrée et plus dense au contact. Toujours dans la direction de la lumière.
 * `matiere` (0–1) permet d’effacer la matière, par exemple avant le passage au logo.
 * `angle` : rotation de l’élément, en degrés. Une ombre CSS tourne avec l’élément :
 * on la contre-tourne pour que la lumière reste la même pour toutes les tuiles.
 */
export const ombreDouce = (taille: number, hauteur: number, matiere = 1, angle = 0) => {
  if (matiere <= 0) return "none";
  const distance = taille * (0.025 + 0.2 * hauteur);
  const flou = taille * (0.05 + 0.36 * hauteur);
  const densite = (0.26 - 0.12 * hauteur) * matiere;
  const contact = 0.22 * (1 - Math.min(1, hauteur * 4)) * matiere;
  const [ox, oy] = versRepereLocal(lumiere.x * distance, lumiere.y * distance, angle);
  const [cx, cy] = versRepereLocal(lumiere.x * taille * 0.01, taille * 0.012, angle);
  return [
    `${ox}px ${oy}px ${flou}px rgba(15, 20, 45, ${densite.toFixed(3)})`,
    `${cx}px ${cy}px ${taille * 0.02}px rgba(15, 20, 45, ${contact.toFixed(3)})`,
  ].join(", ");
};

/**
 * Exprime un décalage du monde (x vers la droite, y vers le bas) dans le repère
 * d’un élément tourné de `angle` degrés : c’est le décalage à donner à son ombre.
 */
export const versRepereLocal = (x: number, y: number, angle: number): [number, number] => {
  const a = (-angle * Math.PI) / 180;
  const r = (v: number) => Math.round(v * 100) / 100;
  return [r(x * Math.cos(a) - y * Math.sin(a)), r(x * Math.sin(a) + y * Math.cos(a))];
};

/** Échelle apparente selon la hauteur : un objet soulevé paraît un peu plus grand. */
export const echelleHauteur = (hauteur: number) => 1 + 0.16 * hauteur;

/** Apparition et disparition d’un élément, avec les courbes d’entrée et de sortie du kit. */
export const opaciteEntreeSortie = (
  frame: number,
  entree: number,
  sortie: number | undefined,
  duree: number = durees.transition,
) => {
  const a = interpolate(frame, [entree, entree + duree], [0, 1], { ...borne, easing: courbes.entree });
  if (sortie === undefined) return a;
  const b = interpolate(frame, [sortie, sortie + duree], [1, 0], { ...borne, easing: courbes.sortie });
  return Math.min(a, b);
};

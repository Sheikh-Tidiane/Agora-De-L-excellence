import { durees, hauteurLogoVertical } from "../src/kit";

/**
 * Minutage et géométrie du teaser (vertical 1080 × 1920, 30 i/s).
 * Voir semaine-1/STORYBOARD.md : chaque valeur y est expliquée.
 */
export const W = 1080;
export const H = 1920;

/** Fondu entre deux plans du moment de lecture : 0,4 s. */
export const FONDU = durees.transitionCourte;

/** Plans successifs (images absolues). Deux plans voisins se chevauchent de FONDU. */
export const plans = {
  chute: { debut: 0, duree: 90 },
  plateau1: { debut: 78, duree: 54 },
  page: { debut: 120, duree: 60 },
  plateau2: { debut: 168, duree: 54 },
  finale: { debut: 210 },
} as const;

/** Tuiles de la scène 1 : leur lettre, leur place « au hasard » sur la table, leur ordre de chute. */
export const TAILLE_TUILE = 164;
export type TuileEparse = { lettre: string; x: number; y: number; rotation: number; chute: number; derive: number };
/** Dans l’ordre du mot AGORA (index 0 : le A de valeur 1, futur A1 du logo). */
export const tuilesEparses: TuileEparse[] = [
  { lettre: "A", x: 318, y: 520, rotation: -11, chute: 47, derive: -34 },
  { lettre: "G", x: 300, y: 1318, rotation: 13, chute: 25, derive: -30 },
  { lettre: "O", x: 398, y: 958, rotation: -17, chute: 4, derive: 26 },
  { lettre: "R", x: 742, y: 708, rotation: 9, chute: 15, derive: 40 },
  { lettre: "A", x: 790, y: 1186, rotation: -6, chute: 37, derive: 30 },
];
export const VOL_CHUTE = 16;

/** Rangée « AGORA » : centrée, un peu au-dessus du milieu de l’image. */
export const Y_RANGEE = 860;
export const ESPACEMENT = 0.1;
export const pasRangee = TAILLE_TUILE * (1 + ESPACEMENT);
export const xRangee = (i: number) => W / 2 + (i - 2) * pasRangee;

/** Logo final : même cadrage que la démo validée (1 064 px de large, centré à 900 px). */
export const LARGEUR_LOGO = 1064;
export const LOGO_X = (W - LARGEUR_LOGO) / 2;
export const LOGO_Y = 900 - hauteurLogoVertical(LARGEUR_LOGO) / 2;

/** Repères de la finale, en images relatives au début du plan « finale ». */
export const finale = {
  rangement: 14,
  decalageRangement: 6,
  dureeRangement: 22,
  migration: 106,
  decalageMigration: 3,
  dureeMigration: 26,
  /** Les gradins commencent quand les cinq lettres sont presque posées. */
  gradins: 106 + 26 + 4 * 3 - 2,
  /** Le logo complet est tenu 1 s (logotype entier à 242), puis s’efface avant le passage de fond. */
  sortieLogo: 272,
  passage: 286,
  symbole: 290,
  texte: 296,
  fin: 368,
} as const;

export const DUREE_TEASER = plans.finale.debut + finale.fin;

/** Places du rang intérieur prises par G, O, R et le dernier A (de gauche à droite). */
export const PLACES_LETTRES = [1, 3, 5, 7];

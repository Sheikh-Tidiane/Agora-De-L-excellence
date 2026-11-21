import { Easing } from "remotion";

/** Cadence unique de toutes les vidéos. */
export const FPS = 30;

/** Couleurs de l’identité, et seulement elles. */
export const couleurs = {
  indigo: "#1F2A55",
  terracotta: "#C2562E",
  terracottaFonce: "#A9471F",
  terracottaClair: "#E08A5F",
  ivoire: "#F7F4ED",
  blanc: "#FFFFFF",
  gris: "#5E6478",
  /** Ombres : l’indigo très sombre, jamais du noir pur, pour rester dans la famille chaude. */
  ombre: "15, 20, 45",
} as const;

export const polices = {
  titre: "Young Serif",
  texte: "Work Sans",
} as const;

/**
 * Courbes d’animation, une par type de mouvement. Aucune interpolation linéaire
 * pour un élément visible.
 */
export const courbes = {
  /** Entrée d’un texte ou d’un élément : départ franc, arrivée très douce. */
  entree: Easing.bezier(0.16, 1, 0.3, 1),
  /** Sortie : départ doux, accélération en partant. */
  sortie: Easing.bezier(0.7, 0, 0.84, 0),
  /** Déplacement d’un élément déjà à l’écran (glissement, recadrage). */
  deplacement: Easing.bezier(0.65, 0, 0.35, 1),
  /** Vol d’une tuile, horizontalement : l’inertie la freine en approchant. */
  volTuile: Easing.bezier(0.22, 0.8, 0.32, 1),
  /** Chute d’une tuile, verticalement (hauteur) : son poids l’accélère jusqu’au contact. */
  chuteTuile: Easing.bezier(0.55, 0, 0.9, 0.45),
  /** Fondu (logo, matières) : symétrique et lent aux extrémités. */
  fondu: Easing.bezier(0.45, 0, 0.55, 1),
} as const;

/** Durées en images (30 i/s). Les transitions vont de 0,4 à 0,8 s. */
export const durees = {
  transitionCourte: 12, // 0,4 s
  transition: 18, // 0,6 s
  transitionLongue: 24, // 0,8 s
  volTuile: 14, // trajet d’une tuile avant le contact
  rebondTuile: 10, // rebond court et amorti après le contact
  intervalleTuiles: 5, // décalage entre deux tuiles d’une rangée
  motCinetique: 4, // décalage entre deux mots d’un texte cinétique
  entreeTexte: 16,
} as const;

/** Direction unique de la lumière : elle vient d’en haut à gauche, les ombres tombent en bas à droite. */
export const lumiere = { x: 0.35, y: 1 } as const;

export type NomFormat = "vertical" | "carre" | "portrait" | "paysage";

export type Format = {
  largeur: number;
  hauteur: number;
  /** Marges où rien d’important ne doit se trouver (boutons et légendes des applis). */
  securite: { haut: number; bas: number; cotes: number };
};

export const formats: Record<NomFormat, Format> = {
  vertical: { largeur: 1080, hauteur: 1920, securite: { haut: 250, bas: 300, cotes: 80 } },
  carre: { largeur: 1080, hauteur: 1080, securite: { haut: 80, bas: 80, cotes: 80 } },
  portrait: { largeur: 1080, hauteur: 1350, securite: { haut: 80, bas: 80, cotes: 80 } },
  paysage: { largeur: 1920, hauteur: 1080, securite: { haut: 80, bas: 80, cotes: 120 } },
};

/** Secondes → images. */
export const s = (secondes: number) => Math.round(secondes * FPS);

/**
 * Temps de lecture : le temps de lire deux fois, soit environ 1 s pour 3 mots,
 * jamais moins de 1,5 s. Renvoie un nombre d’images.
 */
export const tempsLecture = (texte: string) => {
  const mots = texte.trim().split(/\s+/).filter(Boolean).length;
  return s(Math.max(1.5, mots / 3));
};

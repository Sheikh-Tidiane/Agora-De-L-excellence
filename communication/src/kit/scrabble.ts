/**
 * Valeurs des lettres au Scrabble francophone (règlement de la Fédération
 * internationale de Scrabble francophone). Les accents ne comptent pas : É vaut E.
 */
const VALEURS: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 10, L: 1, M: 2,
  N: 1, O: 1, P: 3, Q: 8, R: 1, S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
};

/** Retire accents et cédille : « É » → « E », « Ç » → « C ». */
export const lettreDeBase = (lettre: string) =>
  lettre.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** Valeur d’une lettre ; `null` pour ce qui n’est pas une lettre (espace, apostrophe…). */
export const valeurLettre = (lettre: string): number | null => {
  const base = lettreDeBase(lettre);
  return base in VALEURS ? VALEURS[base] : null;
};

/** Somme des valeurs d’un mot, sans cases multiplicatrices. */
export const valeurMot = (mot: string) =>
  [...mot].reduce((total, l) => total + (valeurLettre(l) ?? 0), 0);

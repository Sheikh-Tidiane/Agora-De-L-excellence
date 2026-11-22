/**
 * Règles du bouton « Revenir en haut », testables sans navigateur.
 *
 * - Il apparaît après environ deux hauteurs d'écran de défilement.
 * - Une fois visible, il ne disparaît que près du haut (moins d'une demi-hauteur
 *   d'écran) : pas de clignotement si l'on remonte un peu pour relire.
 */
export const SEUIL_APPARITION = 2;
export const SEUIL_DISPARITION = 0.5;

export function boutonVisible(defilement: number, hauteurEcran: number, etaitVisible: boolean) {
  if (hauteurEcran <= 0) return false;
  if (etaitVisible) return defilement > hauteurEcran * SEUIL_DISPARITION;
  return defilement > hauteurEcran * SEUIL_APPARITION;
}

/** En dessous de cette part de l'écran au-dessus du pied de page, le bouton s'efface. */
export const PLACE_MINIMALE = 0.35;

/**
 * Distance au bas de l'écran (px) pour ne jamais recouvrir le pied de page :
 * la marge habituelle, ou plus si le haut du pied de page est déjà dans l'écran.
 * `null` : le pied de page occupe presque tout l'écran, le bouton s'efface
 * (on est tout en bas, la navigation du pied de page est sous le pouce).
 */
export function distanceAuBas(hautDuPied: number | null, hauteurEcran: number, marge: number) {
  if (hautDuPied === null || hautDuPied >= hauteurEcran) return marge;
  if (hautDuPied < hauteurEcran * PLACE_MINIMALE) return null;
  return Math.max(marge, hauteurEcran - hautDuPied + marge);
}

/** Éléments qu'il ne faut jamais masquer : actions, liens et champs de formulaire. */
export const SELECTEUR_INTERACTIF =
  'a[href], button, input, select, textarea, label, summary, form, [role="button"], [role="link"], [contenteditable="true"]';

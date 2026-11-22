/**
 * Carte de membre consultable hors ligne : nom du cache et adresse, partagés par la page de la
 * carte (qui l'y range), le bouton de déconnexion (qui l'efface) et `public/sw.js` (mêmes valeurs,
 * écrites en dur : le service worker n'importe rien).
 */
export const CARD_CACHE = "agora-carte";
export const CARD_URL = "/member/card";

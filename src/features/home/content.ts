/**
 * Textes officiels du club (docs/CONTENUS-CLUB.md, sections 3, 4 et 6), remis par le comité de
 * pilotage. Ils font foi : ne rien y ajouter qui n'y figure pas.
 */

/** Les trois dimensions du club. */
export const dimensions = [
  {
    letter: "C",
    title: "Culturelle",
    text: "Cultiver chez les membres le goût de la lecture et de la recherche du savoir, et développer le culte de l’excellence.",
  },
  {
    letter: "I",
    title: "Intellectuelle",
    text: "Stimuler la réflexion, enrichir le vocabulaire et déployer les capacités intellectuelles.",
  },
  {
    letter: "S",
    title: "Sociale",
    text: "Créer des rencontres, tisser des liens et évoluer ensemble dans l’excellence.",
  },
] as const;

/** Les objectifs du club. */
export const objectives = [
  "Créer un lieu de rencontres, d’échanges, de culture, de réflexion et de convivialité.",
  "Inculquer aux jeunes le goût de la lecture et l’amour du savoir, à travers la lecture et les jeux de l’esprit tels que le Scrabble.",
  "Cultiver l’excellence.",
] as const;

/** Le rythme des rencontres. Jour, heure et lieu habituels : non communiqués, donc absents. */
export const meetings = [
  { figure: "15", unit: "jours", text: "Une rencontre en présentiel tous les quinze jours." },
  { figure: "2", unit: "heures", text: "Deux heures au maximum par rencontre." },
] as const;

export const remoteNote =
  "La plateforme permet de suivre le club même quand on ne peut pas être présent.";

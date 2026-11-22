/**
 * Textes de la semaine 2, tous tirés de docs/CONTENUS-CLUB.md (sections indiquées).
 * Les phrases longues sont des extraits fidèles, raccourcis pour le temps de lecture
 * (1 s pour 3 mots) : aucun mot ajouté qui ne soit dans la source.
 */

/** §4 — Les trois dimensions. */
export const dimensions = [
  {
    nom: "Culturelle.",
    // « cultiver chez les membres le goût de la lecture et de la recherche du savoir… »
    phrase: "Le goût de la lecture et de la recherche du savoir.",
  },
  {
    nom: "Intellectuelle.",
    // « stimuler la réflexion, enrichir le vocabulaire et déployer les capacités intellectuelles »
    phrase: "Stimuler la réflexion et enrichir le vocabulaire.",
  },
  {
    nom: "Sociale.",
    // « créer des rencontres, tisser des liens et évoluer ensemble dans l’excellence »
    phrase: "Créer des rencontres, tisser des liens, évoluer ensemble.",
  },
] as const;

/**
 * §5 — Les cinq activités : nom officiel, mot sur les tuiles (sans accent, comme au Scrabble),
 * une ligne d’explication.
 */
export const activites = [
  {
    nom: "Les Rendez-vous lecture",
    tuiles: "LECTURE",
    // « Chaque participant partage son interprétation et son appréciation »
    ligne: "Un livre, chacun son interprétation.",
    plan: { fichier: "lecture.mp4", libelle: "une lecture partagée autour d’un livre" },
  },
  {
    nom: "Les Tournois de Scrabble",
    tuiles: "SCRABBLE",
    // « D’abord des séances d’initiation… Ensuite, des compétitions… avec un classement mensuel »
    ligne: "Initiation, compétitions, classement mensuel.",
    plan: { fichier: "scrabble.mp4", libelle: "une partie de Scrabble" },
  },
  {
    nom: "Les Débats d’idées",
    tuiles: "DEBATS",
    // « Un sujet d’actualité ou de société est choisi et débattu. »
    ligne: "Un sujet d’actualité, choisi et débattu.",
    plan: { fichier: "debat.mp4", libelle: "un débat d’idées" },
  },
  {
    nom: "Les Génies du soir",
    tuiles: "GENIES",
    // « Quiz de culture générale, devinettes, jeux de l’esprit, concours d’éloquence et de mémorisation. »
    ligne: "Quiz, devinettes, éloquence, mémorisation.",
    plan: null,
  },
  {
    nom: "L’Agora Ciné",
    tuiles: "CINE",
    // « la projection d’un film… suivie d’un débat »
    ligne: "Un film, suivi d’un débat.",
    plan: null,
  },
] as const;

/** §1 — Slogan. */
export const slogan = ["Le savoir", "comme flamme,", "l’excellence", "comme ambition"];

/** §6 — Rythme des rencontres. */
export const rythme = ["Une rencontre", "tous les", "quinze jours."];

/**
 * §8 — Lancement : samedi 16 janvier 2027, à partir de 16 h, au Foyer des jeunes de Yeumbeul Nord
 * (date et lieu confirmés par le comité, communiqués par le porteur du projet le 21/11/2026).
 */
export const lancement = {
  surtitre: "Lancement",
  jour: "Samedi",
  date: "16 janvier 2027",
  heure: "À partir de 16 h",
  lieu: "Foyer des jeunes de Yeumbeul Nord",
  /** Coupure voulue sur deux lignes quand le lieu est centré (évite « Nord » seul sur une ligne). */
  lieuLignes: ["Foyer des jeunes", "de Yeumbeul Nord"],
} as const;

/**
 * Semaine 3 : une publication par activité. Textes tirés de docs/CONTENUS-CLUB.md §5,
 * phrase par phrase ; les phrases trop longues pour être lues en quelques secondes sont
 * raccourcies sans rien ajouter (la phrase source est citée en commentaire).
 * Les mots sur les tuiles s’écrivent sans accent, comme au Scrabble.
 */
export type Fond = "ivoire" | "indigo";

export type ActiviteSerie = {
  slug: "Lecture" | "Scrabble" | "Debats" | "Genies" | "Cine";
  numero: number;
  /** Nom officiel, coupé en lignes pour le titre. */
  titre: string[];
  fond: Fond;
  /** Deux phrases, lues l’une après l’autre. */
  lignes: [string, string];
  /** Texte du visuel portrait, s’il est plus complet que les deux phrases de la vidéo. */
  textePortrait?: string;
};

export const serie: ActiviteSerie[] = [
  {
    slug: "Lecture",
    numero: 1,
    titre: ["Les Rendez-vous", "lecture"],
    fond: "ivoire",
    lignes: [
      // « Des rencontres autour d’un livre, d’une nouvelle, d’un poème ou d’un discours. »
      "Des rencontres autour d’un livre, d’une nouvelle, d’un poème ou d’un discours.",
      // « Chaque participant partage son interprétation et son appréciation, pour un enrichissement mutuel. »
      "Chacun partage son interprétation et son appréciation.",
    ],
  },
  {
    slug: "Scrabble",
    numero: 2,
    titre: ["Les Tournois", "de Scrabble"],
    fond: "indigo",
    lignes: [
      // « D’abord des séances d’initiation pour celles et ceux qui aiment le Scrabble sans avoir jamais eu l’occasion d’y jouer. »
      "D’abord des séances d’initiation, pour qui n’a jamais eu l’occasion de jouer.",
      // « Ensuite, des compétitions individuelles ou par équipes, avec un classement mensuel et des records à battre. »
      "Ensuite, des compétitions avec un classement mensuel et des records à battre.",
    ],
    // Visuel : le texte complet de §5 B (« individuelles ou par équipes », « Les gagnants sont récompensés »).
    textePortrait:
      "D’abord des séances d’initiation, pour qui n’a jamais eu l’occasion de jouer. Ensuite, des compétitions individuelles ou par équipes, avec un classement mensuel et des records à battre. Les gagnants sont récompensés.",
  },
  {
    slug: "Debats",
    numero: 3,
    titre: ["Les Débats", "d’idées"],
    fond: "ivoire",
    lignes: [
      // « Un sujet d’actualité ou de société est choisi et débattu. Chacun a la latitude de défendre ses idées »
      "Un sujet d’actualité ou de société, et chacun défend ses idées.",
      // « l’Invité de l’Agora. … une personnalité est invitée, sur place ou en visioconférence. »
      "L’Invité de l’Agora : une personnalité, sur place ou en visioconférence.",
    ],
  },
  {
    slug: "Genies",
    numero: 4,
    titre: ["Les Génies", "du soir"],
    fond: "indigo",
    lignes: [
      // « Quiz de culture générale, devinettes, jeux de l’esprit, concours d’éloquence et de mémorisation. »
      "Quiz de culture générale, devinettes et jeux de l’esprit.",
      "Concours d’éloquence et de mémorisation.",
    ],
  },
  {
    slug: "Cine",
    numero: 5,
    titre: ["L’Agora", "Ciné"],
    fond: "indigo",
    lignes: [
      // « Tous les trois mois, la projection d’un film historique ou qui stimule l’intelligence, d’un documentaire ou d’une conférence »
      "Tous les trois mois, un film, un documentaire ou une conférence.",
      // « suivie d’un débat sur l’interprétation et l’appréciation du thème. »
      "Suivi d’un débat sur l’interprétation du thème.",
    ],
  },
];

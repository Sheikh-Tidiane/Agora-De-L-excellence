/**
 * Exemples de la page interne /design-system (absente en production) et des tests des
 * couvertures générées. Ils ne sont jamais écrits en base. Les livres cités existent ; les
 * mots du club et les rencontres sont des exemples de mise en page.
 */

export type LivreExemple = {
  slug: string;
  title: string;
  author: string;
  category: string;
  /** Année de première parution. */
  year: number;
  /** Le mot du club : une phrase rédigée pour le club, jamais un résumé copié. */
  note: string;
};

export const books: LivreExemple[] = [
  {
    slug: "une-si-longue-lettre",
    year: 1979,
    title: "Une si longue lettre",
    author: "Mariama Bâ",
    category: "Littérature sénégalaise",
    note: "Une veuve écrit à son amie d’enfance, et c’est tout un pays qui se raconte.",
  },
  {
    slug: "l-aventure-ambigue",
    year: 1961,
    title: "L’Aventure ambiguë",
    author: "Cheikh Hamidou Kane",
    category: "Littérature sénégalaise",
    note: "Apprendre ailleurs sans se perdre : la question n’a pas pris une ride.",
  },
  {
    slug: "les-bouts-de-bois-de-dieu",
    year: 1960,
    title: "Les Bouts de bois de Dieu",
    author: "Ousmane Sembène",
    category: "Roman",
    note: "La grève des cheminots du Dakar-Niger, portée par celles qu’on n’attendait pas.",
  },
  {
    slug: "la-greve-des-battu",
    year: 1979,
    title: "La Grève des bàttu",
    author: "Aminata Sow Fall",
    category: "Littérature sénégalaise",
    note: "Que devient la ville quand les mendiants cessent de tendre la main ?",
  },
  {
    slug: "le-ventre-de-l-atlantique",
    year: 2003,
    title: "Le Ventre de l’Atlantique",
    author: "Fatou Diome",
    category: "Roman",
    note: "Entre Niodior et Strasbourg, le rêve du départ regardé en face.",
  },
  {
    slug: "la-plus-secrete-memoire-des-hommes",
    year: 2021,
    title: "La plus secrète mémoire des hommes",
    author: "Mohamed Mbougar Sarr",
    category: "Littérature africaine",
    note: "Une enquête littéraire qui donne envie de lire tout ce qu’elle cite.",
  },
  {
    slug: "frere-d-ame",
    year: 2018,
    title: "Frère d’âme",
    author: "David Diop",
    category: "Roman",
    note: "La voix d’un tirailleur, courte, entêtante, impossible à lâcher.",
  },
  {
    slug: "l-enfant-noir",
    year: 1953,
    title: "L’Enfant noir",
    author: "Camara Laye",
    category: "Littérature africaine",
    note: "Une enfance en Haute-Guinée, racontée avec une douceur qui reste.",
  },
];

export type RencontreExemple = {
  slug: string;
  /** Date ISO, heure de Dakar. */
  iso: string;
  title: string;
  type:
    | "RENDEZ_VOUS_LECTURE"
    | "INITIATION_SCRABBLE"
    | "TOURNOI_SCRABBLE"
    | "DEBAT_IDEES"
    | "GENIES_DU_SOIR"
    | "AGORA_CINE";
  open: boolean;
  summary: string;
  description: string;
};

/**
 * Une rencontre par activité du club, pour montrer les gabarits.
 */
export const events: RencontreExemple[] = [
  {
    slug: "rendez-vous-lecture-une-si-longue-lettre",
    iso: "2027-01-09T16:00",
    title: "Rendez-vous lecture : « Une si longue lettre »",
    type: "RENDEZ_VOUS_LECTURE",
    open: true,
    summary: "Chacun partage son interprétation et son appréciation du roman de Mariama Bâ.",
    description:
      "Une rencontre autour du roman de Mariama Bâ. Chaque participant partage son interprétation et son appréciation, pour un enrichissement mutuel.\n\nLa rencontre dure deux heures au maximum.",
  },
  {
    slug: "initiation-au-scrabble-janvier",
    iso: "2027-01-23T16:00",
    title: "Initiation au Scrabble",
    type: "INITIATION_SCRABBLE",
    open: true,
    summary:
      "Pour celles et ceux qui aiment le Scrabble sans avoir jamais eu l’occasion d’y jouer.",
    description:
      "Une séance d’initiation pour celles et ceux qui aiment le Scrabble sans avoir jamais eu l’occasion d’y jouer.\n\nLa rencontre dure deux heures au maximum.",
  },
  {
    slug: "debat-d-idees-fevrier",
    iso: "2027-02-06T16:00",
    title: "Débat d’idées : faut-il lire pour réussir ?",
    type: "DEBAT_IDEES",
    open: true,
    summary: "Chacun défend ses idées ; on repart ensemble avec une vision plus claire du sujet.",
    description:
      "Un sujet de société est choisi et débattu. Chacun a la latitude de défendre ses idées ; à la fin, on repart ensemble avec une vision plus claire et une meilleure compréhension du sujet.\n\nLa rencontre dure deux heures au maximum.",
  },
  {
    slug: "genies-du-soir-fevrier",
    iso: "2027-02-20T16:00",
    title: "Les Génies du soir",
    type: "GENIES_DU_SOIR",
    open: false,
    summary: "Quiz de culture générale, devinettes et jeux de l’esprit.",
    description:
      "Quiz de culture générale, devinettes, jeux de l’esprit, concours d’éloquence et de mémorisation.\n\nLa rencontre dure deux heures au maximum.",
  },
  {
    slug: "tournoi-de-scrabble-mars",
    iso: "2027-03-06T16:00",
    title: "Tournoi de Scrabble",
    type: "TOURNOI_SCRABBLE",
    open: false,
    summary: "Compétition individuelle, comptée pour le classement mensuel.",
    description:
      "Une compétition individuelle, comptée pour le classement mensuel du club.\n\nLa rencontre dure deux heures au maximum.",
  },
  {
    slug: "agora-cine-mars",
    iso: "2027-03-20T16:00",
    title: "L’Agora Ciné",
    type: "AGORA_CINE",
    open: true,
    summary: "Une projection, suivie d’un débat sur l’interprétation et l’appréciation du thème.",
    description:
      "La projection d’un documentaire, suivie d’un débat sur l’interprétation et l’appréciation du thème.\n\nLa rencontre dure deux heures au maximum.",
  },
];

/**
 * Données de démonstration du seed (marquées `isDemo`, supprimées par `pnpm db:clear-demo`).
 * Les livres cités existent ; les mots du club, dates, rencontres et articles sont fictifs.
 */

export type DemoBook = {
  slug: string;
  title: string;
  author: string;
  category: string;
  /** Année de première parution. */
  year: number;
  /** Le mot du club : une phrase rédigée pour le club, jamais un résumé copié. */
  note: string;
};

export const books: DemoBook[] = [
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

export const bookOfTheMonth = {
  book: books[0],
  /** Premier jour du mois de la sélection (UTC). */
  month: "2026-11-01",
  pitch:
    "Ramatoulaye écrit à son amie Aïssatou pendant son deuil. Un roman court, une langue limpide, et de quoi discuter tout un après-midi : le mariage, l’amitié, ce qu’une femme se doit à elle-même.",
  meetingSlug: "rendez-vous-lecture-une-si-longue-lettre",
};

export type DemoEvent = {
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
 * Rencontres fictives, une tous les quinze jours après le lancement du 26 décembre 2026
 * (qui, lui, est un vrai événement : voir prisma/seed.ts). Une par activité du club.
 * Lieu laissé vide : il n'a pas été communiqué.
 */
export const events: DemoEvent[] = [
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

export type DemoArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  date: string;
  iso: string;
  readingTime: string;
};

export const articles: DemoArticle[] = [
  {
    slug: "pourquoi-commencer-par-mariama-ba",
    category: "Le livre du mois",
    title: "Pourquoi nous commençons par Mariama Bâ",
    excerpt:
      "Pour un premier livre commun, il fallait un texte court, que tout le monde puisse trouver, et sur lequel personne ne soit d’accord. Nous n’avons pas cherché longtemps.",
    date: "9 novembre 2026",
    iso: "2026-11-09",
    readingTime: "4 min de lecture",
  },
  {
    slug: "mot-de-la-semaine-palabre",
    category: "Le mot de la semaine",
    title: "Palabre",
    excerpt:
      "On l’emploie pour une discussion qui s’éternise. Le mot désignait pourtant l’assemblée où l’on règle un différend par la parole.",
    date: "2 novembre 2026",
    iso: "2026-11-02",
    readingTime: "2 min de lecture",
  },
  {
    slug: "duplicate-ou-classique",
    category: "Scrabble",
    title: "Duplicate ou classique : deux façons de jouer",
    excerpt:
      "En classique, on affronte un adversaire et son tirage. En duplicate, tout le monde a les mêmes lettres : il ne reste que le vocabulaire.",
    date: "26 octobre 2026",
    iso: "2026-10-26",
    readingTime: "3 min de lecture",
  },
];

/**
 * Quiz de démonstration : questions de culture générale vérifiables, sans rien affirmer du club.
 * La première proposition de chaque question est la bonne (l'ordre d'affichage est celui de `position`).
 */
export const demoQuiz = {
  slug: "echauffement-des-genies-du-soir",
  title: "Échauffement des Génies du soir",
  instructions:
    "Cinq questions de lettres et de Scrabble, une seule bonne réponse à chaque fois. Vous avez cinq minutes, une seule tentative.",
  durationMinutes: 5,
  questions: [
    {
      prompt: "Qui a écrit « Une si longue lettre » ?",
      choices: ["Mariama Bâ", "Aminata Sow Fall", "Ken Bugul", "Fatou Diome"],
      correct: 0,
    },
    {
      prompt: "Qui est l’auteur de « L’Aventure ambiguë » ?",
      choices: ["Ousmane Sembène", "Cheikh Hamidou Kane", "Birago Diop", "Camara Laye"],
      correct: 1,
    },
    {
      prompt: "Au Scrabble en français, combien de points vaut la lettre Z ?",
      choices: ["4", "8", "10", "12"],
      correct: 2,
    },
    {
      prompt: "Combien de jetons compte un jeu de Scrabble en français, jokers compris ?",
      choices: ["98", "100", "104", "102"],
      correct: 3,
    },
    {
      prompt: "De quelle langue le mot « palabre » est-il emprunté ?",
      choices: ["L’espagnol", "Le wolof", "L’arabe", "L’anglais"],
      correct: 0,
    },
  ],
};

/**
 * Modes du « Compagnon des Lettres ». Sans dépendance serveur : importable par l'interface.
 * L'ordre du tableau est l'ordre d'affichage ; le premier mode est celui proposé par défaut.
 */
export const ASSISTANT_MODES = [
  {
    id: "recommend",
    label: "Me conseiller un livre",
    hint: "Des pistes de lecture, en priorité dans le catalogue du club.",
    placeholder: "J’ai aimé « L’Aventure ambiguë », que lire ensuite ?",
  },
  {
    id: "word",
    label: "Expliquer un mot",
    hint: "Le sens, l’origine et des exemples d’emploi.",
    placeholder: "Que veut dire « palimpseste » ?",
  },
  {
    id: "debate",
    label: "Un sujet de débat",
    hint: "Une question à débattre, avec des pistes pour et contre.",
    placeholder: "Un sujet sur la place des langues nationales à l’école",
  },
  {
    id: "quiz",
    label: "Un quiz",
    hint: "Quelques questions pour s’entraîner, avec les réponses à la fin.",
    placeholder: "Cinq questions sur la littérature sénégalaise",
  },
  {
    id: "comprehension",
    label: "Questions sur un livre",
    hint: "Des questions de compréhension pour préparer un rendez-vous lecture.",
    placeholder: "Des questions sur « Une si longue lettre »",
  },
  {
    id: "review",
    label: "Structurer ma critique",
    hint: "Un plan et des questions pour écrire votre critique vous-même.",
    placeholder: "Je veux écrire une critique de « Les Bouts de bois de Dieu »",
  },
  {
    id: "vocabulary",
    label: "Défi de vocabulaire",
    hint: "Un défi de mots, à la manière d’une partie de Scrabble.",
    placeholder: "Un défi avec des mots rares commençant par « Z »",
  },
] as const satisfies readonly { id: string; label: string; hint: string; placeholder: string }[];

export type AssistantMode = (typeof ASSISTANT_MODES)[number];
export type AssistantModeId = AssistantMode["id"];

export const ASSISTANT_MODE_IDS = ASSISTANT_MODES.map((mode) => mode.id) as [
  AssistantModeId,
  ...AssistantModeId[],
];

/** Longueur maximale d'une question du membre, en caractères. */
export const MAX_MESSAGE_CHARS = 1000;
/** Longueur maximale d'une réponse précédente renvoyée dans l'historique, en caractères. */
export const MAX_ANSWER_CHARS = 12_000;
/** Nombre maximal de messages (questions et réponses) envoyés avec une question. */
export const MAX_HISTORY_MESSAGES = 12;

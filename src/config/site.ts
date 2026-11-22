/**
 * Identité du club. Seul endroit du code où le nom est écrit.
 * À partir de la phase 2, ces valeurs servent de défaut à la table `Setting`.
 */
export const site = {
  name: "L’Agora de l’Excellence",
  shortName: "L’Agora",
  baseline: "Club de lecture et de Scrabble",
  slogan: "Le savoir comme flamme, l’excellence comme ambition",
  city: "Dakar",
  since: 2026,
  description:
    "Club de lecture et de Scrabble à Dakar : rendez-vous lecture, tournois de Scrabble, débats d’idées, quiz et projections. Le savoir comme flamme, l’excellence comme ambition.",
  locale: "fr_SN",
  themeColor: "#1F2A55",
  backgroundColor: "#F7F4ED",
} as const;

export type Site = typeof site;

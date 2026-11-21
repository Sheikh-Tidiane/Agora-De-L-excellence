import type { TournamentStatusCode } from "@/features/scrabble/rules";

/** Libellés partagés par l'administration, l'espace membre et le site public. */
export { statusLabels } from "@/features/scrabble/rules";

export const statusTones: Record<
  TournamentStatusCode,
  "neutre" | "succes" | "alerte" | "erreur" | "accent"
> = {
  DRAFT: "neutre",
  REGISTRATION_OPEN: "alerte",
  IN_PROGRESS: "succes",
  COMPLETED: "accent",
  CANCELLED: "erreur",
};

export const formatLabels = { INDIVIDUAL: "Individuel", TEAMS: "Équipes" } as const;
export const modeLabels = { DUPLICATE: "Duplicate", CLASSIC: "Classique" } as const;
export const ruleLabels = {
  WINS_SCORE_SPREAD: "Victoires, puis cumul des scores, puis différentiel",
  CUMULATIVE_SCORE: "Cumul des scores",
} as const;
export const roundStatusLabels = {
  PLANNED: "Prévue",
  IN_PROGRESS: "En cours",
  COMPLETED: "Terminée",
} as const;

/** « 1er », « 2e »… */
export const ordinal = (rank: number) => `${rank}${rank === 1 ? "er" : "e"}`;

/** « +45 », « −12 », « 0 ». */
export const signed = (value: number) =>
  value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";

/** Victoires avec les demi-points des parties nulles : « 3,5 ». */
export const winsLabel = (wins: number) => wins.toLocaleString("fr-FR");

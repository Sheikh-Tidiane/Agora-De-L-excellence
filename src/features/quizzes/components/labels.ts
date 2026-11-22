import type { QuizPhase } from "@/features/quizzes/rules";

/** Libellés et tons des phases d'un quiz, partagés par l'administration et l'espace membre. */
export const phaseLabels: Record<QuizPhase, string> = {
  draft: "Brouillon",
  upcoming: "Programmé",
  open: "Ouvert",
  ended: "Terminé",
};

export const phaseTones: Record<QuizPhase, "neutre" | "succes" | "alerte" | "accent"> = {
  draft: "neutre",
  upcoming: "alerte",
  open: "succes",
  ended: "accent",
};

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** « 4 min 05 s », « 52 s ». */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} s`;
  return `${minutes} min ${String(rest).padStart(2, "0")} s`;
}

/**
 * Scrabble : point d'entrée des services (logique métier testable sans React).
 * Règles : docs/REGLES-METIER.md, « Scrabble » ; choix : docs/DECISIONS.md, section 13.
 * - `ranking.ts` : calcul pur du classement d'un tournoi ;
 * - `tournament-service.ts` : tournois et cycle de vie ;
 * - `roster-service.ts` : joueurs (membres ou extérieurs) et équipes ;
 * - `play-service.ts` : manches, appariements, saisie et correction des scores ;
 * - `results-service.ts` : validation (rangs figés, points de victoire), dévalidation, publication ;
 * - `records-service.ts` : records du club ;
 * - `monthly-ranking.ts` : classement mensuel.
 */
export {
  archiveTournament,
  createTournament,
  setTournamentStatus,
  updateTournament,
} from "@/features/scrabble/tournament-service";
export {
  addParticipant,
  assignParticipantTeam,
  createTeam,
  deleteTeam,
  removeParticipant,
  renameTeam,
  setParticipantWithdrawn,
} from "@/features/scrabble/roster-service";
export {
  createMatch,
  createRound,
  deleteMatch,
  deleteRound,
  saveScores,
  setRoundStatus,
  type ScoreEntry,
} from "@/features/scrabble/play-service";
export {
  invalidateResults,
  publishResults,
  validateResults,
  type WinnerAward,
} from "@/features/scrabble/results-service";
export {
  createRecord,
  deleteRecord,
  replaceRecord,
  updateRecord,
} from "@/features/scrabble/records-service";
export { getMonthlyScrabbleRanking } from "@/features/scrabble/monthly-ranking";

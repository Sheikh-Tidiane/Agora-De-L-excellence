import "server-only";

/**
 * Lectures des quiz pour les Server Components. Le contrôle d'accès est fait par la page
 * (`requirePageAccess("member.access" | "quizzes.manage", …)`) ; les fonctions membres prennent
 * toujours l'identifiant de la session, jamais un identifiant venu du client.
 */
export {
  getMemberQuizScreen,
  listQuizzesForMember,
  type MemberQuizAttempt,
  type MemberQuizItem,
  type MemberQuizScreen,
  type QuizCorrection,
  type QuizResult,
} from "@/features/quizzes/member-queries";
export {
  getGeneralQuizRanking,
  getQuizRanking,
  type GeneralQuizRanking,
  type QuizRanking,
  type QuizRankingRow,
} from "@/features/quizzes/ranking-service";
export {
  getQuizForAdmin,
  getQuizPreview,
  getQuizResults,
  listGeniesEvents,
  listQuizzesForAdmin,
  type AdminQuiz,
  type AdminQuizListItem,
  type QuizResults,
} from "@/features/quizzes/admin-queries";
export type { FinishedState, InProgressState, PlayState } from "@/features/quizzes/attempt-service";

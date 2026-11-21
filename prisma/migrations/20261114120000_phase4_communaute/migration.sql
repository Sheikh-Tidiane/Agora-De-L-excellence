-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('QR_SCAN', 'MANUAL');

-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- AlterEnum
ALTER TYPE "BadgeCriterion" ADD VALUE 'QUIZZES_COMPLETED';

-- AlterEnum
ALTER TYPE "PointSourceType" ADD VALUE 'QUIZ';

-- DropIndex
DROP INDEX "Reading_completionStatus_idx";

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "checkInMethod" "CheckInMethod";

-- AlterTable
ALTER TABLE "Reading" ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "validationNote" TEXT;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "countsForMonthly" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cardIssuedAt" TIMESTAMP(3),
ADD COLUMN     "cardSerial" TEXT,
ADD COLUMN     "cardVersion" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Level" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minPoints" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "eventId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizQuestion" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizChoice" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "score" INTEGER,
    "maxScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "choiceId" TEXT,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Level_code_key" ON "Level"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Level_name_key" ON "Level"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Level_minPoints_key" ON "Level"("minPoints");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_slug_key" ON "Quiz"("slug");

-- CreateIndex
CREATE INDEX "Quiz_status_opensAt_idx" ON "Quiz"("status", "opensAt");

-- CreateIndex
CREATE INDEX "Quiz_eventId_idx" ON "Quiz"("eventId");

-- CreateIndex
CREATE INDEX "QuizQuestion_quizId_position_idx" ON "QuizQuestion"("quizId", "position");

-- CreateIndex
CREATE INDEX "QuizChoice_questionId_position_idx" ON "QuizChoice"("questionId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "QuizChoice_id_questionId_key" ON "QuizChoice"("id", "questionId");

-- CreateIndex
CREATE INDEX "QuizAttempt_quizId_score_idx" ON "QuizAttempt"("quizId", "score");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAttempt_userId_quizId_key" ON "QuizAttempt"("userId", "quizId");

-- CreateIndex
CREATE INDEX "QuizAnswer_questionId_idx" ON "QuizAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuizAnswer_attemptId_questionId_key" ON "QuizAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "Reading_userId_status_idx" ON "Reading"("userId", "status");

-- CreateIndex
CREATE INDEX "Reading_completionStatus_submittedAt_idx" ON "Reading"("completionStatus", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_cardSerial_key" ON "User"("cardSerial");

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizQuestion" ADD CONSTRAINT "QuizQuestion_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizChoice" ADD CONSTRAINT "QuizChoice_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "QuizQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_choiceId_questionId_fkey" FOREIGN KEY ("choiceId", "questionId") REFERENCES "QuizChoice"("id", "questionId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Écrit à la main (non exprimable dans schema.prisma).
-- ---------------------------------------------------------------------------

-- Les présences pointées avant cette migration l'ont été à la main (phase 3).
UPDATE "EventRegistration" SET "checkInMethod" = 'MANUAL' WHERE "attendedAt" IS NOT NULL;
-- Une présence a toujours une méthode, et une méthode suppose une présence.
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_check_in_method" CHECK (
  ("attendedAt" IS NULL) = ("checkInMethod" IS NULL)
);

-- Un forfait vaut zéro point.
ALTER TABLE "Score" ADD CONSTRAINT "Score_forfeit_zero" CHECK (NOT "isForfeit" OR "points" = 0);

-- Une lecture terminée peut seule être envoyée en validation.
ALTER TABLE "Reading" ADD CONSTRAINT "Reading_completion_requires_finished" CHECK (
  "completionStatus" = 'NONE' OR "status" = 'FINISHED'
);

-- Carte de membre : version toujours positive.
ALTER TABLE "User" ADD CONSTRAINT "User_card_version_positive" CHECK ("cardVersion" >= 1);

-- Niveaux : seuils positifs.
ALTER TABLE "Level" ADD CONSTRAINT "Level_min_points_positive" CHECK ("minPoints" >= 0);

-- Quiz : durée raisonnable, fenêtre ordonnée.
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_duration_range" CHECK ("durationMinutes" BETWEEN 1 AND 180);
ALTER TABLE "Quiz" ADD CONSTRAINT "Quiz_window" CHECK ("closesAt" > "opensAt");

-- Une seule bonne réponse par question (QCM à réponse unique).
CREATE UNIQUE INDEX "QuizChoice_one_correct_per_question" ON "QuizChoice"("questionId") WHERE "isCorrect";

-- Tentative : chrono après le début, score entre 0 et le nombre de questions, score posé à la fin seulement.
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_expires_after_start" CHECK ("expiresAt" > "startedAt");
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_max_score_positive" CHECK ("maxScore" >= 0);
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_score_range" CHECK (
  "score" IS NULL OR ("score" >= 0 AND "score" <= "maxScore")
);
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_score_when_finished" CHECK (
  ("finishedAt" IS NULL) = ("score" IS NULL)
);
-- Une question passée (sans réponse choisie) n'est jamais juste.
ALTER TABLE "QuizAnswer" ADD CONSTRAINT "QuizAnswer_skipped_is_wrong" CHECK (
  "choiceId" IS NOT NULL OR NOT "isCorrect"
);

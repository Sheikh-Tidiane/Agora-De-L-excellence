-- CreateEnum
CREATE TYPE "GuestSpeakerMode" AS ENUM ('ON_SITE', 'REMOTE');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('MEMBERSHIP_CARD', 'SESSION_FEE');

-- AlterEnum
BEGIN;
CREATE TYPE "EventType_new" AS ENUM ('RENDEZ_VOUS_LECTURE', 'INITIATION_SCRABBLE', 'TOURNOI_SCRABBLE', 'DEBAT_IDEES', 'GENIES_DU_SOIR', 'AGORA_CINE', 'LANCEMENT_AUTRE');
-- Écrit à la main : les anciens types sont convertis vers les activités officielles
-- (docs/CONTENUS-CLUB.md, section 5). Atelier, conférence et « autre » deviennent LANCEMENT_AUTRE.
ALTER TABLE "Event" ALTER COLUMN "type" TYPE "EventType_new" USING (
  CASE "type"::text
    WHEN 'READING' THEN 'RENDEZ_VOUS_LECTURE'
    WHEN 'SCRABBLE' THEN 'TOURNOI_SCRABBLE'
    WHEN 'DEBATE' THEN 'DEBAT_IDEES'
    WHEN 'QUIZ' THEN 'GENIES_DU_SOIR'
    ELSE 'LANCEMENT_AUTRE'
  END::"EventType_new");
-- Une règle de points rattachée à un type disparu perd son déclencheur (elle ne rapporte plus rien).
ALTER TABLE "PointRule" ALTER COLUMN "eventType" TYPE "EventType_new" USING (
  CASE "eventType"::text
    WHEN 'READING' THEN 'RENDEZ_VOUS_LECTURE'
    WHEN 'SCRABBLE' THEN 'TOURNOI_SCRABBLE'
    WHEN 'DEBATE' THEN 'DEBAT_IDEES'
    WHEN 'QUIZ' THEN 'GENIES_DU_SOIR'
    ELSE NULL
  END::"EventType_new");
ALTER TYPE "EventType" RENAME TO "EventType_old";
ALTER TYPE "EventType_new" RENAME TO "EventType";
DROP TYPE "public"."EventType_old";
COMMIT;

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Interest" ADD VALUE 'GENIES_DU_SOIR';
ALTER TYPE "Interest" ADD VALUE 'AGORA_CINE';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "isTentative" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "program" TEXT,
ADD COLUMN     "reportAuthorId" TEXT,
ADD COLUMN     "reportContent" TEXT,
ADD COLUMN     "reportPublishedAt" TIMESTAMP(3),
ADD COLUMN     "speakerMode" "GuestSpeakerMode",
ADD COLUMN     "speakerName" TEXT,
ADD COLUMN     "speakerTitle" TEXT,
ADD COLUMN     "videoLink" TEXT,
ALTER COLUMN "location" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Membership" DROP COLUMN "feePaid",
DROP COLUMN "feePaidAt";

-- AlterTable
ALTER TABLE "MembershipRequest" ADD COLUMN     "charterAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "charterVersion" INTEGER;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "reward" TEXT;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "userId" TEXT,
    "registrationId" TEXT,
    "eventId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "receivedById" TEXT,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "photo" TEXT,
    "bio" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrabbleRecord" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT,
    "holderName" TEXT,
    "tournamentId" TEXT,
    "achievedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScrabbleRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_kind_paidAt_idx" ON "Payment"("kind", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE INDEX "Payment_eventId_idx" ON "Payment"("eventId");

-- CreateIndex
CREATE INDEX "Payment_registrationId_idx" ON "Payment"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMember_name_key" ON "CommitteeMember"("name");

-- CreateIndex
CREATE INDEX "CommitteeMember_position_idx" ON "CommitteeMember"("position");

-- CreateIndex
CREATE INDEX "ScrabbleRecord_category_supersededAt_idx" ON "ScrabbleRecord"("category", "supersededAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_reportAuthorId_fkey" FOREIGN KEY ("reportAuthorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrabbleRecord" ADD CONSTRAINT "ScrabbleRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrabbleRecord" ADD CONSTRAINT "ScrabbleRecord_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Contraintes écrites à la main (non exprimables dans schema.prisma).
-- Une seule carte de membre active par membre : elle se règle une fois.
CREATE UNIQUE INDEX "Payment_one_active_card_per_user" ON "Payment"("userId")
  WHERE "kind" = 'MEMBERSHIP_CARD' AND "cancelledAt" IS NULL;
-- Une seule participation active par inscription à une séance.
CREATE UNIQUE INDEX "Payment_one_active_fee_per_registration" ON "Payment"("registrationId")
  WHERE "kind" = 'SESSION_FEE' AND "cancelledAt" IS NULL;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_kind_target" CHECK (
  ("kind" = 'MEMBERSHIP_CARD' AND "userId" IS NOT NULL AND "registrationId" IS NULL)
  OR ("kind" = 'SESSION_FEE' AND "registrationId" IS NOT NULL AND "eventId" IS NOT NULL)
);

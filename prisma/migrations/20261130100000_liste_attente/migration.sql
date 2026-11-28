-- Liste d'attente des rencontres complètes.
--
-- 1. RegistrationStatus.WAITLISTED : une inscription en attente (mêmes uniques, même jeton invité).
-- 2. EventRegistration.waitlistedAt (rang dans la file) et promotedAt (place obtenue depuis la
--    liste), conservés après la promotion ou la sortie : statistiques des listes d'attente.
-- 3. RegistrationMailKind.WAITLIST_PROMOTED : e-mail « une place s'est libérée », renvoyé par la
--    tâche horaire s'il n'est pas parti.
--
-- Tout ou rien. PostgreSQL interdit d'utiliser une valeur d'enum dans la transaction qui l'ajoute :
-- rien ici ne mentionne 'WAITLISTED'.

BEGIN;

-- AlterEnum
ALTER TYPE "RegistrationStatus" ADD VALUE 'WAITLISTED';

-- AlterEnum
ALTER TYPE "RegistrationMailKind" ADD VALUE 'WAITLIST_PROMOTED';

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "promotedAt" TIMESTAMP(3),
ADD COLUMN     "waitlistedAt" TIMESTAMP(3);

-- DropIndex
DROP INDEX "EventRegistration_eventId_status_idx";

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_status_waitlistedAt_idx" ON "EventRegistration"("eventId", "status", "waitlistedAt");

-- Une promotion suppose une entrée sur la liste.
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_promotion_check" CHECK ("promotedAt" IS NULL OR "waitlistedAt" IS NOT NULL);

COMMIT;

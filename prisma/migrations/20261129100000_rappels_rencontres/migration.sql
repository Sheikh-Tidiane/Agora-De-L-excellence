-- Rappels par e-mail la veille des rencontres.
--
-- 1. User.eventReminders : le membre peut désactiver ces rappels dans son profil (actifs par défaut).
-- 2. RegistrationMail : e-mails automatiques liés à une inscription, un seul par sorte, par
--    inscription et par horaire annoncé. Réservation (claimedAt) puis envoi (sentAt).
--
-- Tout ou rien : Prisma n'enveloppe pas une migration dans une transaction.

BEGIN;

-- CreateEnum
CREATE TYPE "RegistrationMailKind" AS ENUM ('EVENT_REMINDER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "eventReminders" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "RegistrationMail" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" "RegistrationMailKind" NOT NULL,
    "eventStartsAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "tokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrationMail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationMail_tokenHash_key" ON "RegistrationMail"("tokenHash");

-- CreateIndex
CREATE INDEX "RegistrationMail_kind_sentAt_idx" ON "RegistrationMail"("kind", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationMail_registrationId_kind_eventStartsAt_key" ON "RegistrationMail"("registrationId", "kind", "eventStartsAt");

-- AddForeignKey
ALTER TABLE "RegistrationMail" ADD CONSTRAINT "RegistrationMail_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Nombre de tentatives borné (le service s'arrête à 3).
ALTER TABLE "RegistrationMail" ADD CONSTRAINT "RegistrationMail_attempts_check" CHECK ("attempts" BETWEEN 1 AND 10);

COMMIT;

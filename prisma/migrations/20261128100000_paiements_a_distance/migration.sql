-- Paiements des membres qui suivent à distance (pas de paiement en ligne intégré).
--
-- 1. Payment.method / Payment.reference : moyen de paiement de chaque encaissement (espèces, Wave,
--    Orange Money) et référence de la transaction, obligatoire pour Wave et Orange Money. Les
--    encaissements existants étaient tous en espèces : ils reçoivent CASH, sans référence.
-- 2. CardReminder : rappels « carte à régler » déjà envoyés, un seul par sorte et par membre.
--
-- Tout ou rien : Prisma n'enveloppe pas une migration dans une transaction.

BEGIN;

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'WAVE', 'ORANGE_MONEY');

-- CreateEnum
CREATE TYPE "CardReminderKind" AS ENUM ('AFTER_ACCEPTANCE', 'BEFORE_DEADLINE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "reference" TEXT;

-- CreateTable
CREATE TABLE "CardReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "CardReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardReminder_userId_kind_key" ON "CardReminder"("userId", "kind");

-- AddForeignKey
ALTER TABLE "CardReminder" ADD CONSTRAINT "CardReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Référence obligatoire hors espèces (sans espaces seulement : refusée aussi).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_reference_check" CHECK (
  "method" = 'CASH' OR ("reference" IS NOT NULL AND length(btrim("reference")) > 0)
);

-- Une même transaction Wave ou Orange Money ne s'enregistre pas deux fois (casse ignorée) ; un
-- encaissement annulé libère sa référence.
CREATE UNIQUE INDEX "Payment_method_reference_active_key"
  ON "Payment"("method", upper("reference"))
  WHERE "reference" IS NOT NULL AND "cancelledAt" IS NULL;

COMMIT;

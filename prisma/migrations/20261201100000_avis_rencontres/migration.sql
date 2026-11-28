-- Avis après les rencontres : note de 1 à 5, commentaire facultatif, un par inscription,
-- commentaire masquable par un responsable, anonymisé 24 mois après la rencontre (la note reste).
-- RegistrationMailKind.FEEDBACK_REQUEST : invitation du lendemain, sans doublon.
--
-- Tout ou rien. PostgreSQL interdit d'utiliser une valeur d'enum dans la transaction qui l'ajoute :
-- rien ici ne mentionne 'FEEDBACK_REQUEST'.

BEGIN;

-- AlterEnum
ALTER TYPE "RegistrationMailKind" ADD VALUE 'FEEDBACK_REQUEST';

-- CreateTable
CREATE TABLE "EventFeedback" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "registrationId" TEXT,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "hiddenAt" TIMESTAMP(3),
    "hiddenById" TEXT,
    "hiddenReason" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventFeedback_registrationId_key" ON "EventFeedback"("registrationId");

-- CreateIndex
CREATE INDEX "EventFeedback_eventId_createdAt_idx" ON "EventFeedback"("eventId", "createdAt");

-- AddForeignKey
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_hiddenById_fkey" FOREIGN KEY ("hiddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Note de 1 à 5.
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_rating_check" CHECK ("rating" BETWEEN 1 AND 5);

-- Commentaire : absent, ou 1 000 caractères au plus et pas seulement des espaces.
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_comment_check"
  CHECK ("comment" IS NULL OR (char_length("comment") <= 1000 AND btrim("comment") <> ''));

-- Masquage : date et motif (3 à 300 caractères) vont ensemble.
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_hidden_check"
  CHECK (("hiddenAt" IS NULL) = ("hiddenReason" IS NULL)
    AND ("hiddenReason" IS NULL OR char_length("hiddenReason") BETWEEN 3 AND 300));

-- Anonymisé : plus d'auteur, plus de commentaire, plus de masquage.
ALTER TABLE "EventFeedback" ADD CONSTRAINT "EventFeedback_anonymized_check"
  CHECK ("anonymizedAt" IS NULL OR ("registrationId" IS NULL AND "comment" IS NULL AND "hiddenAt" IS NULL));

COMMIT;

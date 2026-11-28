-- Accord pour la publication de photos, vidéos ou témoignages identifiables (cahier des charges,
-- § 11.2) : facultatif, donné à l'adhésion et modifiable dans le profil. `null` : pas d'accord
-- (les membres et demandes existants n'en ont pas donné).

BEGIN;

-- AlterTable
ALTER TABLE "MembershipRequest" ADD COLUMN     "mediaConsentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mediaConsentAt" TIMESTAMP(3);

COMMIT;

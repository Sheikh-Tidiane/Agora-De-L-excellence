-- Les jetons de réinitialisation du mot de passe ne sont plus stockés qu'en empreinte SHA-256
-- (src/lib/auth.ts, verification.storeIdentifier). Les jetons encore en clair sont supprimés :
-- ils duraient 60 minutes au plus ; la personne concernée redemande un lien.
-- Aucun changement de schéma.
DELETE FROM "Verification" WHERE "identifier" LIKE 'reset-password:%';

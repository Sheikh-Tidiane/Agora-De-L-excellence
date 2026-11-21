# Prompt à coller dans Claude Code — intégration des contenus officiels

À utiliser pendant la Phase 3, dans une nouvelle session (`/clear`), après avoir placé `CONTENUS-CLUB.md` dans `docs/`.

```
Le comité de pilotage a remis les informations officielles du club. Elles sont dans docs/CONTENUS-CLUB.md, qui fait foi pour tous les textes du site et remplace le cahier des charges sur ces points.

0. Lis CLAUDE.md, docs/PROGRESS.md et docs/CONTENUS-CLUB.md. Si une tâche de la Phase 3 est en cours, termine-la proprement et commite avant de commencer.

1. Mets à jour CLAUDE.md :
   - section 1 : ajoute le slogan, les trois dimensions, les cinq activités, et la règle « docs/CONTENUS-CLUB.md fait foi pour les textes ; ne rien inventer au-delà » ;
   - section 8 : remplace ou complète les règles d'adhésion et ajoute la règle des cotisations (section 9 de CONTENUS-CLUB.md) et le rythme des rencontres (tous les 15 jours, 2 h maximum).
   Reporte les mêmes décisions dans docs/REGLES-METIER.md.

2. Fais un état des lieux : liste ce qui, dans le code et les contenus déjà faits, contredit CONTENUS-CLUB.md (trois piliers au lieu des trois dimensions, liste d'activités, types d'événements, textes de l'accueil et de l'À propos, etc.). Présente-moi cette liste et ton plan de modifications, puis attends ma validation avant de toucher au code.

3. Après validation :
   - migration Prisma pour les nouveaux types d'événements, les champs invité et lien de visio, le comité de pilotage, les records Scrabble, la récompense des tournois et les cotisations (montants en Setting) ;
   - mise à jour du seed : le lancement du 26 décembre 2026 comme vrai événement (isDemo = false, statut provisoire, lieu à confirmer) et les quatre membres du comité ; adapte les données de démo aux cinq activités ;
   - mise à jour des pages publiques : accueil (slogan dans le hero, trois dimensions, cinq activités, mise en avant du lancement), À propos, Activités, Adhésion (montants affichés avant le formulaire), pied de page ;
   - admin : gestion du comité, enregistrement des paiements (carte et participation par séance) et tableau des encaissements ;
   - page /charte (provisoire, modifiable depuis l'admin) reliée à la case du formulaire d'adhésion, version acceptée enregistrée ;
   - compte rendu rattaché aux événements passés et page /archives filtrable par activité ;
   - QR code imprimable vers /membership pour le lancement, et formulaire d'adhésion vérifié pour un remplissage rapide sur téléphone ;
   - ajoute le quiz en ligne au plan de la Phase 4 dans PROGRESS.md (ne pas le construire maintenant).

4. Pour chaque page modifiée, applique la boucle de contrôle visuel de la section 7.5 de CLAUDE.md. Lance typecheck, lint et tests. Mets à jour PROGRESS.md et commite.

Ne remplis aucune information listée comme manquante en section 10 de CONTENUS-CLUB.md : la section correspondante ne s'affiche pas.
```

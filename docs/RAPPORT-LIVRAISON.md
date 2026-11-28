# Rapport de livraison — L’Agora de l’Excellence

> Version livrée : branche `main` au 28 novembre 2026 (phases 0 à 6, compléments de novembre :
> multi-activités, paiements à distance, rappels, liste d'attente, agenda et partage, avis,
> statistiques, accord images, invités). Dépôt distant : GitHub
> (`sheikh-tidiane/agora-de-l-excellence`). Hébergement retenu (OVHcloud VPS, `HEBERGEMENT.md`) ;
> **rien n'est encore en ligne** : procédure prête dans [`DEPLOIEMENT.md`](DEPLOIEMENT.md).

## 1. Fonctionnalités livrées

### Site public

- Accueil, À propos (objectifs, trois dimensions, comité), les cinq activités, charte du club
  (version provisoire tant que le comité ne l'a pas validée), confidentialité, contact.
- Bibliothèque (catalogue filtrable, fiches livres, couvertures générées ou téléversées, avis des
  membres publiés avec leur accord), livre du mois.
- Agenda des rencontres, fiche d'une rencontre, inscription des membres et des visiteurs
  (rencontres ouvertes au public, confirmation par e-mail), comptes rendus. Rencontres à plusieurs
  activités ; liste d'attente avec rang et promotion automatique ; « Ajouter à mon agenda » (.ics,
  Google Agenda) et partage WhatsApp ; rappel la veille ; avis des participants le lendemain
  (membres et invités, lien personnel pour les invités).
- Actualités (articles, publication programmée), archives filtrables (rencontres, fiches de
  lecture, palmarès Scrabble).
- Scrabble : tournois à venir, palmarès, records du club (affichés seulement s'ils existent),
  fiche d'un tournoi avec classement final après validation.
- Adhésion en ligne : montants affichés avant le formulaire, charte à accepter (version
  enregistrée), accord facultatif pour les photos et témoignages, demande sans création de compte.
- Une adresse inconnue de fiche répond un vrai « 404 Not Found ».
- SEO (titres, descriptions, adresses canoniques, image de partage, plan du site, données
  structurées) et application installable (PWA, page hors ligne, carte de membre consultable sans
  réseau).

### Espace membre (`/member`)

- Tableau de bord, profil (téléphone, photo privée, retrait des classements), carte de membre
  numérique avec QR code signé (sans donnée personnelle, remplaçable).
- Mes lectures (à lire, en cours, terminés, favoris, progression, note, critique soumise à
  modération, « livre terminé » validé par un responsable).
- Mes rencontres et mes activités (inscriptions, annulation, liste d'attente, présences, avis).
- Carte de membre réglée à distance (Wave, Orange Money), rappels de paiement.
- Profil : rappels la veille désactivables, accord photos et témoignages.
- Mes récompenses : points, niveaux, badges, classements mensuel et général.
- Scrabble : classement du mois, mes tournois ; quiz chronométrés des Génies du soir.
- Notifications in-app (et e-mail pour les plus importantes).
- Assistant « Le Compagnon des Lettres » (sept modes, quota quotidien), affiché « non connecté »
  sans clé d'API.

### Administration (`/admin`)

- Demandes d'adhésion, membres (suspension, réactivation, renouvellement, archivage), encaissements
  en espèces (carte et participation par séance, totaux), équipe et rôles.
- Livres, catégories et auteurs, livre du mois, lectures et critiques à valider.
- Événements (publication, clôture, annulation, inscrits, export CSV, compte rendu), scan des
  présences par QR code sur téléphone avec saisie de secours.
- Points et badges (barème, ajustements motivés, corrections par ligne inverse, badge manuel).
- Articles, quiz, tournois de Scrabble (joueurs, équipes, manches, saisie des scores sur
  téléphone, validation, publication, dévalidation motivée), records.
- Comité, charte, paramètres du club, journal d'audit, QR d'adhésion, recherche globale et
  raccourcis clavier.
- Scan : pointage des membres (carte) et des invités (recherche), encaissement de la carte et de
  la participation au même endroit.
- Avis des participants (moyennes, modération selon la charte) et statistiques du comité
  (présence, activités, lecture, Scrabble, membres, renouvellements, listes d'attente, export CSV,
  version partenaires sans donnée personnelle).
- Tâches planifiées toutes les heures (`agora-taches.timer`) : rappels de carte et de rencontre,
  liste d'attente, demandes d'avis, purge des avis à 24 mois.

Mode d'emploi : [`GUIDE-ADMINISTRATEUR.md`](GUIDE-ADMINISTRATEUR.md).

## 2. Pages

| Zone           | Pages                                                                                                                                                                                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public         | `/`, `/about`, `/activities`, `/library` et `/library/[slug]`, `/events` et `/events/[slug]`, `/events/registration` et `/events/avis` (liens personnels des invités), `/news` et `/news/[slug]`, `/archives`, `/scrabble` et `/scrabble/[slug]`, `/membership`, `/charte`, `/contact`, `/privacy`, `/offline` |
| Comptes        | `/login`, `/activate`, `/forgot-password`, `/reset-password`, `/access-denied`                                                                                                                                                                                                                                 |
| Espace membre  | `/member`, `/member/readings` et `/member/readings/[id]`, `/member/events` et `/member/events/[slug]/avis`, `/member/scrabble`, `/member/quiz` et `/member/quiz/[slug]`, `/member/rewards`, `/member/notifications`, `/member/assistant`, `/member/profile`, `/member/card`                                    |
| Administration | 35 pages : tableau de bord et une page par rubrique ci-dessus, plus les fiches (article, événement, quiz et ses aperçu et résultats, tournoi, réglages, saisie des scores d'une manche)                                                                                                                        |

## 3. Choix d'architecture

- **Next.js App Router** et TypeScript strict ; composants serveur par défaut, mise en cache des
  lectures publiques (`cacheComponents`) avec invalidation par étiquette à chaque modification.
- **Mutations par Server Actions** ; Route Handlers seulement pour l'assistant en flux, le scan,
  la recherche d'un inscrit, l'export CSV, les téléversements et les photos privées.
- **Logique métier dans `src/features/*/service.ts`**, testable sans React ; schémas Zod partagés
  entre navigateur et serveur.
- **Sécurité** : contrôle d'accès en tête de chaque action et handler (`requirePermission`,
  `requirePageAccess`), RBAC propre au club (6 rôles cumulables), contrôle d'origine sur les
  handlers qui modifient, limites de débit en base, journal d'audit des actions sensibles,
  en-têtes anti-cadre. Détail : [`REVUE-SECURITE.md`](REVUE-SECURITE.md).
- **Authentification** : Better Auth (e-mail et mot de passe, sessions en base) ; le
  super-administrateur se crée en ligne de commande (`pnpm create-admin`), jamais par le seed.
- **E-mails** : une interface unique (`MailService`), SMTP (Mailpit en développement) ou Resend.
- **Assistant** : interface `LLMProvider` abstraite ; fournisseur, clé et modèle choisis par
  variables d'environnement.
- **Honnêteté du produit** : aucune fonction factice ; données de démonstration marquées et
  retirables (`pnpm db:clear-demo`) ; rien n'est affiché pour les informations que le comité n'a
  pas encore fournies.

Décisions détaillées : [`DECISIONS.md`](DECISIONS.md). Règles du club : [`REGLES-METIER.md`](REGLES-METIER.md).

## 4. Migrations

| Migration                                       | Contenu                                                                     |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| `20261112003037_init`                           | Schéma de départ : comptes, rôles, adhésions, bibliothèque, événements…     |
| `20261112180000_contenus_officiels`             | Types d'événements officiels (cinq activités), contenus du club             |
| `20261114120000_phase4_communaute`              | Lectures, présences, points, badges, niveaux, Scrabble, quiz, notifications |
| `20261122040659_messagerie_contact`             | Messages du formulaire de contact                                           |
| `20261122120000_jetons_reinitialisation_haches` | Jetons de réinitialisation stockés hachés                                   |
| `20261127100000_rencontres_multi_activites`     | Plusieurs activités par rencontre, activité principale                      |
| `20261128100000_paiements_a_distance`           | Moyen de paiement et référence (Wave, Orange Money)                         |
| `20261129100000_rappels_rencontres`             | Rappels la veille (`RegistrationMail`), préférence du membre                |
| `20261130100000_liste_attente`                  | Liste d'attente (rang, promotion)                                           |
| `20261201100000_avis_rencontres`                | Avis des participants (`EventFeedback`)                                     |
| `20261202100000_accord_images`                  | Accord photos, vidéos et témoignages                                        |

En production : `pnpm db:deploy` (lancé par `scripts/deploy.sh`).

## 5. Tests exécutés et résultats réels (20/11/2026)

| Contrôle                      | Résultat                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`, `pnpm lint` | Sans erreur                                                                                                   |
| `pnpm test` (Vitest)          | **2 694 tests réussis** (35 fichiers), dont une partie contre la vraie base PostgreSQL                        |
| `pnpm test:e2e` (Playwright)  | **88 réussis, 16 ignorés volontairement, 0 échec** (build de production, mobile et ordinateur)                |
| Matrice des permissions       | 7 profils (visiteur, membre, 5 rôles de responsables) × chaque zone protégée : aucun écart                    |
| Lighthouse mobile (médiane)   | Performance 92 à 99, accessibilité 100 sur 10 pages ; LCP 0,9 à 1,2 s ; CLS ≤ 0,002                           |
| Audit                         | Aucune erreur de console sur 40 pages ; clavier (lien d'évitement, focus visible) ; mouvement réduit respecté |
| Revue de sécurité             | 101 Server Actions et 9 Route Handlers relus ; 4 défauts corrigés avec leurs tests                            |
| Revue design                  | 51 pages : 43 au niveau, aucune « template » ; 7 défauts P1 corrigés (`REVUE-DESIGN.md`)                      |
| Sauvegarde et restauration    | Testées en local : 44 tables, 2 451 lignes restaurées à l'identique, archive des images identique             |

Lighthouse détaillé : `/` 95, `/about` 97, `/activities` 92, `/library` 94, `/events` 98,
`/membership` 98, `/charte` 95, `/archives` 98, `/scrabble` 99, `/news` 98 (émulation Android milieu
de gamme, 4G lente, processeur ralenti 4 fois ; poste de développement chargé, valeurs à
remesurer en ligne).

## 6. Intégrations en attente

| Intégration              | En attente de                                            | Sans elle                                                  |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------- |
| Hébergement et domaine   | Commande du VPS OVH et du domaine, puis `DEPLOIEMENT.md` | Le site ne tourne que sur le poste de développement        |
| E-mails de production    | Compte SMTP (Brevo) ou clé Resend                        | Les e-mails ne partent que vers Mailpit en local           |
| Assistant IA             | Clé `LLM_API_KEY` (et choix du modèle, du quota)         | « Assistant non connecté » ; aucun appel réel n'a été fait |
| Sauvegardes automatiques | Hébergement (scripts et minuterie prêts)                 | Procédure manuelle seulement (`SAUVEGARDE.md`)             |

## 7. Informations attendues du comité

Lieu et horaires habituels des rencontres, lieu du lancement, rôles, photos et biographies du
comité, coordonnées et réseaux, outil de visio, records et récompenses Scrabble, texte définitif
de la charte, validation du barème des points (dont 10 points par quiz) et des noms des niveaux,
expiration de la carte de membre. Rien n'est affiché à leur place.

## 8. Problèmes connus

Choix à trancher détaillés dans [`REVUE-SECURITE.md`](REVUE-SECURITE.md) et
[`REVUE-DESIGN.md`](REVUE-DESIGN.md). Les principaux points :

- Jamais testé sur un vrai téléphone ni derrière le vrai proxy de production (adresse IP lue dans
  `X-Forwarded-For`, en-têtes, cookies hors `localhost`).
- Assistant jamais appelé pour de vrai (pas de clé) : qualité, coût et délais à constater.
- Quelques fichiers dépassent la limite indicative de 300 lignes (à découper).
- `pnpm audit` (28/11/2026) : aucune faille dans les dépendances de l'application (la faille
  « high » d'`effect`, tiré par l'outil Prisma, est corrigée par un `override` dans
  `pnpm-workspace.yaml`). Reste une faille « moderate » de `minimatch` dans les seuls outils de
  développement (ESLint) : sans effet sur le site, corrigée quand `eslint-config-next` la
  mettra à jour.

## 9. Surveillance des dépendances

- `.github/dependabot.yml` : chaque lundi, GitHub propose les mises à jour (paquets npm groupés,
  images Docker de la production) sous forme de demandes de fusion, jamais fusionnées seules.
  À activer une fois dans GitHub : Settings › Code security › « Dependabot alerts » et
  « Dependabot security updates ».
- Avant chaque mise en ligne : `pnpm audit --prod` (aucune faille attendue), puis la suite de
  tests.

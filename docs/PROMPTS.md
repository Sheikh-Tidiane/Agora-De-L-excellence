# PROMPTS.md — Prompts à donner à Claude Code, phase par phase

À placer dans `docs/PROMPTS.md`. Le `CLAUDE.md` à la racine contient les règles permanentes.
Copier le cahier des charges dans `docs/cahier-des-charges.pdf`.

Conseil : une **nouvelle session** Claude Code par phase (contexte propre). Chaque session commence par lire `CLAUDE.md` et `docs/PROGRESS.md`.

---

## Phase 0 — Audit et plan (session 1)

```
Lis CLAUDE.md, docs/cahier-des-charges.pdf et docs/PROMPTS.md.

1. Audite le dossier : fichiers existants, versions de Node, pnpm, Docker. Ne supprime rien.
2. Vérifie les dernières versions stables de Next.js, Prisma, Better Auth, Tailwind et shadcn/ui (npm view) et signale toute incompatibilité connue entre elles.
3. Liste les points du cahier des charges qui restent ambigus ou contradictoires, avec la valeur par défaut que tu proposes.
4. Rédige docs/PROGRESS.md avec le plan détaillé des phases 1 à 6 (tâches cochables).

N'écris aucun code applicatif. Arrête-toi et présente-moi le plan.
```

---

## Phase 1 — Design system + page d'accueil (session 2)

```
Phase 1. Objectif : valider la direction artistique avant de multiplier les pages.
C'est la phase la plus importante du projet. Relis les sections 7 et 7 bis de CLAUDE.md avant de commencer : le design doit être au niveau des références citées, et le mobile est la cible principale.

1. Initialise le projet Next.js selon CLAUDE.md (TypeScript strict, Tailwind, shadcn/ui, ESLint, Prettier, next/font). Copie les fichiers du dossier `logos/` fourni dans `public/logos/`, branche le favicon et les icônes PWA, charge Young Serif et Work Sans via `next/font/google`, et construis toute l'identité à partir du logo « L’Hémicycle » (sections 7.2 et 7.6).
2. Avant de coder, rédige dans docs/DIRECTION-ARTISTIQUE.md : le concept visuel en quelques phrases, la palette finale, les typographies et leur échelle, les principes de composition, le style des animations, et ce qui rend cette identité reconnaissable. Explique en quoi elle évite les pièges listés en 7.3.
3. Crée les tokens de design (couleurs, typo, espacements, rayons, ombres, durées d'animation) et une page /design-system (visible en dev uniquement) montrant : boutons, champs, cartes livre/événement, badges, tuile de lettre, navigation mobile (header, menu plein écran, barre d'onglets du bas), bottom sheet, états vide/chargement/erreur.
4. Crée le composant GeneratedCover (couvertures typographiques générées, belles et variées).
5. Construis la page d'accueil complète avec du contenu de démo en dur (pas encore de base), en la concevant d'abord à 375 px : navbar, hero éditorial pensé pour le format vertical (pas une bannière centrée), trois piliers, sélection de livres (carrousel tactile), section Scrabble, prochains événements, communauté, actualités, appel à l'adhésion, footer. Pas de section témoignages. Rédige de vrais textes, pas du remplissage.
6. Les liens vers des pages non construites pointent vers une page « En construction » unique, que l'on supprimera en phase 3.
7. Applique la boucle de contrôle qualité de la section 7.5 : captures à 375 px d'abord, puis 768 px et 1440 px ; critique honnête face aux références ; refais ce qui fait template ; recapture. Fais au moins deux itérations.
8. Lance Lighthouse mobile (émulation Android + 4G lente) et respecte le budget de la section 7 bis.

Arrête-toi et montre-moi : les captures finales (mobile en premier), docs/DIRECTION-ARTISTIQUE.md et les scores Lighthouse mobile. Point de validation : je dois approuver le design avant la suite.
```

---

## Phase 2 — Fondations techniques (session 3)

```
Phase 2.

1. docker-compose.yml (PostgreSQL + Mailpit), .env.example.
2. Schéma Prisma complet : User, Role, Permission, RolePermission, UserRole, Session (Better Auth), MembershipRequest, Membership, Book, Category, Author, Reading, Review, Event, EventRegistration (membre OU invité), Tournament, TournamentParticipant, Team, Round, Match, Score, PointRule, PointTransaction, Badge, UserBadge, Article, Notification, Setting, AuditLog, RateLimit.
   Clés, relations, contraintes d'unicité, index, createdAt/updatedAt, statuts en enums, champs isDemo et archivedAt là où c'est pertinent. Documente le schéma dans docs/DECISIONS.md.
3. Migration initiale + seed idempotent (rôles, permissions, barème de points, badges, catégories, quelques livres/événements/articles de démo) + script create-admin + script db:clear-demo.
4. Better Auth : inscription par activation, connexion, déconnexion, mot de passe oublié (e-mail via Mailpit), sessions sécurisées.
5. lib/permissions : requireUser, requirePermission, can() ; middleware qui protège /member et /admin. Tests unitaires des permissions pour chaque rôle.
6. Rate limiting, AuditLog, gestion centralisée des erreurs.

Termine par typecheck + lint + tests. Mets à jour PROGRESS.md et commit.
```

---

## Phase 3 — MVP V1 (sessions 4 à 6)

Correspond à la « V1 – MVP » du cahier des charges. Peut se découper en plusieurs sessions.

```
Phase 3 — MVP V1. Construis, dans cet ordre, en reliant tout à la base :

1. Site public : accueil branché sur la base, /about, /activities, /library + /library/[slug] (recherche, filtres catégorie/auteur), /events + /events/[slug] (inscription membre ou invité, capacité, annulation), /news + /news/[slug], /membership (formulaire d'adhésion minimal + accusé de réception par e-mail), /contact, /privacy. Supprime la page « En construction ».
2. Flux d'adhésion complet : demande → validation admin → création de compte → e-mail d'activation.
3. Administration (/admin), conçue d'abord pour le desktop (voir 7 bis) : layout SaaS (sidebar, header, breadcrumbs, recherche, tableaux triables, actions groupées, panneaux latéraux), tableau de bord avec chiffres réels, gestion des demandes d'adhésion, membres (liste, filtres, fiche, statut, suspension, archivage), livres, catégories, événements + inscrits (export CSV), articles (éditeur, aperçu, brouillon/publié/archivé), paramètres du club, comptes administratifs et rôles.
4. SEO : metadata par page, sitemap, robots, Open Graph.
5. PWA : manifest, icônes, couleur de thème, page hors ligne (section 7 bis de CLAUDE.md).

Chaque nouvelle page respecte la direction artistique validée en phase 1 et passe la boucle de contrôle qualité (section 7.5), en commençant par le mobile.

Pour chaque module : tests unitaires des services + un test Playwright du parcours principal.
À la fin, vérifie les 12 critères de recette de la section 13 du cahier des charges un par un et rapporte le résultat de chacun.

Arrête-toi. Point de validation : je teste le MVP avant la phase 4.
```

---

## Phase 4 — V2 Communauté (sessions 7 à 9)

```
Phase 4 — V2 Communauté.

1. Espace membre (/member) : tableau de bord sobre (statut, prochains événements, lectures en cours, points, badges, rang Scrabble), profil + photo, carte de membre numérique avec QR code (jeton opaque).
2. Mes lectures : à lire / en cours / terminé, progression, note, critique (soumise à modération), historique, favoris et listes.
3. Mes inscriptions et mes activités (historique des présences).
4. Présences : page admin de scan QR (caméra du téléphone) pour enregistrer une présence à un événement, avec saisie manuelle de secours.
5. Gamification : règles de points en base, attribution par responsable ou automatique après validation (présence, livre terminé validé, critique validée), anti-doublon, correction par transaction inverse, badges automatiques, classements mensuel et général, page « Mes récompenses ».
6. Scrabble : tournois individuels/équipes, inscriptions, manches, saisie des scores par le responsable, validation puis publication, classements selon la règle du tournoi, palmarès et historique. Teste le calcul de classement avec des cas limites (égalités, forfaits).
7. Notifications in-app (+ e-mail pour les plus importantes).

Mêmes exigences de tests. Arrête-toi pour validation.
```

---

## Phase 5 — V3 Assistant IA (session 10)

```
Phase 5 — « Le Compagnon des Lettres ».

1. Interface de chat soignée dans /member/assistant, réservée aux membres.
2. Couche LLMProvider abstraite (fournisseur et modèle via variables d'env), réponses en streaming via Route Handler.
3. Modes : recommander des livres (en priorité dans le catalogue du club), expliquer un mot, proposer un sujet de débat, générer un quiz, questions de compréhension, aider à structurer une critique sans la rédiger, défi de vocabulaire.
4. Prompt système en français, réponses présentées comme des suggestions ; l'assistant signale qu'une référence hors catalogue doit être vérifiée.
5. Quota par membre et par jour, gestion des erreurs, aucune donnée personnelle envoyée au modèle au-delà du nécessaire.
6. Sans clé API : message clair « Assistant non connecté », aucune réponse simulée.
```

---

## Phase 6 — Qualité et livraison (session 11)

```
Phase 6.

1. Lance tous les contrôles : typecheck, lint, unitaires, Playwright (mobile + desktop), tests de permissions (chaque rôle tente d'accéder à chaque zone protégée).
2. Audit : Lighthouse **mobile** (émulation Android + 4G lente) sur les pages principales, avec le budget de la section 7 bis ; erreurs console, navigation clavier, contrastes, reduced-motion, états vides.
3. Revue design : captures à 375 px de toutes les pages publiques et membre, et à 1440 px de toutes les pages admin (plus 375 px pour les tâches de terrain : adhésions, scan QR, scores). Vérifie la cohérence avec docs/DIRECTION-ARTISTIQUE.md et corrige chaque page qui fait générique ou mal finie sur mobile.
4. Revue sécurité : relis chaque Server Action et Route Handler et confirme la présence du contrôle d'accès et de la validation Zod. Liste ce que tu as trouvé et corrigé.
5. Docs : README (installation, migrations, seed, création admin, lancement), docs/SAUVEGARDE.md (pg_dump + restauration testée), guide administrateur, .env.example complet.
6. Rapport de livraison : fonctionnalités, pages, choix d'architecture, migrations, tests exécutés avec résultats réels, intégrations en attente de clés, problèmes connus.
```

---

## Phase 7 (plus tard) — V4 Scrabble en ligne

Projet séparé, à cadrer à part (dictionnaire ODS sous licence, temps réel, chronomètre). Ne pas le démarrer avec ce prompt.

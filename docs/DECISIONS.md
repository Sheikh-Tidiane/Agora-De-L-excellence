# DECISIONS.md — Choix techniques et schéma de données

> Journal des décisions prises en cours de route. Les règles métier sont dans `REGLES-METIER.md`.

## 1. Infrastructure (phase 2)

| Décision                                                                                                                                                 | Raison                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| PostgreSQL du `docker-compose.yml` exposé sur le port hôte **5433**                                                                                      | Un PostgreSQL local occupe souvent le 5432 sur le poste de développement                                              |
| Ports liés à `127.0.0.1` seulement                                                                                                                       | La base et Mailpit de développement ne doivent pas être joignables depuis le réseau                                   |
| `SMTP_HOST` par défaut `127.0.0.1` et non `localhost`                                                                                                    | Mesuré : le premier envoi de nodemailer vers `localhost` prend 6 s sous Windows (résolution DNS), contre 40 ms        |
| Variables d'environnement validées par Zod (`src/lib/env.ts`), au démarrage via `src/instrumentation.ts`                                                 | Une configuration invalide arrête le serveur avec la liste des variables fautives, sans jamais afficher leurs valeurs |
| Prisma **7.10.1** : générateur `prisma-client`, client généré dans `src/generated/prisma` (ignoré par Git), URL dans `prisma.config.ts`, adaptateur `pg` | Fonctionnement imposé par Prisma 7. `postinstall` lance `prisma generate`                                             |
| `allowBuilds` pnpm pour `prisma`, `@prisma/engines`, `esbuild`                                                                                           | Sans leurs scripts d'installation, le moteur de migration et `tsx` ne fonctionnent pas                                |
| `pnpm typecheck` = `next typegen && tsc --noEmit`                                                                                                        | Les types de routes (`PageProps<"/…">`) doivent être régénérés avant la vérification                                  |

## 2. Authentification

- **Better Auth 1.7.20**, adaptateur Prisma, e-mail + mot de passe, sessions en base. Vérifié par exécution avec Prisma 7 et le client généré : fonctionne sans adaptation.
- **Aucun endpoint HTTP `/api/auth/*` n'est exposé.** Better Auth est appelé uniquement côté serveur (`auth.api.*`) depuis les Server Actions de `features/auth/actions.ts`. Surface d'attaque réduite, une seule limitation de débit (la nôtre, en base), validation Zod systématique. Le limiteur intégré de Better Auth est donc désactivé.
- **Inscription publique désactivée** (`disableSignUp`). Un compte naît de la validation d'une adhésion (phase 3) ou de `pnpm create-admin`.
- **Activation** : jeton aléatoire de 32 octets, dont seul le SHA-256 est stocké dans `Verification` (`identifier = "activation:<hash>"`, `value = userId`). Usage unique, 7 jours, consommé en transaction ; un nouveau lien invalide les précédents.
- **Mot de passe oublié** : mécanisme de Better Auth (jeton d'une heure, usage unique, fermeture de toutes les sessions). La réponse est identique que le compte existe ou non. Un compte jamais activé reçoit un nouveau lien d'activation ; un compte suspendu ou archivé ne reçoit rien.
- **Statut du compte** (`PENDING_ACTIVATION`, `ACTIVE`, `SUSPENDED`, `ARCHIVED`) vérifié à deux endroits : à l'ouverture de session (hook `session.create.before`) et à chaque requête (`loadUserAccess`). Pas de cache de session dans le cookie : une suspension prend effet immédiatement.
- **Mots de passe** : hachage scrypt de Better Auth, 10 caractères minimum, 128 maximum.
- Après connexion, activation ou réinitialisation, la navigation est complète (`window.location`) : le formulaire et le mot de passe saisi quittent la mémoire de la page (Next 16 conserve sinon les pages précédentes masquées).
- `logging.serverFunctions: false` dans `next.config.ts` : par défaut, Next journalise en développement les arguments des Server Actions, donc les mots de passe et les jetons.
- **Adresse IP du visiteur** : lue dans `X-Forwarded-For` pour la seule limitation de débit. **À traiter au déploiement (phase 6)** : le proxy inverse doit écraser cet en-tête, sinon il est falsifiable. La limite par compte ne dépend pas de l'IP et reste efficace dans tous les cas.

## 3. Contrôle d'accès

- Catalogue des permissions et des rôles dans `src/lib/permissions/catalog.ts` ; le seed alimente les tables, et **la base fait foi à l'exécution**.
- `requireUser()` / `requirePermission()` / `requireOwnership()` pour les Server Actions et Route Handlers (lèvent une `AppError`) ; `requirePageAccess()` pour les pages et layouts (redirige).
- `src/proxy.ts` (Next 16 : `proxy`, ex-`middleware`) n'est qu'un filtre optimiste sur la présence du cookie. Le contrôle réel est fait en base dans chaque layout, page et action.
- Les fonctions `forbidden()` / `unauthorized()` de Next sont expérimentales : non utilisées. Un accès refusé redirige vers `/access-denied`.
- `export const instant = false` sur les layouts `/member` et `/admin` : ces espaces attendent la vérification de session et peuvent rediriger.
- `/admin` et `/member` sont, en phase 2, des pages minimales mais réelles (compte, accès, journal d'audit). Les vrais espaces arrivent en phases 3 et 4.

## 4. Erreurs, journal, audit, débit

- `src/lib/errors.ts` : `AppError` (codes typés), `runAction()` qui renvoie toujours un `ActionResult`, `parseInput()` pour Zod. Une erreur inattendue est journalisée et remplacée par un message générique.
- `src/lib/logger.ts` : une ligne JSON par événement ; clés sensibles masquées, e-mails tronqués (`a***@domaine`).
- `src/lib/audit.ts` : `AuditLog`, écrit dans la même transaction que l'action quand c'est possible.
- `src/lib/rate-limit.ts` : fenêtre fixe, incrément atomique en une requête SQL (`INSERT … ON CONFLICT`), clé = HMAC (ni IP ni e-mail en clair).

## 5. Données de démonstration

> **Remplacé le 21/11/2026** (voir « Fin des données de démonstration » en fin de fichier) : plus de bandeau, plus de `pnpm db:clear-demo`. Ce qui suit est l’historique.

- Le bandeau lit la base (`hasDemoData`, mis en cache, revérifié chaque minute) **ou** le drapeau `usesHardcodedDemoContent` : tant que l'accueil affiche le contenu en dur de la phase 1, le bandeau reste, même base vide. Drapeau à supprimer en phase 3.
- La durée de cache a un `stale` de 5 minutes : en dessous, Next exclut le bandeau de la coquille statique (saut de mise en page).
- `pnpm db:clear-demo` s'exécute hors de Next : le bandeau disparaît dans les minutes qui suivent, pas instantanément.

## 6. Tests

- `pnpm test:e2e` construit et sert un **build de production** sur le port 3210 (`PW_DEV=1` pour le serveur de dev). Mesuré sur le poste de développement (7,8 Go de RAM) : le serveur de dev met jusqu'à 60 s à répondre sous Playwright, ce qui rendait les parcours instables.
- Un seul worker par défaut (`PW_WORKERS`).
- Les parcours de compte exigent PostgreSQL et Mailpit (`docker compose up -d`). Les tests unitaires n'exigent rien.

## 7. Schéma de données

Fichier : `prisma/schema.prisma`. Migration initiale : `prisma/migrations/20261112003037_init`.

| Domaine      | Modèles                                                                  | Points notables                                                                                                       |
| ------------ | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Auth         | `User`, `Session`, `Account`, `Verification`                             | Tables de Better Auth, enrichies (`firstName`, `lastName`, `phone`, `status`, `memberNumber`, `isDemo`, `archivedAt`) |
| RBAC         | `Role`, `Permission`, `RolePermission`, `UserRole`                       | Rôles cumulables ; `UserRole.assignedById` trace qui a attribué                                                       |
| Adhésion     | `MembershipRequest`, `Membership`                                        | Demande sans compte ; une ligne `Membership` par période (renouvellement = nouvelle ligne)                            |
| Bibliothèque | `Category`, `Author`, `Book`, `Reading`, `Review`, `MonthlySelection`    | Livre ↔ auteurs en n-n ; `Reading.completionStatus` porte la validation du « livre terminé »                          |
| Événements   | `Event`, `EventRegistration`                                             | Inscription membre **ou** invité                                                                                      |
| Scrabble     | `Tournament`, `Team`, `TournamentParticipant`, `Round`, `Match`, `Score` | Participant membre **ou** extérieur ; `Match` seulement en mode classique                                             |
| Gamification | `PointRule`, `PointTransaction`, `Badge`, `UserBadge`                    | Grand livre immuable, corrections par ligne inverse                                                                   |
| Transverse   | `Article`, `Notification`, `Setting`, `AuditLog`, `RateLimit`            |                                                                                                                       |

Conventions :

- Identifiants `cuid`, `createdAt` / `updatedAt` partout, sauf `PointTransaction`, `AuditLog`, `UserBadge` et `RolePermission` (lignes jamais modifiées : pas de `updatedAt`).
- `isDemo` sur ce que le seed de démonstration crée : `User`, `MembershipRequest`, `Author`, `Book`, `MonthlySelection`, `Event`, `Tournament`, `Article`. Les données de référence (rôles, barème, badges, catégories) ne sont pas de la démonstration.
- `archivedAt` sur `User`, `Book`, `Event`, `Tournament`, `Article` : archivage plutôt que suppression.
- Suppressions : `Restrict` sur tout ce qui porte un historique (adhésions, points, lectures, participations) ; `Cascade` pour ce qui n'a pas de sens sans son parent (sessions, inscriptions d'un événement, scores d'une manche) ; `SetNull` pour les auteurs d'actions.
- Unicités métier : `User.email`, `User.memberNumber`, `Reading(userId, bookId)`, `Review(userId, bookId)`, `MonthlySelection.month`, `EventRegistration(eventId, userId)` et `(eventId, guestEmail)`, `TournamentParticipant(tournamentId, userId)`, `Score(roundId, participantId)`, `PointTransaction(userId, ruleId, sourceType, sourceId)`, `UserBadge(userId, badgeId)`.
- **Contraintes CHECK** écrites à la main dans la migration (Prisma ne les exprime pas) : inscription membre XOR invité ; participant membre XOR extérieur ; deux joueurs distincts par partie ; note de 1 à 5 ; progression de 0 à 100 ; score ≥ 0 ; capacité > 0 ; fin d'adhésion après le début ; transaction de points non nulle ; correction toujours motivée ; e-mail en minuscules.

Écarts par rapport à la liste du prompt de phase 2 :

- Ajoutés : `Account` et `Verification` (requis par Better Auth), `MonthlySelection` (ambiguïté n° 18).
- Niveaux (ambiguïté n° 11) : pas de table dédiée ; les seuils iront dans `Setting` en phase 4. **Remplacé en phase 4** par la table `Level` (section 10).
- Favoris : booléen `Reading.isFavorite`. Les listes personnelles demanderont une migration en phase 4.
- `Article.category` est une chaîne libre (ambiguïté n° 27), pas un enum.

## 8. Contenus officiels du club (novembre 2026)

Source : `docs/CONTENUS-CLUB.md`, remis par le comité de pilotage. Il fait foi pour les textes et remplace le cahier des charges sur ces points.

- **Textes** : slogan dans `src/config/site.ts` et `Setting` (`club.slogan`) ; dimensions, objectifs et rythme dans `src/features/home/content.ts` ; les cinq activités, leurs types d'événements et tous leurs libellés dans `src/config/activities.ts`. Les contenus rédigés avant ces décisions (histoire du club, huit valeurs, « mois type », détails des débats) ont été retirés, pas réécrits.
- **Types d'événements** : l'enum `EventType` est remplacé par les sept valeurs officielles. La migration `20261112180000_contenus_officiels` convertit les lignes existantes (lecture, Scrabble, débat, quiz ; atelier, conférence et « autre » deviennent `LANCEMENT_AUTRE`). Elle est écrite à la main : la conversion générée par Prisma aurait échoué sur des données existantes.
- **Lieu** : `Event.location` devient facultatif ; vide, le site affiche « Lieu à confirmer ». **Date provisoire** : booléen `Event.isTentative`, plutôt qu'un nouveau statut (l'événement reste publié et ouvert aux inscriptions).
- **Déroulé** : `Event.program`, texte d'une étape par ligne (« horaire | intitulé »), lu par `parseProgram`.
- **Invité de l'Agora et visio** : champs `speakerName`, `speakerTitle`, `speakerMode`, `videoLink` sur `Event`. Le lien de visio n'est jamais dans les requêtes publiques mises en cache : il est lu à la demande, pour un membre dont l'inscription est confirmée.
- **Compte rendu** : champs `reportContent` (Markdown), `reportPublishedAt`, `reportAuthorId` sur `Event`. Brouillon ou publié ; affiché sur la page de la rencontre et dans `/archives` (filtres par activité et par année dans l'adresse).
- **Comité** : table `CommitteeMember`. Semé seulement si la table est vide, pour qu'un nom retiré depuis l'admin ne revienne pas. Photos dans le dossier d'upload `committee/`, permission `settings.manage`.
- **Charte** : trois clés `Setting` (`charter.content`, `charter.version`, `charter.provisional`). La version augmente quand le texte change ; `MembershipRequest.charterVersion` et `charterAcceptedAt` gardent ce que le demandeur a accepté.
- **Cotisations** : table `Payment` (carte ou séance), montants dans `Setting` (`fees.membershipCard`, `fees.session`). `Membership.feePaid` et `feePaidAt` sont supprimés. Nouvelles permissions `payments.record` et `payments.read` (rôle administrateur).
- **Scrabble** : table `ScrabbleRecord` et champ `Tournament.reward`, en schéma seulement. Rien n'est affiché : le comité n'a défini ni les records ni les récompenses, et l'administration du Scrabble est en phase 4.
- **QR d'adhésion** : dépendance `qrcode` (servira aussi à la carte de membre). L'affiche `/admin/qr` mène à `/membership#demande` ; elle prévient quand `APP_URL` est une adresse locale.
- **Données réelles et démonstration** : le lancement du 26 décembre 2026 et le comité ne sont pas marqués `isDemo` et survivent à `pnpm db:clear-demo`. Les rencontres de démonstration sont recalées après le lancement, une tous les quinze jours ; les anciennes (novembre 2026) sont retirées par le seed.
- **Schémas partagés** : un schéma Zod utilisé par un formulaire client vit dans un fichier sans dépendance serveur (`committee/schemas.ts`, `settings/charter-schema.ts`), pour qu'aucun composant client n'importe Prisma.

Corrections faites au passage, sur du code de la phase 3 jamais exécuté jusque-là :

- La validation d'une adhésion échouait à chaque fois : `pg_advisory_xact_lock` était appelé par `$queryRaw`, qui ne sait pas lire son résultat `void`. Remplacé par `$executeRaw`.
- Dans la fiche d'un membre, les messages de confirmation et d'erreur s'affichaient derrière le panneau latéral (boîte modale). Ils sont maintenant rendus dans le panneau quand il est ouvert.

## 9. Phase 3 — site public, administration, SEO et PWA

### Rendu et cache

- **Lectures publiques en cache** : chaque requête du site public est une fonction `"use cache"` étiquetée (`books`, `events`, `articles`, `settings`, dans `src/lib/cache-tags.ts`) ; chaque action d'administration appelle `updateTag`. Le site reflète un changement aussitôt, et les pages publiques sont servies en statique. Un changement fait hors de Next.js (seed, script) apparaît en quelques minutes (`revalidate: 60`).
- **Ce qui dépend du visiteur n'est jamais en cache** : panneau d'inscription (session, places restantes), lien de visio, pages `/member` et `/admin`. Ces parties sont rendues à la requête, derrière `<Suspense>`.
- **Adresses inconnues** : `/library/[slug]` et `/news/[slug]` lisent leur paramètre sous `<Suspense>` ; une adresse inconnue affiche la page « introuvable » mais répond HTTP 200 (la page porte `noindex`). `/events/[slug]` est prérendue et répond 404. À aligner en phase 6.
- **Catalogue filtré dans la page** : la recherche et les filtres de `/library` s'appliquent en mémoire au catalogue mis en cache (une seule entrée de cache, recherche insensible aux accents). À revoir si le catalogue dépasse quelques milliers de livres.

### Inscriptions et adhésions

- **Capacité** : vérifiée dans une transaction qui verrouille la ligne de l'événement (`SELECT … FOR UPDATE`). Vérifié par exécution : deux visiteurs, une place, le second est refusé.
- **Invités** : le jeton du lien est aléatoire (32 octets), seul son SHA-256 est stocké ; la confirmation et l'annulation se font par un bouton (requête POST), jamais à l'ouverture du lien, pour qu'un antivirus de messagerie qui visite le lien ne confirme rien.
- **Demande d'adhésion en double** : message explicite plutôt que réponse neutre. Cela révèle qu'une adresse est connue du club ; le risque est borné par la limite de 5 envois par heure et par adresse IP. Choix de lisibilité pour un public jeune, à revoir si besoin.
- **`createPendingUser`** accepte une transaction : le compte, le numéro de membre, l'adhésion et la trace d'audit naissent ensemble ou pas du tout. L'e-mail d'activation part après ; s'il échoue, le responsable le renvoie depuis la fiche du membre.
- **Numéro de membre** : attribué sous verrou consultatif PostgreSQL, pour que deux validations simultanées ne tirent pas le même.

### Administration

- **Tableaux triés et filtrés dans le navigateur** (`components/admin/data-table.tsx`) : le serveur envoie la liste entière, plafonnée (1 000 à 3 000 lignes selon la page). Tri, recherche et filtres sont instantanés et le code serveur reste simple. Suffisant pour un club ; à remplacer par une pagination serveur si les volumes grossissent.
- **Panneau latéral et bottom sheet** : un seul composant sur `<dialog>` natif (volet à droite sur desktop, feuille montante sur mobile), sans bibliothèque. `shadcn init` n'a toujours pas été lancé.
- **Formulaires** : `useActionForm` relie React Hook Form, le schéma Zod partagé et la Server Action ; les erreurs du serveur reviennent sous le champ concerné.
- **Markdown** : rendu par un petit moteur maison (`src/lib/markdown.tsx` : intertitres, listes, citations, gras, italique, liens sûrs), sans dépendance. Aucun HTML saisi n'est interprété.
- **Téléversement et export** : Route Handlers (`/api/admin/uploads`, `/api/admin/events/[id]/registrations`), chacun commençant par `requirePermission`. L'export CSV exige `data.export` et `events.manage`, neutralise les cellules qui commencent par `= + - @`, et est tracé au journal.
- **Stockage des images** : disque local (`UPLOAD_DIR`), servi par `/uploads/[...path]` qui n'accepte que les noms produits par le stockage. **Ne tient pas sur un hébergement sans disque persistant** : à trancher avec l'hébergement (phase 6).

### SEO

- `sitemap.xml`, `robots.txt`, image de partage et adresses canoniques sont construits à partir de **`APP_URL`, lue au moment du build** : elle doit valoir l'adresse publique définitive quand on construit pour la production.
- Image de partage : le logo vertical fourni, tel quel, sur fond indigo (`app/opengraph-image.tsx`). Aucune police à charger, le logo n'est ni redessiné ni recoloré.

### PWA

- **Service worker minimal, écrit à la main** (`public/sw.js`), sans bibliothèque. Il met en cache la page `/offline` et les fichiers statiques (code, polices, logos), **jamais une page ni une donnée** : rien de personnel ne reste sur un téléphone partagé, et aucune page périmée n'est servie.
- **Navigations sans cache HTTP** (`cache: "no-store"`) : sans cela, le navigateur resservait par le service worker une réponse que le serveur autorise à servir périmée (`stale-while-revalidate`), et une modification faite dans l'administration n'apparaissait qu'au second chargement. Défaut trouvé par deux parcours Playwright, corrigé.
- Enregistré **en production seulement** : en développement, il gênerait le rechargement à chaud.
- L'option expérimentale `useOffline` de Next n'est pas utilisée (expérimentale).
- La mise en cache de la carte de membre et du QR code viendra avec la carte elle-même (phase 4).

## 10. Phase 4, partie A — schéma de la V2 Communauté et carte de membre

Fait le 14/11/2026. Migration : `prisma/migrations/20261114120000_phase4_communaute`.

### Schéma

Audit du schéma de la phase 2 face aux parties A, B et C : l'essentiel existait (lectures, critiques, présences, encaissements, points, badges, tournois, notifications). Ajouts :

| Domaine   | Ajout                                                                                                   | Raison                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Carte     | `User.cardSerial` (unique), `cardVersion` (≥ 1), `cardIssuedAt`                                         | Jeton du QR (ci-dessous)                                                                                                                                    |
| Lectures  | `Reading.submittedAt`, `validationNote` ; index `(userId, status)` et `(completionStatus, submittedAt)` | File de validation dans l'ordre d'envoi ; mot du responsable en cas de refus                                                                                |
| Présences | Enum `CheckInMethod` (`QR_SCAN`, `MANUAL`), `EventRegistration.checkInMethod`                           | Distinguer scan et saisie de secours. Les présences existantes sont marquées `MANUAL` par la migration ; le pointage de la phase 3 écrit désormais `MANUAL` |
| Points    | `PointSourceType.QUIZ`                                                                                  | Points de quiz                                                                                                                                              |
| Badges    | `BadgeCriterion.QUIZZES_COMPLETED`                                                                      | Critère disponible ; aucun badge de quiz semé (non décidé)                                                                                                  |
| Niveaux   | Table `Level` (`code`, `name`, `minPoints` uniques)                                                     | Seuils en base, modifiables (remplace le projet de clés `Setting`)                                                                                          |
| Scrabble  | `Tournament.countsForMonthly` (vrai par défaut)                                                         | Exclure un tournoi amical ou interclub du classement mensuel                                                                                                |
| Quiz      | `Quiz`, `QuizQuestion`, `QuizChoice`, `QuizAttempt`, `QuizAnswer`, enum `QuizStatus`                    | Module quiz (partie C)                                                                                                                                      |

Non modifié, jugé suffisant : favoris (`Reading.isFavorite`), modération (`Review`), case « payé » (`Payment`), manches, appariements, scores et forfaits, records, récompense, notifications (`readAt`, `emailSentAt`). Séances d'initiation : type d'événement `INITIATION_SCRABBLE`, sans règle de points (un type sans règle ne rapporte rien).

**Non modélisé, à trancher en partie C** : l'exemption d'un joueur sans adversaire en partie classique quand le nombre de joueurs est impair. Aucun champ n'est ajouté tant que sa valeur (victoire ? quel score ?) n'est pas décidée.

**Contraintes écrites à la main**, vérifiées par exécution sur une base vide (chaque insertion interdite est refusée, chaque insertion permise passe) :

- présence ⇔ méthode de pointage (`EventRegistration_check_in_method`) ;
- un forfait vaut zéro point (`Score_forfeit_zero`) ;
- seule une lecture `FINISHED` peut avoir un `completionStatus` autre que `NONE` ;
- `cardVersion ≥ 1`, `Level.minPoints ≥ 0` ;
- quiz : durée de 1 à 180 minutes, fermeture après l'ouverture ;
- **une seule bonne réponse par question** (index unique partiel) : QCM à réponse unique ;
- tentative : `expiresAt > startedAt`, score entre 0 et `maxScore`, score présent si et seulement si la tentative est finie ;
- une question passée (`choiceId` nul) n'est jamais juste ;
- **la réponse choisie appartient à la question** : clé étrangère composée `(choiceId, questionId)` vers `QuizChoice(id, questionId)`.

**Suppressions** : un quiz qui a des tentatives ne se supprime pas (`Restrict`), il se clôt ; un membre qui a joué non plus (il s'archive). Questions et propositions partent avec un quiz sans tentative.

**Convention des sources de points** (pour le moteur de la partie B) : présence → `EVENT_ATTENDANCE` + identifiant de l'**inscription** ; livre terminé → `READING` + lecture ; critique → `REVIEW` + critique ; tournoi → `TOURNAMENT` + tournoi ; quiz → `QUIZ` + **quiz** (une seule tentative par membre : l'anti-doublon `(userId, ruleId, sourceType, sourceId)` suffit). `pnpm db:clear-demo` s'appuie sur cette convention pour retirer aussi les points gagnés sur un objet de démonstration, y compris par un vrai membre (quiz de démonstration joué). Les badges déjà obtenus grâce à ces points restent.

### Niveaux

Cinq paliers, seuils du cahier des charges, **noms proposés, à valider par le comité** : Esprit curieux (0), Plume en éveil (100), Voix affirmée (300), Pilier de l’Agora (700), Flamme de l’Agora (1 500). Noms épicènes, qui montent de la curiosité à la flamme du slogan. Semés seulement si la table est vide : un niveau renommé ou retiré par l'admin ne revient pas. Calcul : `levelStanding` (`src/features/gamification/levels.ts`), un total négatif compte comme zéro.

### Quiz

- QCM à réponse unique ; une tentative par membre et par quiz ; chrono tenu par le serveur (`expiresAt` posé au début : début + durée, sans dépasser la fermeture du quiz) ; `isCorrect` figé au moment de la réponse ; score calculé par le serveur.
- Règle de points `quiz_completed` : **10 points pour un quiz terminé**, quel que soit le score. Barème proposé, à valider par le comité.
- Permission `quizzes.manage` : administrateur et **responsable communication** (contenus éditoriaux ; aucun rôle n'est dédié aux Génies du soir).
- Démonstration : un quiz publié de cinq questions de lettres et de Scrabble, lié à la rencontre « Génies du soir » de démonstration, marqué `isDemo`.
- Pas de lectures ni de points de démonstration : le seed ne crée aucun compte, il n'y a donc pas de membre de démonstration à qui les rattacher.

### Jeton de la carte de membre

Code : `src/features/members/card-token.ts` (fonctions pures) et `card-service.ts` (base, révocation, image).

- **Format** `A1.<série>.<version>.<signature>`, environ 45 caractères URL-safe : QR petit, lisible vite. La **série** est faite de 12 octets aléatoires propres à la carte, sans lien avec l'identifiant du compte ni le numéro de membre : aucune donnée personnelle dans le jeton, même encodée.
- **Signature** HMAC-SHA256 tronquée à 128 bits, vérifiée en **temps constant** et **avant toute lecture en base** : un jeton forgé ne révèle pas si une carte existe.
- **Secret dérivé de `BETTER_AUTH_SECRET` par HKDF-SHA256** (info `member-card-token/v1`), sans nouvelle variable. Raisons : une variable de moins à configurer (et à oublier) au déploiement ; la dérivation sépare les usages, la clé des cartes n'est pas celle des sessions. Conséquence assumée : changer `BETTER_AUTH_SECRET` invalide toutes les cartes affichées (elles se régénèrent à la prochaine ouverture en ligne), en même temps que les sessions.
- **Pas d'expiration dans le jeton.** La carte doit s'afficher hors ligne, parfois longtemps après le dernier chargement ; une date d'expiration la rendrait inutilisable au mauvais moment. La sécurité repose sur trois contrôles en ligne au moment du scan : version en cours (révocation), compte actif, et l'œil du responsable (le scan renvoie prénom, nom, numéro et photo).
- **Révocation** : `cardVersion` + 1. Le membre peut remplacer sa carte (téléphone perdu, capture partagée) avec `regenerateMyCardAction`, 3 fois par heure au plus ; un responsable (`members.manage`) peut la révoquer avec un motif (`revokeMemberCardAction`). Chaque révocation est écrite dans `AuditLog` (`member.card_revoked`).
- **Limite connue** : un QR statique peut être photographié et présenté par quelqu'un d'autre. Un code tournant (type TOTP) empêcherait l'affichage hors ligne ; le contrôle visuel au scan est la parade retenue.
- **Contenu du QR** : le jeton seul, pas une adresse. Le scan se fait depuis l'administration (partie B) ; une adresse demanderait une page publique de plus et grossirait le code.
- **Image** : `cardQrSvg` produit un SVG (indigo sur blanc, correction d'erreur « M », marge de 2 modules) pour un Server Component, sans JavaScript client, avec la bibliothèque `qrcode` déjà utilisée par l'affiche `/admin/qr`.

## 11. Phase 4, partie B — moteur de points et badges, scan des présences

Fait le 14/11/2026. Code : `src/features/gamification/` (moteur), `src/features/attendance/` (scan), `src/app/api/admin/attendance/` (Route Handlers), `src/app/admin/scan/` (page).

### Moteur de points

- **Grand livre en écriture seule.** Une ligne `PointTransaction` n'est jamais modifiée ni supprimée. Une correction est une ligne inverse (`sourceType = CORRECTION`, `sourceId` et `reversesId` = la ligne corrigée, sans règle) ; `reversesId` est unique : une seule inverse par ligne. L'inverse d'une inverse est refusée (pour revenir en arrière : un ajustement manuel motivé).
- **Anti-doublon à deux niveaux.** Un verrou consultatif de transaction par source (`pg_advisory_xact_lock` sur membre + type + source) sérialise les attributions simultanées ; la ligne d'origine est écrite par `createMany({ skipDuplicates: true })`, c'est-à-dire `INSERT … ON CONFLICT DO NOTHING` sur la contrainte unique (membre, règle, type, source). Une violation d'unicité se lit donc « déjà attribué » **sans faire échouer la transaction de l'appelant** (intercepter l'erreur P2002 aurait laissé la transaction PostgreSQL avortée).
- **Présence décochée puis recochée.** Décocher écrit l'inverse ; recocher écrit une « nouvelle attribution » (même source, sans règle liée, motif « Nouvelle attribution : … »), car la contrainte unique est déjà prise par la ligne d'origine. Le verrou de source garantit qu'il n'y a jamais deux lignes actives pour une même source.
- **Rien n'est payé** : à un invité (pas de compte), à un compte sans numéro de membre ou archivé, pour une règle absente, inactive ou à zéro point, ni **au responsable qui est lui-même le bénéficiaire** (on ne s'attribue jamais de points). Les attributions automatiques renvoient alors `status: "skipped"` avec la raison, sans erreur, pour ne pas bloquer la présence ou la validation ; les gestes manuels (ajustement, correction, badge) le refusent (`FORBIDDEN`). Corriger une ligne dont on est le bénéficiaire est aussi refusé.
- **Ajustement manuel** : entier non nul de −1 000 à 1 000, motif obligatoire (3 à 200 caractères), source `MANUAL` dont l'identifiant est celui de la ligne (hors anti-doublon : deux ajustements identiques sont deux gestes).
- **Barème** : 0 à 1 000 points, actif ou non ; changer une valeur ne recalcule pas le passé. Chaque changement est tracé avec l'avant et l'après.
- **Journal** : `points.awarded` (attributions automatiques comprises ; auteur = responsable du geste, ou système), `points.granted`, `points.reversed`, `points.rule_updated`, `badge.awarded`, `attendance.scanned`.

### Badges

- Réévalués après chaque attribution, correction ou ajustement, **et aussi quand le fait compte sans rapporter de points** (règle inactive, responsable bénéficiaire) : un badge récompense un fait, pas des points.
- Mesurés sur les faits validés : livres `APPROVED`, critiques approuvées, présences pointées (inscription confirmée), débats (`DEBAT_IDEES`), tournois terminés joués, victoires = lignes de points de tournoi encore actives, total du grand livre, quiz terminés.
- **Jamais retirés automatiquement.** Une correction ou une présence décochée ne reprend pas un badge obtenu : retirer une distinction à un jeune membre pour une erreur de saisie serait plus blessant qu'utile, et l'erreur reste visible au journal. Un retrait manuel motivé pourra être ajouté s'il est demandé (non construit).
- Un seuil absent ou inférieur à 1 n'attribue rien (badge mal configuré). Unicité (membre, badge) en base ; écriture par `ON CONFLICT DO NOTHING`.
- Badge manuel « Ambassadeur du savoir » : critère `MANUAL` seulement, motif obligatoire, une fois par membre, jamais à soi-même.

### Classements

- Membres actifs (compte `ACTIVE`, numéro de membre, non archivés), hors `hiddenFromRankings`. Seuls les totaux strictement positifs sont classés.
- **Mois calendaire de Dakar** (UTC+0) ; chaque ligne compte au mois où elle est écrite : une correction faite en décembre d'une ligne de novembre réduit décembre. Plus simple et sans réécriture du passé ; à revoir si le comité préfère rattacher la correction au mois d'origine.
- Égalités « 1, 1, 3 » ; ordre d'affichage stable à égalité : prénom, initiale, identifiant. Prénom + initiale du nom seulement. Top 10, puis la position du membre (`rank: null` s'il n'a pas de points sur la période ; `hidden: true` s'il s'est retiré : il voit ses points mais n'est pas classé).

### Scan des présences

- **Rencontres proposées** : celles du jour (heure de Dakar), publiées ou clôturées, non archivées. Le serveur applique les règles du pointage manuel (inscription confirmée, ouverture le jour de la rencontre) et refuse en plus une rencontre en brouillon ou annulée. Une rencontre passée se pointe toujours depuis sa fiche.
- **Membre non inscrit : refusé**, avec un message clair. Les inscriptions ferment au début de la rencontre et aucune règle ne prévoit l'inscription sur place ; l'ajouter serait une règle nouvelle, à trancher par le comité.
- **Idempotence** : un second scan de la même carte répond « Déjà pointé à 18 h 04 » sans rien changer, sauf ajouter la participation si elle manquait et que « payé » est demandé. Le scan ne retire jamais un encaissement. L'inscription est verrouillée **avant** d'être lue : deux scans simultanés se suivent (défaut trouvé par le test d'intégration et corrigé : le second pouvait annuler l'encaissement du premier).
- **Pointage partagé** : `applyAttendance` (`features/payments/service.ts`) est le cœur unique du pointage manuel et du scan : présence (`MANUAL` ou `QR_SCAN`), participation au montant du réglage, points (`awardAttendancePoints` / `revokeAttendancePoints`), dans la même transaction.
- **Route Handlers** `POST /api/admin/attendance/scan` (jeton ou membre choisi) et `POST /api/admin/attendance/search` : `requirePermission("attendance.record")`, limite de débit par responsable (240 scans et 120 recherches par 10 minutes), Zod. La recherche passe en POST pour que le nom cherché n'apparaisse ni dans l'adresse ni dans les journaux. Encaisser exige en plus `payments.record`. Le jeton n'est jamais journalisé.
- **Décodage du QR** : `BarcodeDetector` du navigateur quand il lit les QR (Chrome Android, la cible principale) ; sinon **jsQR 1.4.0** (version épinglée), chargée à la demande seulement. Choisie parce qu'elle est en JavaScript pur, sans dépendance ni WebAssembly, et très répandue ; elle évolue peu (dernière version en 2020) mais le format QR ne bouge pas. L'alternative maintenue (`barcode-detector`, sur zxing-wasm) charge par défaut un fichier WebAssembly d'environ 1 Mo depuis un CDN : trop lourd et dépendant d'un tiers pour une 4G limitée.
- **Caméra** : démarrée au geste du responsable, coupée quand l'onglet passe en arrière-plan ; aucune image ne quitte le téléphone. Elle exige une page sécurisée (HTTPS ou `localhost`) : avec `pnpm dev:lan` ouvert sur l'adresse IP du poste, le téléphone la refuse ; la saisie de secours reste disponible.
- **Secours** : recherche d'un inscrit confirmé (nom, prénom, numéro), ou texte du QR collé (lu par une autre application). **Le jeton n'est pas imprimé sur la carte de l'espace membre** : l'afficher sous le QR rendrait la saisie au clavier possible (décision laissée à la page de la carte, hors de ce périmètre).
- **Contrôle visuel** : la feuille de résultat affiche la photo (servie par `/api/member/photo`), le prénom, le nom, le numéro, l'état de la carte de membre, la participation, les points gagnés et la méthode du pointage.

### Tests

- Le moteur et le scan sont testés **contre la vraie base PostgreSQL** (`src/test/real-db.ts`, adresse lue dans `.env` ou `TEST_DATABASE_URL`) : contrainte unique, `ON CONFLICT`, verrous et agrégats ne se simulent pas honnêtement. Le moteur tourne dans des transactions annulées ; le scan, qui ouvre ses propres transactions, nettoie ses données à la fin. Sans base joignable, ces tests sont sautés avec un avertissement.

## 12. Phase 4, partie C — quiz en ligne (anti-triche)

Fait le 15/11/2026. Code : `src/features/quizzes/`. Aucune modification du schéma.

### Parcours du membre

- **Rien du corrigé ne quitte le serveur pendant la tentative** : les requêtes du jeu ne sélectionnent pas la colonne `isCorrect` ; l'écran ne reçoit que l'énoncé, les propositions (`id`, `label`), le numéro, le total et le temps restant. La réponse à une question ne dit pas si elle était juste.
- **Départ** : compte actif avec numéro de membre, quiz publié, non archivé, dans sa fenêtre, avec au moins une question. `expiresAt = min(début + durée, fermeture)`, posé par le serveur. Un second départ **reprend** la tentative en cours (rechargement de page) ; une tentative finie interdit tout nouveau départ. Deux départs simultanés : `INSERT … ON CONFLICT DO NOTHING` sur l'unicité (membre, quiz), le second reprend la tentative du premier (testé).
- **Réponse** : tentative verrouillée (`FOR UPDATE`, filtrée sur le membre : celle d'un autre est « introuvable ») ; seule la question courante (la première sans réponse, ordre de l'administration) est recevable ; la proposition doit appartenir à la question (vérifiée par le service et par la clé composée en base) ; `isCorrect` est figé à l'écriture. `choiceId: null` passe la question.
- **Tolérance réseau : 5 secondes** après l'échéance (`NETWORK_GRACE_MS`). Le temps affiché, lui, ne compte pas la tolérance. Au-delà, la réponse est refusée (`accepted: false`) et la tentative se termine. L'échéance effective tient compte d'une fermeture avancée par un responsable.
- **Fin** : explicite, à la dernière réponse, ou automatique à la lecture (écran de jeu, liste des quiz, classement, résultats) une fois la tolérance passée. Idempotente (tentative verrouillée, revérifiée). L'heure de fin enregistrée ne dépasse jamais l'échéance : revenir le lendemain n'allonge pas la durée du classement.
- **Ordre des propositions : mélangé par tentative, stable** (tri par empreinte SHA-256 de « tentative : proposition »), sans stockage. Deux membres côte à côte ne peuvent pas se souffler « c'est la B ». Les questions gardent l'ordre de l'administration.
- **Corrigé : seulement quand le quiz est terminé pour tous** (clos, archivé, ou fermeture passée). Juste après sa tentative, le membre voit son score et sa durée, pas le détail juste/faux : savoir qu'on a eu juste à la question 3 suffit à souffler la réponse à un ami qui n'a pas encore joué.
- **Limite de débit** `quiz.play.user` : 150 gestes (départ, réponse, fin) par membre et par 10 minutes. Large pour un humain (50 questions au plus), freine un script.

### Points et badges

- À la fin d'une tentative, dans la même transaction : règle `quiz_completed`, source `QUIZ` + **identifiant du quiz**, auteur « système » (`actorId: null`), par `awardForSource` (verrou de source + contrainte unique : une seule fois même avec deux fins simultanées, testé). Rien pour un compte qui n'est pas membre, une règle absente, inactive ou à zéro. Les badges sont réévalués ensuite (`evaluateBadges`) ; `QUIZZES_COMPLETED` compte les tentatives terminées (vérifié en test).

### Administration

- **Brouillon** : tout se modifie (réglages, questions, propositions, ordre). Une question se modifie d'un bloc (énoncé + propositions remplacées).
- **Publié ou clos** : seuls le titre, la consigne et la rencontre liée se modifient, et la fermeture tant que le quiz est publié et **pas encore terminé** (nouvelle date dans le futur ; une fois la fermeture passée, le corrigé est visible : rouvrir le quiz laisserait jouer, corrigé en main, ceux qui ne l'ont pas fait, donc c'est refusé). Durée, ouverture, adresse et questions sont figées dès la publication (même sans tentative), pour qu'aucun membre ne joue une version modifiée en cours de route. **Un quiz publié que personne n'a joué peut repasser en brouillon** (verrou partagé du départ contre verrou exclusif : pas de course avec un départ).
- **Publication** : au moins une question, chaque question valide (2 à 6 propositions distinctes, exactement une bonne), au plus 50 questions, fermeture dans le futur. Notification in-app `quiz.published` (une ligne par membre actif, en un `createMany`, dans la transaction) **à la première publication seulement** : `publishedAt` est conservé si le quiz repasse en brouillon, pour ne pas notifier deux fois.
- **Clôture** : termine les tentatives en cours avec les réponses déjà données (score, points), puis statut `CLOSED` et `closedAt`. **Archivage** : seulement un quiz clos ; il quitte l'espace membre, ses résultats restent dans l'administration. **Suppression** : seulement sans tentative et hors ligne (brouillon ou clos) ; un quiz joué se clôt, il ne se supprime jamais.
- Rencontre liée : de type « Génies du soir », non archivée.
- Journal : `quiz.published`, `quiz.unpublished`, `quiz.closed` (nombre de tentatives terminées d'office), `quiz.archived`.

### Classements

- **Par quiz** : tentatives terminées, score décroissant puis durée croissante (à la seconde) ; même score et même durée = même rang (« 1, 1, 3 »). Score 0 classé.
- **Général** : total des bonnes réponses sur toutes les tentatives terminées (la formule la plus simple ; elle favorise la participation régulière). Seuls les totaux positifs sont classés, comme pour les points.
- Membres actifs (numéro, non archivés), hors `hiddenFromRankings` ; prénom + initiale ; top 10 + la position du membre (`rank: null` et `hidden: true` s'il s'est retiré).

### Démonstration

- Le quiz de démonstration (ouvert du 14/11/2026 à la fin de la rencontre « Génies du soir » de février 2027) est jouable tel quel. `pnpm db:clear-demo` retire ses tentatives et les points `QUIZ` qui s'y rattachent (convention de la section 10) ; un badge obtenu grâce à lui reste.

## 13. Phase 4, partie C — Scrabble (couche serveur)

Fait le 15/11/2026. Code : `src/features/scrabble/` (calcul pur `ranking.ts` et `rules.ts`, services, lectures, actions). **Aucune modification du schéma** ; une correction dans `src/lib/demo-data.ts` (voir plus bas).

### Classement d'un tournoi (`ranking.ts`, pur)

- **`WINS_SCORE_SPREAD`** : victoires, puis cumul des scores, puis différentiel (somme de son score moins celui de l'adversaire). **`CUMULATIVE_SCORE`** : cumul seul. La règle se choisit par tournoi ; en duplicate il n'y a pas de partie, donc la règle « victoires » revient au cumul.
- **Forfait** : défaite, score 0 ; l'adversaire présent gagne (avec le score saisi pour lui) ; double forfait : deux défaites. En duplicate, un forfait est une défaite et compte 0.
- **Partie nulle** (classique, scores égaux, sans forfait) : **une demi-victoire chacun**, différentiel nul. Usage courant au Scrabble classique ; aucun champ ajouté.
- **Égalité parfaite** sur tous les critères de la règle : même rang, le suivant saute (1, 1, 3). Pas de départage supplémentaire (ni confrontation directe, ni tirage) : à décider par le comité s'il le souhaite. Ex æquo affichés dans l'ordre du nom.
- **Non classé** : un joueur qui n'a joué aucune manche (`rank: null`). Un tournoi sans score n'a donc aucun vainqueur.
- **Retiré** : garde ses manches jouées, signalé, et **classé après tous les joueurs non retirés** (il n'a pas fini le tournoi) ; il ne peut pas être vainqueur.
- **Classique** : une partie dont un seul score est saisi ne compte pas (signalée) ; un score sans partie (joueur exempté) est refusé à la saisie. **L'exemption (« bye ») reste non modélisée** : à trancher par le comité (victoire ? quel score ?).
- **Équipes** : chaque équipe **additionne** victoires, scores et différentiels de ses joueurs (retirés compris, pour leurs manches jouées), puis est classée par la même règle. Le rang figé (`finalRank`) d'un joueur est **celui de son équipe** ; le rang individuel reste calculé pour la fiche.

### Saisie et résultats

- **Cycle** : brouillon → inscriptions ouvertes → en cours → terminé ; annulé depuis les trois premiers ; retours possibles (inscriptions ↔ brouillon, en cours → inscriptions, terminé → en cours si non validé, annulé → brouillon).
- **Scores** : un par joueur et par manche, entier de 0 à 2 000 (`MAX_SCORE`), forfait → 0 ; saisis par lot pour une manche (`saveScores`), `points: null` efface. Chaque changement est tracé avec l'avant et l'après (`scrabble.scores_saved`).
- **Correction après validation : refusée.** Choix le plus sûr : un score ne change jamais sous des résultats validés (et des points déjà versés). Pour corriger : **dévalider** (`results.publish`, motif obligatoire), ce qui reprend les points de victoire par lignes inverses motivées, efface les rangs **et la publication** ; puis corriger ; puis revalider (si le même membre regagne, le moteur écrit une « nouvelle attribution »). Les badges déjà obtenus restent (règle du moteur).
- **Validation** : tournoi en cours ou terminé, au moins une manche, **aucun score manquant** (duplicate : un score par joueur non retiré et par manche ; classique : deux par partie), en équipes chaque joueur non retiré a une équipe. Fige `finalRank`, `resultsValidatedAt/ById`, passe le tournoi à « terminé ». Le verrou de la ligne du tournoi sérialise saisie, validation et publication.
- **Points** : règle `tournament_win` (barème) au 1er individuel ou à chaque joueur non retiré de l'équipe 1re ; ex æquo : chacun ; source `TOURNAMENT` + identifiant du tournoi. Rien pour un extérieur, un compte sans numéro, une règle inactive, ni **au responsable qui valide sa propre victoire** (le faire valider par un autre responsable, sinon les points ne viennent jamais). Les badges de chaque membre participant sont réévalués (`TOURNAMENTS_PLAYED` compte les tournois « terminés » non quittés, `TOURNAMENTS_WON` les lignes de victoire actives : convention compatible, `badges-service.ts` inchangé).
- **Publication** : seulement après validation, une seule fois. Notification `tournament.results` (in-app et e-mail) à chaque membre participant, retirés compris ; lien vers `/scrabble/<slug>` (`tournamentPublicPath`, à garder aligné sur la page publique).
- **Règle n° 15, minimum honnête** : inscrire un **membre** à un tournoi lié à une rencontre l'inscrit (ou le réinscrit) à la rencontre, confirmé d'office, **sans revérifier la capacité** (c'est un responsable qui inscrit). Non fait : l'inscription d'un membre à la rencontre ne l'inscrit pas au tournoi ; retirer un joueur n'annule pas son inscription à la rencontre ; un extérieur n'a pas d'inscription (pas d'e-mail).
- **Joueurs** : membre actif avec numéro, ou extérieur (nom + club) ; un membre une fois par tournoi, un extérieur une fois par nom (sans tenir compte de la casse). Un joueur qui a joué ne se supprime pas : il se marque « retiré ».

### Classement mensuel

- Tournois `countsForMonthly`, résultats **publiés** dans le mois calendaire de Dakar. Par tournoi, chaque membre classé reçoit **`classés − rang + 1`** points de classement (1er de 8 : 8 ; dernier : 1 ; ex æquo : mêmes points). `classés` compte les joueurs classés, extérieurs compris (en équipes : les équipes classées).
- Calculé à la lecture, rien n'est stocké : une dévalidation retire aussitôt le tournoi (réversible). Membres actifs, hors `hiddenFromRankings`, prénom + initiale, égalités « 1, 1, 3 », top 10 + sa position.

### Noms affichés en public

- Membre : prénom + initiale. **Retiré des classements** (`hiddenFromRankings`) : « Membre de l’Agora » dans les résultats, le palmarès et les records (son rang reste compté). **Mineurs** : traités comme les autres (prénom + initiale, déjà minimal ; pas de date de naissance en base).
- Extérieur : le nom saisi par le responsable, et son club (il peut saisir « Prénom N. » s'il le préfère).
- Avant publication, la fiche publique montre les inscrits (non retirés) sans résultat.

### Records

- Catégories libres ; un détenteur obligatoire (membre ou nom). Battu : l'ancien reste avec `supersededAt` (`replaceRecord`) ; correction d'une saisie (`updateRecord`) ; suppression d'une erreur (`deleteRecord`). Tout est tracé (`scrabble.record_saved`, `scrabble.record_deleted`). Aucun record n'est affiché à vide.

### Démonstration

- Tournoi « tournoi-de-scrabble-mars » (`prisma/seed-scrabble.ts`) : six **participants extérieurs** fictifs (le seed ne crée aucun compte de membre : ni points ni classement mensuel de démonstration), trois manches de duplicate, un forfait, une égalité à la 4e place, résultats validés et publiés, un record « Meilleur score sur une partie ». **La date du tournoi est conservée (6 mars 2027)** : les résultats d'un tournoi à venir s'affichent, ce que seul le bandeau de démonstration justifie.
- `clearDemoData` supprime d'abord les parties des tournois de démonstration : sans cela la cascade échouait (`Match` retient ses joueurs en `Restrict`). Défaut trouvé par le test d'intégration.

## 14. Phase 5 — Assistant IA « Le Compagnon des Lettres » (couche serveur)

Fait le 15/11/2026. Code : `src/lib/llm/` (interface `LLMProvider`, fournisseur principal), `src/features/assistant/` (`modes.ts`, `schemas.ts`, `prompt.ts`, `quota.ts`, `service.ts`, `queries.ts`), `src/app/api/assistant/route.ts`. **Aucune modification du schéma Prisma, aucune migration.** Aucun appel réel au modèle n'a été fait (aucune clé configurée).

### Fournisseur et paramètres d'API

- SDK officiel du fournisseur (dépendance déclarée dans `package.json`), jamais d'appel HTTP brut. Client construit avec la clé `LLM_API_KEY` explicite (`authToken: null`) : le SDK ne va chercher aucun autre identifiant de la machine (variables d'environnement du SDK, profil local). Délai 90 s par tentative, 2 nouvelles tentatives (défaut du SDK) sur les erreurs passagères.
- Modèle : `LLM_MODEL`, **obligatoire avec la clé**, sans valeur par défaut dans le code (sans lui : « Assistant non connecté »). Fournisseur : `LLM_PROVIDER` (seul `principal` existe ; un autre fournisseur s'ajoute dans `src/lib/llm/index.ts`).
- **Pensée adaptative** (`thinking: { type: "adaptive" }`, la seule possible sur ce modèle) et **effort `low`** (`output_config.effort`) : un échange de chat court, la latence compte sur un téléphone en 4G. Le défaut du modèle serait `medium` ; on le fixe explicitement. Pas de `temperature`, pas de préremplissage.
- **Repli serveur sur refus activé par défaut** : beta `server-side-fallback-2026-07-01` + `fallbacks: "default"` (l'API choisit le modèle de repli selon la catégorie du refus). D'où l'endpoint beta (`client.beta.messages.stream`). Pour le retirer : ces deux lignes de `src/lib/llm/sdk-provider.ts`.
- `max_tokens` : **8 000** (pensée comprise). Plafond de coût volontaire pour des réponses qui tiennent sur un écran de téléphone ; au-delà, la réponse se termine par une note « Réponse coupée… ».
- Cache : le prompt système part en blocs dans l'ordre **règles générales (en cache) → catalogue (en cache) → consigne du mode** ; la conversation vient après. Les règles seules sont probablement sous le seuil minimal de mise en cache du modèle (le cache ne s'active alors pas, sans erreur) ; avec le catalogue, le préfixe grossit. Rien de variable (date, identifiant) n'entre dans les blocs en cache. À vérifier avec `cacheReadTokens` dans les journaux dès qu'une clé existe.
- Constaté en test (fetch simulé) : le SDK 1.8 envoie la clé dans l'en-tête `Authorization: Bearer` et un en-tête de version de l'API.

### Contrat de la route `POST /api/assistant`

Ordre des contrôles : session et `member.access` → Zod → fournisseur configuré → limite de débit → quota → appel.

| Cas                                           | Réponse                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sans session (ou compte non actif)            | 401 `{ error, code: "UNAUTHENTICATED" }`                                                                                                              |
| Sans `member.access`                          | 403 `{ error, code: "FORBIDDEN" }`                                                                                                                    |
| Corps invalide                                | 400 `{ error, fieldErrors }`                                                                                                                          |
| Sans clé                                      | 503 `{ error: "Assistant non connecté", code: "NOT_CONFIGURED" }`                                                                                     |
| Rafale                                        | 429 `{ error, code: "RATE_LIMIT", resetAt }` + `Retry-After`                                                                                          |
| Quota du jour atteint                         | 429 `{ error, code: "QUOTA", resetAt }` (minuit suivant) + `X-Assistant-Remaining: 0`                                                                 |
| Panne du fournisseur avant le premier mot     | 502 `{ error, code: "UPSTREAM" }` ; question rendue ; `X-Assistant-Remaining` ajusté                                                                  |
| Annulation par le client avant le premier mot | 499 `{ error, code: "CANCELLED" }` (le client ne la lit pas) ; question **comptée** (relecture : sinon « Arrêter » répété contournait le quota)       |
| Erreur inattendue (base…)                     | 500 `{ error, code: "INTERNAL" }` ; question rendue                                                                                                   |
| Succès                                        | 200 `text/plain; charset=utf-8`, texte brut diffusé au fil de l'eau, `X-Assistant-Remaining: <n>`, `Cache-Control: no-store`, `X-Accel-Buffering: no` |

- Le serveur attend le premier morceau de texte avant d'envoyer les en-têtes : une panne à ce stade devient une erreur JSON propre. Conséquence : la pensée du modèle (non affichée) précède l'arrivée des en-têtes ; à effort `low`, elle est courte.
- Panne en cours de diffusion : le flux se termine par `\n\n[Réponse interrompue. Réessayez.]` puis se ferme. Refus (`stop_reason: "refusal"`) : `[Le Compagnon des Lettres ne peut pas répondre à cette demande. Reformulez-la autour de la lecture, des mots ou des jeux de l’esprit.]`, après le texte déjà parti s'il y en a (il ne peut pas être repris). Réponse coupée (`max_tokens`) : `[Réponse coupée : …]`.
- Annulation : le signal de la requête (`request.signal`) et l'annulation de la lecture du flux arrêtent l'appel au fournisseur.
- Pas de numéro de membre exigé : `member.access` est la règle d'accès de tout l'espace membre ; une condition de plus serait une règle nouvelle, non demandée.

### Quota

- **Défaut 20 questions par membre et par jour**, réglable par `ASSISTANT_DAILY_LIMIT` (1 à 500). Variable d'environnement plutôt que `Setting` : le plus simple, sans écran d'administration à construire ; passer en `Setting` plus tard ne touche que `getAssistantStatus` et la route.
- **Stockage dans la table existante `RateLimit`** (pas de nouvelle table, donc pas de migration) : une ligne par membre et par jour, clé = HMAC de `assistant.daily:<id>:<jour>` (aucun identifiant en clair), expiration le surlendemain à minuit, nettoyée par `purgeExpiredRateLimits`. Réversible : une table dédiée reste possible si l'on veut des statistiques.
- Jour de Dakar = jour UTC (UTC+0 toute l'année).
- Réservation **atomique** en une requête (`INSERT … ON CONFLICT DO UPDATE … WHERE count < limite RETURNING`) : deux requêtes simultanées sur le dernier crédit n'en laissent passer qu'une (testé en base réelle, ainsi qu'une rafale de 20 requêtes sur un quota de 6).
- Une question est **comptée quand le modèle commence à répondre** (HTTP 200). Elle est **rendue** si le fournisseur échoue ou sur erreur inattendue. Une annulation par le membre, même avant le premier mot, la laisse comptée : le modèle a déjà lu la demande et réfléchi (facturé), et un « Arrêter » répété aurait contourné le quota (constat de la relecture). Elle reste comptée si la réponse est interrompue en cours de route, refusée ou coupée : le fournisseur a travaillé (et facturé).
- Limite de débit en plus : 5 questions par minute et par membre (`assistant.ask.user`).
- `pnpm db:clear-demo` : rien à nettoyer (aucune donnée de démonstration pour l'assistant).

### Prompt et données

- `prompt.ts` est pur : il ne reçoit que le mode et le catalogue, donc aucune donnée du membre ne peut y entrer. Nom du club lu dans `src/config/site.ts` (`site.name`, constant, ce qui garde le bloc en cache stable ; un nom modifié dans `Setting` n'y apparaît pas, à revoir si le nom change).
- Catalogue joint aux modes `recommend`, `comprehension`, `review` et `quiz` : livres publiés et non archivés, coups de cœur d'abord puis ordre alphabétique, 150 au plus, une ligne « « Titre » — Auteurs (Catégorie) » ; retours à la ligne et caractères de contrôle retirés, champs bornés (pas d'injection par un titre sur plusieurs lignes).
- Garde-fous : le texte du membre est une donnée et non une consigne ; l'historique envoyé par le navigateur ne fait jamais autorité ; la conversation doit commencer et finir par une question (pas de préremplissage forgé) ; rôle `system` refusé par Zod ; champs inconnus retirés.
- Journaux : mode, raison d'arrêt, modèle et nombre de jetons à la fin d'une réponse ; genre et statut HTTP de l'erreur en cas de panne. Jamais la question, la réponse, le prompt, la clé ni l'identifiant du membre (vérifié par un test).
- Aucune conservation des conversations en base.

### Tests

- Fournisseur simulé dans `src/test/fake-llm.ts`, importé **uniquement par les tests**. Fournisseur principal testé avec le vrai SDK et un `fetch` simulé (option `fetch` de `createSdkProvider`, réservée aux tests) : paramètres envoyés, lecture du flux, erreurs typées.
- Route ajoutée à `src/app/route-handlers-security.test.ts` (matrice des rôles, sans clé : 401 / 403 / 503) ; tests détaillés dans `src/app/api/assistant/assistant-route.test.ts`.

## Fin des données de démonstration (21/11/2026)

Décision du porteur du projet : la base ne contient plus de données de démonstration. Les contenus existants sont des contenus réels, à corriger par l’administrateur depuis l’admin ; rien n’est supprimé.

- **Conversion** : `scripts/convertir-donnees-demo.ts` (versionné). Sans option, il compte ; avec `--appliquer`, il passe `isDemo` à `false` en SQL direct (Prisma aurait modifié `updatedAt`), dans une transaction qui compare, pour chacune des 43 tables, le nombre de lignes et une empreinte de toutes les colonnes hors `isDemo`, avant et après : la moindre différence annule tout. Appliqué le 21/11/2026 sur la base locale, après sauvegarde (`backups/agora-20261121-172035.dump`) : 32 enregistrements (8 livres, 8 auteurs, 6 rencontres, 3 articles, 3 demandes d’adhésion, 1 livre du mois, 1 tournoi, 1 record, 1 quiz, 0 compte), aucune ligne ajoutée ni supprimée, contenu identique. Sur une autre base (production), le relancer de la même façon ; relancé sur une base déjà convertie, il ne fait rien et ne réécrit pas la liste.
- **Liste à corriger** : `docs/A-CORRIGER.md`, un lien vers la page d’édition de chaque enregistrement.
- **Interface** : bandeau « Données de démonstration » retiré du site public, de l’espace membre et de l’admin (`DemoBanner`, `hasDemoData`, étiquette de cache supprimés). Les anciennes entrées du journal `demo.cleared` restent lisibles sous le libellé « Données d’exemple supprimées (ancienne commande) ». Le mot « démonstration » qui reste dans le programme du lancement (« courte démonstration » de chaque activité) vient de `docs/CONTENUS-CLUB.md` et désigne une animation réelle.
- **Seed** : référence (rôles, permissions, barème, badges, niveaux, catégories, réglages) et contenus officiels (lancement, comité) seulement. `prisma/demo-data.ts`, `prisma/seed-scrabble.ts`, `src/lib/demo-data.ts`, `scripts/clear-demo.ts` et la commande `pnpm db:clear-demo` sont retirés : plus rien à nettoyer. Les exemples de la page interne `/design-system` (absente en production) et du test des couvertures générées vivent dans `src/app/design-system/exemples.ts`, jamais écrits en base.
- **Champ `isDemo`** : gardé dans le schéma (le retirer demanderait une migration sans bénéfice immédiat) ; l’application ne le lit plus. Les comptes de test des parcours Playwright le portent encore ; ils sont nettoyés par leur adresse `@e2e.agora.test` ou leur préfixe `E2E-`.
- **Tests** : les tests de `db:clear-demo` et du quiz de démonstration sont retirés avec ce qu’ils vérifiaient. Le parcours public `phase3-pages` crée désormais son propre livre et son propre article (`test-user.ts create-content`) au lieu de compter sur les contenus semés. `accueil.spec.ts` vérifie que le bandeau a disparu.

# PROGRESS.md — Suivi d'avancement

> À lire au début de chaque session, après `CLAUDE.md`.
> Dernière mise à jour : 20 novembre 2026 (phases 0 à 6 terminées et validées ; prochaine : mise en ligne).

## État actuel

- **Fait** : phase 0 (audit et plan) ; phase 1 (design system + page d'accueil), design approuvé le 12/11/2026 ; phase 2 (fondations techniques) ; **phase 3 (MVP V1), terminée le 14/11/2026** : site public, adhésion, administration, contenus officiels, SEO, PWA, recette (`docs/RECETTE.md`), cohérence selon le visiteur (`docs/AUDIT-VISITEURS.md`).
- **En cours** : rien. **Phases 0 à 6 terminées et validées** (phase 6 validée le 20/11/2026 ; rapport : `docs/RAPPORT-LIVRAISON.md`). Prochaine : la mise en ligne.
- **Prochaine étape** : la **mise en ligne**, que le porteur du projet a placée avant la phase 4 (le lancement du 26 décembre 2026 exige que l'adhésion fonctionne en ligne). Trois options dans `docs/HEBERGEMENT.md` ; **en attente de son choix**, ainsi que du nom de domaine et de qui ouvre les comptes. Ensuite : phase 6 (plan plus bas).
- **Dépôt Git** : tout est commité sur `main`. **Aucun dépôt distant n'est configuré** (`git remote -v` vide) : rien n'a jamais été poussé.

### Contrôles au 14/11/2026

`pnpm typecheck`, `pnpm lint`, `pnpm test` (1 043 tests unitaires) et `pnpm build` passent. Suite Playwright entière relancée sur le dernier code, build de production : **80 parcours, 68 réussis, 12 ignorés volontairement (administration et responsables sur mobile, menu plein écran sur desktop), 0 échec.**

### Réserves et décisions en attente (à lire avant la phase 4)

**À décider par le porteur du projet**

- Hébergement, nom de domaine, comptes (hébergeur, Brevo pour les e-mails) : `docs/HEBERGEMENT.md`.
- Informations manquantes du comité (`docs/CONTENUS-CLUB.md` §10) : lieu des rencontres et du lancement, rôles, photos et biographies du comité, coordonnées et réseaux, jour et heure habituels, records et récompenses Scrabble, outil de visio, texte définitif de la charte. Rien n'est affiché à leur place.
- La carte de membre expire-t-elle ? (le code garde 12 mois, non affichés).
- Choix signalés par les relectures, rien n'a été changé :
  - un responsable sans le rôle « membre » peut s'inscrire à une rencontre ;
  - un administrateur peut réactiver un responsable suspendu par un super-administrateur ;
  - la demande d'adhésion et l'inscription invité révèlent qu'une adresse est déjà connue du club ;
  - cinq tentatives de connexion bloquent un compte 15 minutes pour tout le monde ;
  - retirer une inscription n'annule pas une participation déjà encaissée ;
  - sans JavaScript, ce qui dépend du visiteur (boutons du header, appels à adhérer) reste invisible ;
  - après une suspension, le header peut afficher « Mon espace » jusqu'à 60 s (l'accès réel est refusé tout de suite) ;
  - pour un membre, quelques blocs du bas de page réservent leur place puis disparaissent (petit saut de mise en page, non mesuré).

**Reste à faire ou à vérifier**

- Recette : critère 11 (sauvegardes) satisfait **en local seulement**, à refaire en ligne ; critère 12 (test par les fondateurs) à constater ; critère 10 vérifié en émulation, **jamais sur un vrai téléphone**.
- Relectures par un sous-agent sur **Fable** : quota épuisé jusqu'au 20/11. La correction de session (commit `f06c515`) n'a été relue par aucun sous-agent ; la cohérence selon le visiteur (`2774c70`) a été relue par `relecteur-expert` **sur Opus 5.5**. À faire relire sur Fable quand le quota revient, si le porteur le souhaite.
- Lighthouse à remesurer : les pages publiques lisent maintenant la session à plusieurs endroits.
- Non vérifiés : bouton retour du navigateur après déconnexion ; lecteurs d'écran réels ; cookie de session sur une adresse autre que `localhost` (réseau local, `http` hors `localhost`) ; envoi par Resend ou Brevo (seul SMTP vers Mailpit a tourné) ; `pnpm create-admin` au clavier dans un vrai terminal ; archivage d'un membre (irréversible, jamais exécuté) ; purge des demandes refusées après 12 mois (jamais exécutée).
- Critique visuelle §7.5 faite par captures sur les pages publiques, `/member`, `/offline` et l'administration, mais pas page par page pour toutes les fiches.

### Intégration des contenus officiels (13/11/2026)

Source : `docs/CONTENUS-CLUB.md` (comité de pilotage), qui fait foi pour les textes. Détail des choix : `docs/DECISIONS.md` §8.

**Fait et vérifié par exécution** :

- Migration `20261112180000_contenus_officiels` appliquée ; seed relancé deux fois (idempotent) : lancement du 26 décembre 2026 (réel, date provisoire, lieu à confirmer), quatre membres du comité, six rencontres de démonstration après le lancement.
- Site public : accueil (slogan dans le hero, lancement, trois dimensions, cinq activités), `/about`, `/activities`, `/membership` (montants avant le formulaire, case charte), pied de page, nouvelles pages `/charte` et `/archives`, page d'une rencontre (déroulé, invité, compte rendu, lien de visio pour les inscrits).
- Administration : champs d'événement (lieu facultatif, date provisoire, déroulé, invité, visio), compte rendu, pointage « présent / payé », encaissement de la carte sur la fiche d'un membre, `/admin/payments`, `/admin/committee`, `/admin/charter`, `/admin/qr`.
- Contrôles : `pnpm typecheck`, `pnpm lint`, `pnpm test` (108 tests, dont 17 nouveaux dans `src/features/contenus.test.ts`), `pnpm build`.
- Parcours Playwright `e2e/contenus.spec.ts` (mobile et desktop pour le site public, desktop pour l'administration) : demande d'adhésion refusée sans la charte puis envoyée, validation, carte encaissée, séance créée avec invité et visio, inscription, pointage et participation, tableau des encaissements, compte rendu publié, archives filtrées.
- Contrôle visuel §7.5 : captures dans `docs/captures/contenus/` (site public à 375 / 768 / 1440 px ; administration à 1440 / 1280 / 375 px). Reprises faites : gradins vifs retirés derrière la liste des activités, montants empilés sur mobile, bandeau final des activités, tableaux d'encaissements sans défilement horizontal.

**Deux bogues de la phase 3 trouvés et corrigés en exécutant** : la validation d'une adhésion échouait toujours (verrou PostgreSQL lu par `$queryRaw`) ; les messages de la fiche d'un membre s'affichaient derrière le panneau latéral.

**Non fait ou non vérifié** :

- L'impression réelle de l'affiche QR n'a pas été essayée (aperçu écran seulement), ni la lecture du code par un téléphone : en local, il pointe vers `localhost`.
- Les archives ne relient pas encore les fiches de lecture validées ni les palmarès Scrabble : ces pages n'existent pas avant la phase 4.
- Records et récompenses Scrabble : schéma seulement, aucune interface.

### Vérifications complémentaires (13/11/2026, après l'intégration des contenus)

**Deux gestes d'administration exécutés et couverts** (`e2e/admin-terrain.spec.ts`) :

- Photo d'un membre du comité : un fichier qui n'est pas une image est refusé, une vraie image est téléversée (nom régénéré), elle paraît dans l'admin et sur `/about`, puis le membre est retiré.
- Annulation d'un encaissement de carte : motif obligatoire, la carte redevient « à régler », la ligne annulée reste visible avec son motif dans les derniers encaissements, l'annulation est au journal, un nouvel encaissement reste possible.

**Pages de la phase 3 jamais ouvertes : faites** (`e2e/phase3-pages.spec.ts`, mobile et desktop pour le site public, desktop pour l'administration ; console sans erreur ni réponse 5xx exigée) :

- Site public : `/library` (catalogue, recherche sans résultat, fiche, adresse inconnue), `/news` et un article, `/contact` (envoi refusé à vide, puis message réellement reçu dans Mailpit), `/privacy`.
- Administration : livres (création avec couverture téléversée, fiche publique), catégories et auteurs, livre du mois, articles (brouillon, publication, lecture en ligne, dépublication), paramètres (sans changement, puis un réglage modifié et remis), charte (deux enregistrements, texte remis), équipe (compte créé, rôle ajouté), journal.
- Captures locales dans `docs/captures/phase-3/` (dossier ignoré par Git).

**Défauts trouvés et corrigés à cette occasion** :

1. Six signes de ponctuation (« : » et « ? ») étaient remplacés par un caractère de contrôle dans `prisma/demo-data.ts` : un carré vide s'affichait dans des résumés de livres et un titre d'article. Fichier corrigé ; le seed ne réécrit pas les lignes existantes, donc sur une base déjà remplie : `pnpm db:clear-demo` puis `pnpm db:seed` (la base locale a été réparée à la main).
2. Éditeur d'article : le message « Article publié » disparaissait aussitôt, l'éditeur étant remonté à chaque changement de statut. Même défaut sur la charte (remontée à chaque nouvelle version). Les deux restent montés.
3. Article dont le premier paragraphe tient sur une ligne : la lettrine chevauchait la liste ou l'intertitre suivant.
4. Éditeur d'article : le statut s'affichait deux fois (« Brouillon Brouillon »).

**Lighthouse mobile** (`node scripts/lighthouse.mjs`, build de production, réglages mobiles par défaut : Moto G Power, 4G lente simulée, processeur ×4 ; médiane de trois passes, entre parenthèses les trois passes) :

| Page                           | Avant (1 passe) | Après             | Accessibilité avant → après | LCP après | CLS après |
| ------------------------------ | --------------- | ----------------- | --------------------------- | --------- | --------- |
| `/`                            | 78              | 84 (74 / 84 / 99) | 96 → 100                    | 1,2 s     | 0         |
| `/membership`                  | 77              | 87 (79 / 87 / 98) | 100 → 100                   | 1,1 s     | 0         |
| `/charte`                      | 82              | 91 (85 / 91 / 98) | 100 → 100                   | 0,8 s     | 0         |
| `/archives`                    | 80              | 95 (92 / 95 / 97) | 98 → 100                    | 0,9 s     | 0         |
| `/events/lancement-de-l-agora` | 63 (LCP 4,1 s)  | 93 (91 / 93 / 97) | 100 → 100                   | 0,9 s     | 0         |

Ce qui a été corrigé :

- Les liens visibles dès le premier écran (logo, « Adhérer », boutons du hero) ne préchargent plus leur page : chaque page téléchargeait et traitait le formulaire d'adhésion et ses 160 Ko de JavaScript (Zod, React Hook Form). Poids d'une page sans formulaire : 357 → 283 Ko.
- Page d'une rencontre : plus de squelette autour de la fiche. Les rencontres publiées sont prérendues (`generateStaticParams`), les autres rendues en entier à la demande (`export const instant = false`) : le titre est dans le premier HTML. Le squelette du panneau d'inscription réserve la hauteur du formulaire (CLS 0).
- Contraste du nom d'auteur sur le bandeau des couvertures générées (2,4:1 → 5,2:1 ou plus selon la palette) ; titre des états vides en `h2` (ordre des titres).

**Objectif Performance ≥ 90 non tenu en médiane pour l'accueil (84) et l'adhésion (87).** Le même build donne de 74 à 99 selon la charge du poste au moment de la passe (indice de puissance relevé par Lighthouse : de 650 à 2 100) : à remesurer sur une machine au repos ou en intégration continue avant de conclure. Ce qui pèse encore : l'hydratation de l'accueil (≈ 1 050 nœuds) et, sur l'adhésion, le JavaScript du formulaire.

**Serveur de dev sur le réseau local** : `pnpm dev:lan` (écoute sur 0.0.0.0) ; `next.config.ts` autorise en développement les adresses du poste sur le réseau. Limites : les liens des e-mails et le QR pointent vers `APP_URL` (localhost), la connexion à un compte depuis le téléphone n'a pas été essayée.

**En attente du comité** (section 10 de `CONTENUS-CLUB.md`, rien n'est affiché à la place) : lieu des rencontres et du lancement, rôles, photos et biographies du comité, coordonnées et réseaux, jour et heure habituels, récompenses et records, outil de visio, texte définitif de la charte. À trancher aussi : la carte de membre expire-t-elle (le code garde 12 mois, non affichés) ?

### Cohérence du site selon le visiteur (14/11/2026)

Audit et corrections : `docs/AUDIT-VISITEURS.md` (tableau page × visiteur : visiteur, membre dont la carte n'est pas réglée, membre à jour, responsable).

- **Fait dans la session principale** : `getViewer()` (`src/features/auth/viewer.ts`, `use cache: private`) et `ByViewer` / `ForVisitors` (`src/components/layout/by-viewer.tsx`) ; header et menu sans clignotement (repli **invisible** au lieu d'un faux état « visiteur », navigations instantanées grâce au cache du navigateur) ; libellés « Se connecter » et « Adhérer » / « Mon espace » et « Se déconnecter » (« Mon espace » mène un responsable à l'administration) ; plus aucun appel à adhérer pour un connecté (accueil, À propos, Activités, Agenda, Contact, Charte, pied de page) ; `/membership` dit à un membre qu'il l'est déjà ; la charte lui rappelle qu'il l'a acceptée ; `/member` montre l'état de la carte et comment la régler ; « Connectez-vous » sur une rencontre y ramène après connexion.
- **Relecture** : sous-agent `relecteur-expert`, **lancé sur Opus 5.5 et non sur Fable** (quota Fable épuisé jusqu'au 20/11). Quatre défauts corrigés par lui : `safeNextPath` acceptait espaces, caractères de contrôle et `..` ; HTML invalide (`<div>` dans un `<ul>` et dans un `<h1>`) ; le test de clignotement ne surveillait en fait que la dernière page chargée (les relevés étaient effacés à chaque chargement). Tests ajoutés : `src/features/auth/viewer.test.ts`, cas d'attaque de `safeNextPath`.
- **Vérifié** : `e2e/visiteurs.spec.ts` (un parcours par type de visiteur, mobile et desktop, relevé à chaque image qu'aucun libellé de visiteur n'apparaît à un connecté) et `e2e/session.spec.ts` ; typecheck, lint, 1 043 tests unitaires, build. La suite Playwright entière n'a pas été relancée.
- **Choix à trancher, signalés par la relecture** : sans JavaScript, ce qui dépend du visiteur reste invisible (boutons du header, appels à adhérer) ; après suspension, le header peut afficher « Mon espace » jusqu'à 60 s lors des navigations côté client (l'accès, lui, est refusé tout de suite) ; pour un membre, des blocs du bas de page (Agenda, Contact, accueil) réservent leur place puis disparaissent, d'où un petit saut de mise en page, non mesuré ; `/login` peut montrer son formulaire un instant avant de rediriger un connecté.
- **Non vérifié** : bouton retour du navigateur après déconnexion ; lecteurs d'écran réels ; Lighthouse (les pages publiques ont maintenant plusieurs zones lues à la requête).

### Bogue « déconnecté en revenant sur l'accueil » (14/11/2026)

**Fait dans la session principale** : le sous-agent `architecte-expert` a été lancé comme demandé, mais s'est arrêté avant d'écrire quoi que ce soit (quota Fable épuisé jusqu'au 20/11) ; le bogue étant bloquant, il a été corrigé sans lui. **La correction n'a donc pas été relue par un sous-agent Fable** : à faire relire par `relecteur-expert` quand son quota revient.

- **Cause, prouvée par `e2e/session.spec.ts` avant correction** : la session n'était pas perdue (après un passage par l'accueil, `/member` s'ouvrait toujours). Le header public ne lisait jamais la session : il affichait « Adhérer » à tout le monde, et son lien « Espace membre » (comme celui du pied de page) menait à `/login`, qui réaffichait le formulaire même à un membre connecté. Le test échouait sur l'absence du lien « Mon espace ».
- **Correction** : partie « compte » du header lue à la requête derrière `<Suspense>` (`src/components/layout/header-account.tsx`), repli « visiteur », le reste du header restant statique ; connecté, le header montre « Mon espace » (membre) ou « Administration » (responsable) et « Se déconnecter », y compris dans le menu mobile ; `/login` renvoie un utilisateur connecté vers son espace (même règle de destination qu'après la connexion).
- **Espace membre** : header et pied de page du site (`src/app/member/layout.tsx`), bouton « Se déconnecter » en bas de la page ; `account-shell.tsx`, devenu inutile, est supprimé.
- **Inscription libre** : il n'en existe pas (`disableSignUp: true`, aucune page ni route d'inscription). Les deux comptes réels de la base : le super-administrateur (`pnpm create-admin`) et un membre né d'une demande d'adhésion validée.
- **Vérifié** : `e2e/session.spec.ts` (connexion → accueil → « Mon espace » → rechargement → fermeture et réouverture d'onglet → `/login` renvoie vers l'espace → déconnexion) en mobile et desktop, plus `auth`, `accueil`, `seo-pwa` et `recette` ; captures à 375 et 1440 px (`docs/captures/session/`) ; typecheck, lint, tests unitaires, build. Suite Playwright entière relancée ensuite sur le build de production : **72 parcours, 61 réussis, 11 ignorés volontairement, 0 échec**.
- **Non vérifié** : le cookie sur une adresse autre que `localhost` (adresse du réseau local avec `pnpm dev:lan`, ou un build de production servi en `http` hors `localhost`, où le cookie sécurisé n'est pas posé) ; le comportement dans le serveur de dev du port 3000 n'a pas été testé par Playwright (build de production seulement).
- À savoir : les pages publiques passent de « statiques » à « partiellement prérendues » (le header attend la session dans un trou dynamique) ; Lighthouse n'a pas été remesuré.

### Pendant la validation du MVP (14/11/2026)

- **Répartition des modèles** : section 11 de `CLAUDE.md` (session principale sur Opus 5.5, sous-agents `architecte-expert` et `relecteur-expert` sur Fable 5.2, dans `.claude/agents/`), `.claude/settings.json` et `docs/PROMPT-INTEGRATION-CONTENUS.md` suivis dans Git. Les deux sous-agents sont chargés (ils apparaissent dans les types d'agents disponibles de la session, `model: fable`) ; je ne peux pas lancer la commande `/agents` moi-même : à confirmer de votre côté.
- **Réserves des critères 8 et 9 levées** — **fait par le sous-agent `relecteur-expert`** (commit `b01f68d`) : relecture des 46 Server Actions et 3 Route Handlers (aucun contrôle d'accès manquant), 927 nouveaux tests unitaires (matrice rôles × actions, saisies mal formées, Route Handlers), huit validations trop lâches corrigées. Détail et choix restant à trancher : `docs/RECETTE.md` §8 et §9 et ci-dessous.
- **Fait dans la session principale** : requêtes forgées dans le navigateur (`e2e/requetes-forgees.spec.ts`), annulation depuis `/member` et refus après le délai (`e2e/recette.spec.ts`), correctif du formulaire muet sur une erreur de champ absent (`use-action-form.ts`), sauvegarde et restauration d'essai (`docs/SAUVEGARDE.md`), proposition d'hébergement (`docs/HEBERGEMENT.md`).
- **Contrôles** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (1 035 tests), `pnpm build`. Playwright, suite entière sur le build de production : 66 parcours, 55 réussis, 10 ignorés volontairement, 1 échec, dû au test (une saisie faite pendant le chargement de la fiche s'ajoutait au titre au lieu de le remplacer) ; corrigé et rejoué deux fois avec succès. La suite entière n'a pas été relancée après cette correction.
- **Choix signalés par la relecture, à trancher** (rien n'a été changé) : un responsable sans le rôle « membre » peut s'inscrire à une rencontre ; un administrateur peut réactiver un responsable qu'un super-administrateur a suspendu ; la demande d'adhésion et l'inscription invité révèlent qu'une adresse est connue ; cinq tentatives de connexion bloquent un compte 15 minutes pour tout le monde ; un identifiant inconnu dans la bibliothèque renvoie une erreur générique ; retirer une inscription n'annule pas une participation déjà encaissée ; le téléversement lit le corps entier quand la taille n'est pas annoncée ; les propriétés en trop sont ignorées plutôt que refusées.
- **Mise en ligne** : `docs/HEBERGEMENT.md` propose trois options ; **rien n'est déployé, en attente de votre choix.**

### SEO, PWA et recette (13/11/2026)

- **SEO** : `sitemap.xml` (pages fixes + livres, rencontres et articles publiés, lus en base), `robots.txt` (espaces privés, pages de compte et liens personnels fermés), image de partage `opengraph-image` (logo vertical fourni sur indigo), `metadataBase`, Open Graph et carte Twitter par défaut, adresse canonique et données structurées sur l'accueil. Les adresses absolues viennent de `APP_URL`, lue **au moment du build**.
- **PWA** : `public/sw.js` (page hors ligne + fichiers statiques en cache ; **aucune page ni donnée**), enregistré en production seulement ; page `/offline` ; manifest complété (`id`, `scope`, orientation).
- **Bogue trouvé et corrigé en exécutant** : avec le service worker, une page publique modifiée depuis l'administration restait affichée dans son ancienne version au chargement suivant (le navigateur resservait une réponse `stale-while-revalidate`). Les navigations passent maintenant par le réseau sans cache HTTP. Deux parcours existants l'avaient révélé.
- **Recette** : `docs/RECETTE.md`. Dix critères sur douze vérifiés par exécution ; le n° 11 (sauvegardes) n'est pas satisfait, prévu en phase 6 ; le n° 12 attend les fondateurs. Nouveaux parcours `e2e/recette.spec.ts` et `e2e/seo-pwa.spec.ts`.
- **Contrôles** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (108 tests), `pnpm build`. Playwright sur le build de production, suite entière d’un seul tenant après les derniers ajouts : **48 parcours, 40 réussis, 8 ignorés volontairement (administration sur mobile, menu plein écran sur desktop), 0 échec**.
- `DECISIONS.md` (§9) et `REGLES-METIER.md` (« Précisions de la phase 3 ») sont à jour.
- **Non fait** : essai sur un vrai téléphone ; installation de l'application ; archivage d'un membre jamais exécuté.

### Visite de toutes les pages dans le navigateur (13/11/2026)

`node scripts/visite.mjs` (nouveau) ouvre chaque page dans Edge, serveur de dev sur le port 3000 : 27 adresses publiques à 375 puis 1440 px, puis `/member` et les 19 pages d'administration à 1440 puis 375 px avec un compte super-administrateur de test créé, activé par le lien reçu dans Mailpit, puis supprimé. Pour chaque page : statut HTTP, titre, erreurs de console, réponses 4xx/5xx, débordement horizontal, squelettes restés affichés, capture pleine page (`docs/captures/visite/`, ignoré par Git). `ONLY="^admin$"` limite la visite à certaines pages.

**Résultat : 94 visites, toutes les pages s'affichent.** Aucun débordement horizontal, aucune erreur d'exécution, aucun squelette resté affiché, aucune réponse 5xx. `/member` et `/admin` sans session renvoient bien à la connexion. Les adresses inconnues affichent la page « introuvable » (`/events/…` et les adresses hors rubrique répondent 404 ; `/library/…` répond toujours 200).

Dix-sept captures ont été regardées une à une (catalogue, fiche livre, agenda, article, `/member`, tableau de bord, membres, livres, fiche d'événement, éditeur d'article, demandes d'adhésion sur mobile) ; les autres n'ont été contrôlées que par les mesures ci-dessus.

**Trois défauts vus et corrigés, puis revérifiés à l'écran** :

1. Administration : à 900 px de haut, la rubrique « Réglages » du menu latéral était coupée (il fallait faire défiler le menu sans que rien ne l'indique). Menu resserré sur desktop ; les cibles de 44 px sont gardées dans le menu mobile.
2. Tableau de bord : les tuiles de chiffres n'avaient pas la même hauteur.
3. Fiche d'un livre : « Le mot du club » répétait mot pour mot le résumé quand les deux textes sont identiques (cas des livres de démonstration).

**À savoir** :

- Un avertissement de Next (« uncached data during prerendering ») est apparu une fois sur `/events`, à la première compilation du serveur de dev ; il ne s'est pas reproduit aux deux visites suivantes et le build prérend cette page en statique. Non expliqué davantage.
- La visite ne remplit aucun formulaire et ne clique sur rien : les actions restent couvertes par les parcours Playwright (`e2e/`), qui n'ont **pas** été relancés dans cette session.
- Elle a tourné sur le serveur de dev, pas sur un build de production.

### Démarrer une session de travail

```
docker compose up -d      # PostgreSQL (port 5433) + Mailpit (http://localhost:8025)
pnpm db:migrate           # applique les migrations
pnpm db:seed              # rôles, permissions, barème, badges, catégories + démonstration
pnpm create-admin         # crée le super-administrateur (interactif)
pnpm dev
```

`.env` se crée à partir de `.env.example` (il faut y générer `BETTER_AUTH_SECRET`).

### État de la phase 3 au 12/11/2026 (historique)

> Historique : ce bilan date d'avant les vérifications des 13 et 14/11. Tout ce qu'il liste comme « non vérifié » l'a été depuis (sections datées plus haut).

**Ce qui est écrit et commité** (deux commits sur `main`, rien n'est poussé) :

- **3.1 Site public branché sur la base** : accueil (livre du mois, étagère, agenda, actualités lus en base ; `demo-content.ts` supprimé, les données de démonstration sont dans `prisma/demo-data.ts`), `/about`, `/activities`, `/library` (recherche, filtres catégorie et auteur) et `/library/[slug]`, `/events`, `/events/[slug]` (inscription membre ou invité) et `/events/registration` (lien reçu par e-mail : confirmer ou annuler), `/news` et `/news/[slug]`, `/membership`, `/contact`, `/privacy`. La page « En construction » est supprimée, `src/config/navigation.ts` pointe vers les vraies pages.
- **3.2 Flux d'adhésion** : service complet (demande → validation ou refus → compte + numéro `AE-AAAA-NNNN` + période d'adhésion → e-mail d'activation ; `AuditLog`). Page `/member` réelle (adhésion, inscriptions à venir avec annulation, déconnexion dans l'en-tête).
- **3.3 Administration** : cadre SaaS (sidebar, fil d'Ariane, recherche globale Ctrl K, raccourcis clavier, menu mobile), tableau générique triable avec filtres, sélection et actions groupées, panneau latéral, listes de cartes sous 768 px. Pages : tableau de bord (chiffres comptés en base), demandes d'adhésion, membres, livres (téléversement de couverture vérifié), catégories et auteurs, livre du mois, événements (+ inscrits, export CSV), articles (éditeur Markdown avec aperçu), paramètres du club, équipe et rôles, journal.

**Ce qui a été vérifié par exécution** :

- `pnpm typecheck`, `pnpm lint`, `pnpm test` (91 tests, dont 28 nouveaux dans `src/features/phase3.test.ts`) et `pnpm build` passent.
- Site public : après le premier commit, un build de production a été servi et chaque page publique a répondu 200 (requêtes `curl`), y compris la recherche du catalogue et une fiche d'événement.

**Ce qui n'avait PAS été vérifié le 12/11 (liste d'origine ; depuis, voir les trois sections datées du 13/11 plus haut : pages ouvertes, formulaires soumis, parcours Playwright et Lighthouse faits)** :

- **Aucune page de la phase 3 n'a été ouverte dans un navigateur.** Ni le site public, ni `/member`, ni l'administration. Le code compile et se construit, c'est tout ce qui est établi.
- **L'administration n'a jamais été exécutée**, même par `curl` : aucune de ses pages, aucune de ses actions (valider une adhésion, créer un événement, téléverser une couverture, exporter un CSV, changer un rôle) n'a tourné une seule fois. Des erreurs à l'exécution sont probables.
- **Aucun formulaire public n'a été soumis** : demande d'adhésion, inscription invité, contact. Aucun des nouveaux e-mails n'a été envoyé ni lu dans Mailpit.
- **Aucune capture §7.5**, donc aucune critique visuelle : le design des nouvelles pages n'est pas validé, ni à 375 px ni à 1440 px.
- **`pnpm test:e2e` n'a pas été relancé.** `e2e/accueil.spec.ts` a été adapté (liens vers `/membership` et `/library`) sans être exécuté. Aucun parcours Playwright n'existe pour les modules de la phase 3.
- Pas de Lighthouse.

**Ce qui reste à faire en phase 3** :

1. ~~Ouvrir chaque page publique et chaque page d'administration dans le navigateur, corriger ce qui casse.~~ Fait le 13/11 (`node scripts/visite.mjs`).
2. Contrôle qualité §7.5 : captures 375 / 768 / 1440 px du site public et de `/member`, 1440 / 1280 / 375 px de l'administration ; critique ; reprises.
3. Parcours Playwright : adhésion complète (demande → validation → activation, e-mails lus dans Mailpit), inscription membre et invité (capacité, annulation), administration (livre, événement, article, export CSV), liens morts.
4. **3.4 SEO** : les metadata par page et l'Open Graph de base existent ; restent `sitemap.xml`, `robots.txt` et l'image Open Graph.
5. **3.5 PWA** : le manifest et les icônes existent depuis la phase 1 ; restent le service worker minimal et la page hors ligne.
6. Recette : les 12 critères de la section 13 du cahier des charges, un par un.
7. `docs/DECISIONS.md` et `docs/REGLES-METIER.md` ne sont pas à jour des choix de la phase 3 (voir ci-dessous).

**Choix faits en phase 3, à reporter dans `DECISIONS.md` / `REGLES-METIER.md`** :

- Lectures publiques en cache (`"use cache"`, étiquettes `books`, `events`, `articles`, `settings` dans `src/lib/cache-tags.ts`) ; chaque action d'administration appelle `updateTag`. Un changement fait hors de Next.js (seed) apparaît en quelques minutes.
- Pages `[slug]` : le paramètre est lu sous `<Suspense>`. Conséquence constatée : **une adresse inconnue (`/library/inconnu`) affiche bien la page « introuvable », mais répond HTTP 200 et non 404.**
- Inscription invité : en attente jusqu'au clic sur le lien reçu par e-mail ; la place est retenue 24 h. Capacité vérifiée dans une transaction qui verrouille la ligne de l'événement (`SELECT … FOR UPDATE`).
- Adhésion : une demande pour une adresse qui a déjà un compte ou une demande en attente est refusée avec un message explicite (ce qui révèle qu'une adresse est connue ; atténué par la limite de 5 envois par heure et par IP).
- Nouvelle limite de débit `public.token.ip` (30 par heure) pour confirmer ou annuler par lien, distincte de `public.form.ip` (5 par heure).
- Formulaire de contact : le message part par e-mail à l'adresse du club (`Setting`), sinon à `CONTACT_EMAIL` (nouvelle variable) ; rien n'est stocké. Sans adresse, le formulaire ne s'affiche pas.
- Couvertures : stockage disque local (`UPLOAD_DIR`, nouvelle variable), JPEG / PNG / WebP reconnus à leur signature, 2 Mo au plus, nom régénéré, servies par `/uploads/[...path]`.
- Articles : corps en Markdown, rendu par un petit moteur maison (`src/lib/markdown.tsx`), sans dépendance ajoutée.
- Tableaux d'administration triés et filtrés dans le navigateur (listes plafonnées à 1 000–3 000 lignes) : suffisant pour un club, à revoir si les volumes grossissent.
- Archivage d'un membre : anonymisation (nom, e-mail, téléphone effacés), irréversible.
- `createPendingUser` accepte désormais une transaction en troisième argument.
- Sections fondateurs, équipe et partenaires de `/about` : absentes tant que le club n'a pas fourni les contenus.

### Résultats de la phase 2 (12/11/2026)

- Contrôles : `pnpm typecheck`, `pnpm lint`, `pnpm test` (63 tests) et `pnpm test:e2e` (13 réussis, 1 ignoré volontairement : le menu plein écran n’existe pas sur desktop) passent. `pnpm build` passe.
- Parcours activation → connexion → déconnexion → mot de passe oublié : vérifié à la main dans le navigateur (375 px) et par Playwright (mobile et desktop), avec de vrais e-mails lus dans Mailpit.
- Vérifiés par exécution : seed lancé deux fois (mêmes comptes), `pnpm db:clear-demo` (puis « rien à supprimer » au second passage), `pnpm create-admin` (création, doublon refusé, mot de passe court refusé).
- Captures : `docs/captures/phase-2/` (connexion, mot de passe oublié, activation, lien expiré, réinitialisation, accès refusé, espace membre à 375 / 768 / 1440 px ; administration à 1440 / 1280 / 375 px). Une itération de corrections : tuile A1 posée sur la scène, gradins plus hauts sur tablette, en-tête des espaces connectés sur mobile, lien d'adhésion sur une ligne, libellé « Compte supprimé » dans le journal.
- Documentation : `docs/DECISIONS.md` (choix et schéma) et `docs/REGLES-METIER.md` (règles par défaut).

### Écarts et limites de la phase 2, à connaître

- **`pnpm test:e2e` tourne sur un build de production** (port 3210), plus sur le serveur de dev : sur ce poste (7,8 Go de RAM), le serveur de dev met jusqu'à 60 s à répondre sous Playwright et un parcours sur quatre échouait par dépassement de délai. `PW_DEV=1` pour tester le serveur de dev. Un seul worker par défaut.
- **`pnpm create-admin` n'a été testé qu'avec une entrée redirigée**, pas au clavier dans un vrai terminal : le masquage de la saisie du mot de passe reste à constater à la première utilisation.
- **L'envoi par Resend n'a pas été exécuté** (pas de clé) ; seul l'envoi SMTP vers Mailpit l'a été.
- **`/member` et `/admin` sont des pages minimales** (compte, accès, journal d'audit) pour que la connexion mène quelque part de réel. Pas de barre d'onglets ni de sidebar : phases 3 et 4.
- **Le bandeau « Données de démonstration » reste affiché même base vide** tant que l'accueil lit `demo-content.ts` (drapeau `usesHardcodedDemoContent`, à retirer en phase 3). Après `db:clear-demo`, il met quelques minutes à disparaître (cache).
- **Limitation de débit par IP** : repose sur `X-Forwarded-For`, falsifiable sans proxy inverse correctement configuré. À régler au déploiement (phase 6) ; la limite par compte, elle, ne dépend pas de l'IP.
- **Aucun endpoint `/api/auth/*`** : Better Auth n'est appelé que depuis les Server Actions.
- **Pas de Lighthouse en phase 2** (non demandé) : à refaire en phase 3 sur les pages de compte.
- **shadcn : toujours pas de `shadcn init`** ; les formulaires utilisent React Hook Form + Zod avec les champs faits main de la phase 1.
- Le logo vertical n'est pas utilisé sur la page de connexion : le logo horizontal est dans l'en-tête et le panneau indigo porte le motif des gradins.

### Résultats de la phase 1 (11/11/2026)

- Contrôles : `pnpm typecheck`, `pnpm lint`, `pnpm test` (7 tests) et `pnpm test:e2e` (5 réussis, 1 ignoré volontairement : le menu plein écran n'existe pas sur desktop) passent. `pnpm build` passe.
- Lighthouse mobile (build de production, émulation Moto G, 4G lente, CPU ×4), trois passes : Performance **86 / 98 / 98**, Accessibilité **100**, Bonnes pratiques 100, SEO 100. LCP 1,1 à 1,5 s, CLS 0, page de 299 Ko. La première passe (86) a été faite juste après le démarrage du serveur.
- Captures : `docs/captures/phase-1/` (accueil, design system, page « En construction », menu, bottom sheet ; 375, 768 et 1440 px). Les régénérer : `pnpm captures`.
- Deux itérations de contrôle qualité : (1) hero desktop refait (l'hémicycle chevauchait le texte), bouton en double dans l'agenda, typographie française (insécables), logo du footer ; (2) tuile A1 dégagée du titre de la couverture, cartel du livre du mois, alignement des logos.

### Écarts par rapport au plan, à connaître

- **Apparitions au défilement en CSS, pas avec Motion.** La version Motion donnait Performance 83 et 690 ms de blocage ; la version CSS (`animation-timeline: view()`) n'embarque aucun JavaScript. Motion reste installé pour les interactions à état des phases suivantes.
- **shadcn/ui : pas de `shadcn init`.** Les composants de la phase 1 (bouton, champs, étiquettes) sont écrits à la main selon les conventions shadcn (`cva`, `cn`, `components/ui`). Le menu plein écran et la bottom sheet reposent sur `<dialog>` natif. Le CLI sera lancé en phase 2/3 quand des primitives Radix seront nécessaires (formulaires riches, tableaux d'admin) ; il faudra alors protéger `globals.css`, qu'il réécrit.
- **ESLint 9 et non 10**, React 19.3.1, Tailwind 4.3.3 avec `@tailwindcss/turbopack` : ce sont les versions posées par `create-next-app@16.4.6`. TypeScript épinglé en 6.0.3 comme prévu.
- **`cacheComponents` et `partialPrefetching` activés** (configuration par défaut du gabarit Next 16.4) : pas de `new Date()` ni de `Math.random()` dans un composant serveur prérendu.
- **Tests e2e et captures via Edge** (`channel: "msedge"`), pour ne pas télécharger Chromium ; `PW_CHANNEL=chromium` pour un autre environnement.
- Le dossier `logos/` d'origine est conservé à la racine ; l'application utilise la copie dans `public/logos/`.

---

## Phase 0 — Audit et plan ✅

### Dossier (11/11/2026)

- Présents : `CLAUDE.md`, `docs/PROMPTS.md`, `docs/cahier-des-charges.pdf`, `logos/` (16 fichiers : SVG, PNG PWA, licences OFL).
- Aucun code applicatif, pas de `package.json`, pas de `.gitignore`.
- Git : dépôt initialisé, branche `master`, **aucun commit**, tout est non suivi.
- Les logos sont dans `logos/` à la racine (et non `public/logos/`) : la copie est prévue en phase 1. Un fichier `icone-maskable.svg` est présent en plus de la liste du CLAUDE.md.

### Outils installés

| Outil            | Version         | Verdict                                                                                              |
| ---------------- | --------------- | ---------------------------------------------------------------------------------------------------- |
| Node             | 22.19.0         | OK. LTS en maintenance (LTS actives : 24 et 26), satisfait toutes les contraintes `engines` relevées |
| pnpm             | 11.25.0         | OK (dernière : 12.18.0, pas nécessaire)                                                              |
| Docker / Compose | 29.9.3 / v5.7.0 | OK, démon actif                                                                                      |
| Git              | 2.51.0          | OK                                                                                                   |

Point d'attention : un **PostgreSQL local (service Windows) écoute déjà sur le port 5432**. Le Postgres du `docker-compose.yml` sera exposé sur **5433** pour éviter le conflit. Les ports 3000, 1025 et 8025 sont libres.

### Versions retenues (npm view, 11/11/2026)

| Paquet                                | Version à installer   | Remarque                       |
| ------------------------------------- | --------------------- | ------------------------------ |
| next                                  | 16.4.6                | `latest`. Node ≥ 20.9          |
| react / react-dom                     | 19.3.1                |                                |
| prisma + @prisma/client               | **7.10.1 (épinglée)** | voir incompatibilité n° 1      |
| @prisma/adapter-pg                    | 7.10.1                |                                |
| better-auth                           | 1.7.20                | pairs : next 14–16, prisma 5–7 |
| tailwindcss + @tailwindcss/postcss    | 4.3.5                 |                                |
| shadcn (CLI)                          | 4.23.0                |                                |
| typescript                            | **6.0.3 (épinglée)**  | voir incompatibilité n° 2      |
| eslint / eslint-config-next           | 10.14.0 / 16.4.6      |                                |
| zod                                   | 4.6.7                 |                                |
| react-hook-form / @hookform/resolvers | 7.92.0 / 7.0.5        |                                |
| motion                                | 14.12.0               |                                |
| lucide-react                          | 1.72.0                |                                |
| vitest / @playwright/test             | 5.1.0 / 1.65.0        |                                |

### Incompatibilités relevées

1. **Prisma : le tag `latest` du paquet `prisma` (CLI) pointe sur une préversion, `8.0.0-rc.33`**, alors que `@prisma/client` est en `7.10.1`. Un `pnpm add prisma` sans version installerait une RC désalignée du client, et Better Auth n'accepte que Prisma `^5 || ^6 || ^7`. → Épingler `prisma@7.10.1` et `@prisma/client@7.10.1`. Passer à Prisma 8 seulement quand elle sera stable et acceptée par Better Auth (montée majeure : à demander).
2. **TypeScript 7.0.2 (`latest`) est refusé par `typescript-eslint` 8.72.2** (pair `>=4.8.4 <6.1.0`), utilisé par `eslint-config-next`. → Épingler `typescript@6.0.3`. Vérifier en phase 1 que `create-next-app` n'installe pas TS 7.
3. Sans conflit constaté (plages de dépendances vérifiées) : Next 16 + React 19.3 ; Better Auth + Next 16 ; Better Auth (zod `^4.5.4`) + Zod 4.6 ; resolvers 7 + Zod 4 + RHF 7.92 ; ESLint 10 + eslint-config-next + typescript-eslint ; Vitest 5 + Node 22.19 ; Motion 14 + React 19.

Non vérifié par exécution (à confirmer à l'installation, phases 1 et 2) : le comportement réel de `shadcn init` avec Tailwind 4.3 / React 19.3, et celui de l'adaptateur Prisma de Better Auth avec le client Prisma 7 (générateur `prisma-client`, sortie dans `src/`, adaptateur `pg` obligatoire).

### Ambiguïtés du cahier des charges et valeurs par défaut proposées

Les lignes marquées **À trancher** demandent une réponse avant la phase concernée ; les autres s'appliquent par défaut et seront consignées dans `docs/DECISIONS.md` / `docs/REGLES-METIER.md`.

| #   | Point                                           | Constat                                                                                                                       | Valeur par défaut proposée                                                                                                                                                                                                    |
| --- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Nom du club                                     | CdC : « à définir » (pistes : « L'Agora des Lettres »…). CLAUDE.md : « L’Agora de l’Excellence »                              | CLAUDE.md fait foi ; nom centralisé dans `config/site.ts` + `Setting`                                                                                                                                                         |
| 2   | Inscription d'un visiteur aux événements        | Critère de recette : « visiteur ou membre peut s'inscrire » ; modèle de données : `EventRegistration` = « événement, membre » | Inscription invité (nom + e-mail, confirmation par lien) seulement si l'événement est « ouvert au public »                                                                                                                    |
| 3   | Espace membre en V1 ou V2                       | Le §3.2 le décrit dans le périmètre, la feuille de route le place en V2, mais l'adhésion V1 crée un compte                    | V1 : après activation, le membre arrive sur une page `/member` minimale et réelle (statut d'adhésion, ses inscriptions, déconnexion). Le reste en phase 4                                                                     |
| 4   | Identifiant de connexion                        | `User` : « email **ou** téléphone »                                                                                           | E-mail obligatoire et unique (identifiant) ; téléphone +221 facultatif, non utilisé pour se connecter. Pas de SMS en V1                                                                                                       |
| 5   | Backend                                         | CdC : « API Route Handlers » ; CLAUDE.md : Server Actions                                                                     | Server Actions ; Route Handlers pour CSV, scan QR, IA, webhooks                                                                                                                                                               |
| 6   | Cotisation / paiement                           | « éventuelle cotisation », « paiements éventuels », rien de décidé                                                            | **À trancher.** Défaut : aucun paiement en ligne. Adhésion gratuite, durée 12 mois, renouvellement validé par un responsable ; un champ « cotisation réglée » (oui/non, date) saisi à la main par l'admin                     |
| 7   | Champs du formulaire d'adhésion                 | « parcours court », « collecte minimale », public incluant des élèves                                                         | **À trancher.** Défaut : prénom, nom, e-mail, téléphone, tranche d'âge, statut (élève / étudiant / actif / autre), centres d'intérêt (lecture, Scrabble, débats), motivation facultative, consentement obligatoire            |
| 8   | Mineurs                                         | Élèves dans la cible, rien sur l'accord parental                                                                              | **À trancher.** Défaut : si moins de 18 ans, nom et téléphone d'un parent ou tuteur obligatoires ; pas de photo de profil publique                                                                                            |
| 9   | Avis publics sur le catalogue                   | « avis publics **si autorisés** »                                                                                             | Critique visible publiquement seulement si validée par un modérateur **et** si le membre a coché « publier sous mon prénom ». Réglage global d'activation dans `Setting`                                                      |
| 10  | Classement de participation                     | « **si retenu** » ; et « ne pas classer la valeur personnelle des membres »                                                   | Classements de points mensuel et général visibles des seuls membres, limités au top 10 + sa propre position, avec option de retrait par membre. Désactivable dans `Setting`                                                   |
| 11  | Niveaux                                         | Titre « points, niveaux et badges », aucun niveau défini                                                                      | Cinq paliers nommés, seuils en base (0, 100, 300, 700, 1500 XP), modifiables par l'admin. Noms à proposer en phase 4                                                                                                          |
| 12  | Points par présence                             | Barème par type d'activité (lecture 20, débat 15, tournoi 20)                                                                 | `Event.type` (lecture, scrabble, débat, quiz, atelier, conférence, autre) relié à une `PointRule` ; un type sans règle ne rapporte rien                                                                                       |
| 13  | « Gagner un tournoi »                           | Individuel ou équipe non précisé                                                                                              | 50 XP au 1er individuel, ou à chaque membre de l'équipe gagnante ; égalité au 1er rang : 50 XP chacun                                                                                                                         |
| 14  | Badge « Ambassadeur du savoir »                 | « contribution remarquable » : aucun critère mesurable                                                                        | Badge manuel, attribué par un administrateur avec motif, tracé dans `AuditLog`                                                                                                                                                |
| 15  | Tournoi ↔ événement                             | `Tournament` : « événement lié »                                                                                              | Lien facultatif. S'il existe, l'inscription au tournoi vaut inscription à l'événement                                                                                                                                         |
| 16  | Compétitions interclubs                         | Participants extérieurs sans compte                                                                                           | `TournamentParticipant` accepte un participant externe (nom + club), sans points ni compte                                                                                                                                    |
| 17  | Format des manches                              | « manches », « règlement adopté », rien de précis                                                                             | Duplicate : un score par joueur et par manche, classement au cumul. Classique : matchs à deux, appariements saisis par le responsable (pas d'appariement automatique en V1). Forfait : défaite, score 0                       |
| 18  | Livre du mois                                   | « sélection mensuelle suivie d'une rencontre »                                                                                | Entité `MonthlySelection` (mois, livre, événement lié facultatif), une par mois, gérée par le responsable bibliothèque. Affichée dès la V1 sur l'accueil                                                                      |
| 19  | « Recommandations » du catalogue                | Terme non défini                                                                                                              | Drapeau « Coup de cœur du club » + court mot du club sur la fiche                                                                                                                                                             |
| 20  | « Programmer » une publication                  | Verbe cité dans l'admin                                                                                                       | Champ `publishedAt` : un article publié à une date future n'apparaît qu'à cette date (filtre à la lecture, sans tâche planifiée)                                                                                              |
| 21  | Stockage des médias                             | « local au début ou Cloudinary »                                                                                              | Interface `StorageService` avec implémentation disque local (`/uploads`, hors dépôt). **Attention : ne tient pas sur un hébergement sans disque persistant (Vercel)** — dépend du point 22                                    |
| 22  | Hébergement / déploiement                       | Non décidé (budget à définir)                                                                                                 | **À trancher avant la phase 6.** Défaut : VPS unique avec Docker (app + Postgres + volume d'uploads), sauvegarde `pg_dump` quotidienne                                                                                        |
| 23  | Contenus réels                                  | Fondateurs, équipe, partenaires, lieu, coordonnées, réseaux sociaux inconnus                                                  | **À fournir.** Tant qu'ils manquent : les sections concernées ne s'affichent pas (pas de faux fondateurs ni de fausses adresses) ; coordonnées lues dans `Setting`                                                            |
| 24  | Rôles « Responsable » et « Administrateur »     | Frontière floue (« selon les permissions attribuées »)                                                                        | Rôles semés : membre, resp. communication, resp. bibliothèque, resp. Scrabble, administrateur, super-administrateur. Permissions fines `domaine.action`, rôles cumulables. Adhésions, membres et événements : administrateur  |
| 25  | Notifications                                   | Champ « canal » non précisé ; WhatsApp cité comme canal du club                                                               | In-app + e-mail uniquement. Pas d'intégration WhatsApp ni de push en V1–V3                                                                                                                                                    |
| 26  | Quiz interactifs, statistiques avancées (V3)    | Listés en V3, absents de `PROMPTS.md` hors quiz de l'assistant                                                                | Hors périmètre des phases 1 à 6, sauf le quiz généré par l'assistant. À cadrer plus tard                                                                                                                                      |
| 27  | Rendez-vous éditoriaux (« mot de la semaine »…) | Décrits comme contenus pour réseaux sociaux                                                                                   | Simples catégories d'articles (`Article.category`), pas de module dédié                                                                                                                                                       |
| 28  | Données personnelles                            | Durées de conservation non décidées                                                                                           | Demande d'adhésion refusée : supprimée après 12 mois. Membre archivé : anonymisé sur demande. Page `/privacy` rédigée sur cette base, à relire par les fondateurs (loi sénégalaise n° 2008-12, déclaration CDP à leur charge) |
| 29  | Langues                                         | Français ; wolof/anglais « à étudier »                                                                                        | Français seul, sans bibliothèque i18n. Textes d'interface regroupés par feature pour faciliter une traduction future                                                                                                          |
| 30  | « API documentée »                              | « si une application mobile est ajoutée plus tard »                                                                           | Rien en V1. La logique dans `features/*/service.ts` permettra d'exposer une API ensuite                                                                                                                                       |
| 31  | Branche Git                                     | Dépôt sur `master`, branche principale attendue `main`                                                                        | **À trancher.** Défaut : renommer `master` → `main` avant le premier commit                                                                                                                                                   |

---

## Phase 1 — Design system + page d'accueil

Objectif : faire valider la direction artistique. **Point de validation à la fin.**

### 1.1 Initialisation

- [x] Renommer la branche en `main` (si validé), créer `.gitignore`, premier commit des documents et logos
- [x] Initialiser Next.js 16.4 (App Router, `src/`, TypeScript `strict`) avec pnpm ; épingler `typescript@6.0.3`
- [x] Tailwind 4 + `shadcn init` ; ESLint + Prettier (avec tri des classes Tailwind) ; scripts `typecheck`, `lint`, `format`
- [x] Arborescence du CLAUDE.md §3 (`features/`, `components/ui|layout|shared`, `lib/`, `config/`)
- [x] `src/config/site.ts` (nom du club, forme courte, description) et `src/config/navigation.ts`
- [x] Copier `logos/` vers `public/logos/` ; favicon, `apple-touch-icon`, icônes PWA branchés dans les metadata
- [x] Young Serif + Work Sans via `next/font/google` (graisses strictement nécessaires)
- [x] Vitest + Playwright installés, un test de fumée chacun
- [x] Commit

### 1.2 Direction artistique

- [x] Skill de design frontend : aucun disponible dans la session, étape sans objet
- [x] Rédiger `docs/DIRECTION-ARTISTIQUE.md` : concept, palette finale, échelle typographique, principes de composition, style d'animation, signes distinctifs, réponse point par point aux pièges du §7.3
- [x] Définir les couleurs fonctionnelles (succès, alerte, erreur) dans la famille chaude et sourde ; **vérifier le contraste AA de chaque paire utilisée** et consigner les ratios

### 1.3 Tokens et composants

- [x] Tokens CSS + thème Tailwind : couleurs, typographie, espacements, rayons, ombres, durées et courbes d'animation
- [x] Habillage des composants shadcn de base : bouton, champ, select, case, textarea, étiquette, badge
- [x] Composant `LetterTile` (tuile de lettre avec valeur) et motif « gradins en arc »
- [x] Composant `GeneratedCover` : plusieurs gabarits typographiques, variation déterministe selon titre/auteur/catégorie
- [x] Cartes livre et événement
- [x] Navigation mobile : header compact (symbole + « L’Agora »), menu plein écran, barre d'onglets du bas
- [x] Bottom sheet ; états vide, chargement (skeleton), erreur
- [x] Primitives d'animation Motion (apparition au défilement, pression) respectant `prefers-reduced-motion`
- [x] Page `/design-system` (dev uniquement, 404 en production)
- [x] Commit

### 1.4 Page d'accueil (contenu de démo en dur, conçue à 375 px d'abord)

- [x] Header public (mobile, puis desktop avec logo horizontal) et footer indigo
- [x] Hero éditorial vertical (pas de bannière centrée)
- [x] Trois piliers ; sélection de livres en carrousel tactile (avec alternative aux gestes)
- [x] Section Scrabble ; prochains événements ; communauté ; actualités ; appel à l'adhésion
- [x] Vrais textes rédigés pour le club ; aucune section témoignages
- [x] Compositions desktop dédiées (768 et 1440 px), pas un mobile étiré
- [x] Page unique « En construction » pour les liens non construits (supprimée en phase 3)
- [x] Commit

### 1.5 Contrôle qualité

- [x] Script Playwright de captures 375 / 768 / 1440 px
- [x] Itération 1 : captures, critique face aux références du §7.1, refonte de ce qui fait template
- [x] Itération 2 : recapture, critique, corrections
- [x] Lighthouse mobile (Android milieu de gamme, 4G lente) : Performance ≥ 90, Accessibilité ≥ 95, LCP < 2,5 s, CLS < 0,1
- [x] `pnpm typecheck && pnpm lint && pnpm test` ; mise à jour de ce fichier ; commit
- [x] **STOP — validation** (design approuvé le 12/11/2026) : captures finales (mobile d'abord), `DIRECTION-ARTISTIQUE.md`, scores Lighthouse

---

## Phase 2 — Fondations techniques ✅

### 2.1 Infrastructure

- [x] `docker-compose.yml` : PostgreSQL (port hôte 5433) + Mailpit (1025 / 8025)
- [x] `.env.example` complet ; validation des variables d'environnement par Zod au démarrage
- [x] `lib/prisma` (Prisma 7.10.1 épinglée, adaptateur `pg`)

### 2.2 Schéma Prisma

- [x] Auth et RBAC : `User`, `Session`, `Account`, `Verification` (Better Auth), `Role`, `Permission`, `RolePermission`, `UserRole`
- [x] Adhésion : `MembershipRequest`, `Membership`
- [x] Bibliothèque : `Book`, `Category`, `Author`, `Reading`, `Review`, `MonthlySelection`
- [x] Événements : `Event`, `EventRegistration` (membre OU invité)
- [x] Scrabble : `Tournament`, `TournamentParticipant`, `Team`, `Round`, `Match`, `Score`
- [x] Gamification : `PointRule`, `PointTransaction` (unicité règle + source), `Badge`, `UserBadge`
- [x] Transverse : `Article`, `Notification`, `Setting`, `AuditLog`, `RateLimit`
- [x] Enums de statut, index, unicités, `createdAt`/`updatedAt`, `isDemo`, `archivedAt`
- [x] Migration initiale versionnée
- [x] `docs/DECISIONS.md` (schéma et choix) et `docs/REGLES-METIER.md` (règles par défaut)

### 2.3 Données et scripts

- [x] Seed idempotent (`upsert`) : rôles, permissions, barème de points, badges, catégories ; livres, événements et articles de démo marqués `isDemo`
- [x] `pnpm create-admin` (interactif, jamais dans le seed)
- [x] `pnpm db:clear-demo`
- [x] Bandeau « Données de démonstration » tant qu'il en existe

### 2.4 Authentification

- [x] Better Auth (adaptateur Prisma, e-mail + mot de passe, sessions en base) ; inscription publique désactivée
- [x] `MailService` (Mailpit en dev, SMTP/Resend en prod) + gabarits d'e-mails à l'identité du club
- [x] Activation de compte par lien (définition du mot de passe), connexion, déconnexion, mot de passe oublié
- [x] Pages `(auth)` aux couleurs du club, mobile d'abord, passées au contrôle qualité §7.5

### 2.5 Permissions et sécurité

- [x] `lib/permissions` : `requireUser`, `requirePermission`, `can()`
- [x] Protection de `/member` et `/admin` (proxy/middleware + vérification serveur dans chaque layout)
- [x] Tests unitaires des permissions pour chaque rôle
- [x] Rate limiting en base (connexion, mot de passe oublié, formulaires publics)
- [x] `lib/audit` (`AuditLog`) ; gestion centralisée des erreurs (pages d'erreur, résultat typé des actions, logs sans données personnelles)
- [x] Test Playwright : activation → connexion → déconnexion → mot de passe oublié
- [x] typecheck + lint + tests ; mise à jour de ce fichier ; commit

---

## Phase 3 — MVP V1 ✅

**Point de validation à la fin.** Chaque page : direction artistique validée + contrôle qualité §7.5. Chaque module : tests unitaires du service + un test Playwright du parcours principal.

> Légende : `[x]` fait et vérifié par exécution (navigateur et Playwright) · `[ ]` pas fait. Phase terminée le 14/11/2026 ; réserves en tête de ce fichier.

### 3.1 Site public (branché sur la base)

- [x] Accueil relié aux données (livres, livre du mois, événements, actualités)
- [x] `/about` (sections fondateurs/équipe/partenaires masquées tant que vides)
- [x] `/activities`
- [x] `/library` (recherche, filtres catégorie/auteur, états vide/chargement/erreur) et `/library/[slug]`
- [x] `/events` et `/events/[slug]` : inscription membre ou invité, capacité en transaction, confirmation par e-mail, annulation jusqu'à 24 h avant
- [x] `/news` et `/news/[slug]` (confort de lecture, 60–75 caractères par ligne)
- [x] `/membership` : formulaire + accusé de réception par e-mail
- [x] `/contact` (formulaire limité en débit) et `/privacy`
- [x] Suppression de la page « En construction » ; aucun lien mort (`e2e/accueil.spec.ts`, et chaque adresse du plan du site répond 200 dans `e2e/seo-pwa.spec.ts`)

### 3.2 Flux d'adhésion

- [x] Service : demande → validation ou refus → création du compte + numéro de membre → e-mail d'activation ; `AuditLog`
- [x] Page `/member` minimale (statut d'adhésion, mes inscriptions, déconnexion)
- [x] Test Playwright du flux complet, e-mails lus dans Mailpit (`e2e/contenus.spec.ts`, `e2e/recette.spec.ts`)

### 3.3 Administration (conçue à 1440 px d'abord)

- [x] Layout SaaS : sidebar fixe, header, fil d'Ariane, recherche, raccourcis clavier ; repli mobile
- [x] Composants de données : tableau triable, filtres, actions groupées, panneau latéral, listes de cartes sous 768 px
- [x] Tableau de bord avec chiffres réels
- [x] Demandes d'adhésion (utilisable sur téléphone)
- [x] Membres : liste, filtres, fiche, statut, suspension, renouvellement, archivage
- [x] Livres (upload de couverture vérifié), catégories, auteurs, livre du mois
- [x] Événements : créer, modifier, publier, clôturer ; inscrits ; export CSV
- [x] Articles : éditeur, aperçu, brouillon / publié (date programmable) / archivé
- [x] Paramètres du club (`Setting` : nom, coordonnées, réseaux, délais)
- [x] Comptes administratifs et rôles (super-administrateur), tracés dans `AuditLog`

### 3.4 SEO et PWA

- [x] Metadata par page, Open Graph, `sitemap.xml`, `robots.txt`
- [x] Manifest, icônes, couleur de thème, écran de démarrage (installation non essayée sur un téléphone)
- [x] Service worker minimal + page hors ligne

### 3.5 Recette

- [x] Vérification un par un des 12 critères de la section 13 du cahier des charges, résultat rapporté pour chacun (`docs/RECETTE.md`)
- [x] typecheck + lint + tests + e2e ; mise à jour de ce fichier ; commit
- [x] **STOP — validation** : MVP testé par le porteur du projet ; défauts remontés corrigés (session, cohérence selon le visiteur) ; phase déclarée terminée le 14/11/2026

---

## Phase 4 — V2 Communauté ✅ (validée le 15/11/2026)

**Point de validation à la fin de la partie C seulement.** Démarrée le 14/11/2026 à la demande du porteur du projet, **avant la mise en ligne** (qui reste en attente du choix d'hébergement : voir « Réserves »). Trop grosse pour une session : découpée en trois parties, **une session chacune**. À la fin de chaque partie : contrôle visuel §7.5, `pnpm typecheck`, `pnpm lint`, `pnpm test`, ce fichier à jour, commit (et push dès qu'un dépôt distant existe), puis arrêt. Pour reprendre : « Continue la phase 4 d'après PROGRESS.md » → relire `CLAUDE.md` et ce fichier, enchaîner sur la première partie non terminée.

Répartition (`CLAUDE.md` §11) : le schéma et la migration, le QR et le scan, le moteur de points et badges, le calcul des classements Scrabble (et l'anti-triche des quiz) sont faits par `architecte-expert` puis relus par `relecteur-expert`. Le reste (pages, textes, styles, formulaires simples, tests courants) se fait dans la session principale.

Préalables non remplis, assumés par le porteur : mise en ligne et recette en ligne ; réponses du comité sur les records et récompenses Scrabble et sur l'expiration de la carte (en attendant : rien d'affiché pour les records et récompenses vides, durée de 12 mois gardée en interne).

### Partie A — Fondations et espace membre ✅ (14/11/2026)

- [x] Schéma complet de la phase 4 — **`architecte-expert`** : lectures, critiques et modération, présences, points, badges, niveaux, tournois, manches, équipes, scores, records, quiz (`Quiz`, `QuizQuestion`, `QuizChoice`, `QuizAttempt`, `QuizAnswer`), notifications ; permissions ajoutées au catalogue (`quizzes.manage`…) ; migration versionnée ; seed idempotent (règles, badges, niveaux, démo marquée `isDemo`) ; tests
- [x] Layout de l'espace membre : barre d'onglets en bas sur mobile (Accueil, Lectures, Événements, Scrabble, Profil), navigation adaptée sur desktop ; aucun onglet vers une page inexistante
- [x] Tableau de bord : adhésion et carte, prochaines inscriptions, lectures en cours, points et niveau, badges (blocs vides soignés tant que les parties B et C ne les alimentent pas)
- [x] Profil : coordonnées modifiables (Zod client et serveur), retrait des classements, photo facultative (type et taille vérifiés, nom régénéré ; pas de photo publique pour un mineur)
- [x] Carte de membre numérique — **`architecte-expert`** pour le QR : état de la carte (réglée ou à régler), jeton opaque signé sans donnée personnelle, consultable avec une connexion faible (cache du service worker)
- [x] Relecture **`relecteur-expert`** : schéma, migration, QR
- **Critères de fin** : migration appliquée sur une base vide et sur la base de dev ; seed lancé deux fois sans doublon ; tests unitaires du schéma (contraintes) et du jeton QR (signature, falsification, expiration) ; parcours Playwright de l'espace membre (onglets, profil, photo, carte) en mobile et desktop ; captures 375 / 768 / 1440 px critiquées ; typecheck, lint, tests verts ; commit

**Bilan de la partie A** (commits `3713fbb` et `cf9e4a1`) :

- **Sous-agents** : le schéma, la migration, le seed, les permissions et le jeton du QR ont été faits par `architecte-expert` ; la relecture par `relecteur-expert`. **Les deux ont tourné sur Opus 5.5 et non sur Fable** : le quota Fable est épuisé jusqu'au 20/11 (premier lancement arrêté sans rien écrire). Le reste (layout, pages, profil, photo, carte, service worker, tests e2e) a été fait dans la session principale.
- **Schéma** : migration `20261114120000_phase4_communaute` (niveaux, quiz et ses cinq tables, série et version révocable de la carte, méthode de pointage `QR_SCAN` / `MANUAL`, soumission des lectures, `countsForMonthly` des tournois, contraintes CHECK). Appliquée sur une base vide temporaire et sur la base de dev (sans réinitialisation). Permission `quizzes.manage` (administrateur, responsable communication). Niveaux proposés : Esprit curieux 0, Plume en éveil 100, Voix affirmée 300, Pilier de l’Agora 700, Flamme de l’Agora 1 500 ; règle de points « quiz » à 10 (à valider par le comité). Détail : `docs/DECISIONS.md` §10.
- **Espace membre** : barre d'onglets en bas sur mobile, colonne latérale sur desktop. **Seuls Accueil, Événements et Profil sont affichés** : Lectures et Scrabble apparaîtront quand leurs pages existeront (parties B et C ; `ready` dans `src/config/navigation.ts`). Tableau de bord (carte, prochaines rencontres, lectures en cours, points, niveau, badges), Mes inscriptions (`/member/events`), Profil (téléphone, retrait des classements, photo ; nom et e-mail corrigés par un responsable), Carte (`/member/card`).
- **Photo de profil** : JPEG, PNG ou WebP vérifiés au contenu, 2 Mo, nom régénéré, limite de 10 envois par heure ; servie par `/api/member/photo/…` aux seules personnes connectées, jamais par `/uploads`. Effacée du disque quand elle est remplacée, retirée, ou à l'archivage du membre.
- **Carte et QR** : jeton `A1.<série>.<version>.<HMAC>` dérivé de `BETTER_AUTH_SECRET` (aucune donnée personnelle, sans expiration, révocable par « Remplacer ma carte », tracé dans `AuditLog`). Hors ligne : la page de la carte est gardée par le service worker, effacée à la déconnexion ou quand le serveur ne la renvoie plus. Sur mobile, le QR est en tête de page.
- **Vérifié** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (**1 214 tests**) ; `e2e/espace-membre.spec.ts` sur le build de production, mobile et desktop (**4 parcours réussis**, dont la carte hors ligne et son effacement à la déconnexion) ; captures 375 / 768 / 1440 px des quatre pages (`docs/captures/phase-4a/`, non suivi), deux reprises : QR placé avant la carte sur mobile, « Se déconnecter » en double ou en triple sur desktop.
- **Choix à trancher, signalés par la relecture** (rien changé) : rien en base ne lie la question d'une réponse au quiz de la tentative (le service de la partie C devra le vérifier) ; un administrateur peut révoquer la carte d'un super-administrateur (aucune interface ne l'appelle encore) ; `db:clear-demo` retire les points gagnés sur des objets de démonstration mais pas les badges qu'ils auraient déclenchés ; sur un téléphone partagé sans déconnexion, la carte reste lisible hors ligne jusqu'au prochain passage en ligne ; la photo reste dans le cache HTTP du navigateur après déconnexion (`private`, un an) ; tout compte connecté peut ouvrir la photo d'un autre s'il connaît son nom aléatoire.
- **Non vérifié** : suite Playwright entière (seul `espace-membre.spec.ts` a été relancé) ; `pnpm db:seed` et `pnpm db:clear-demo` après la relecture (exécutés par l'architecte avant) ; vrai téléphone, PWA installée, Safari iOS ; migration sur une base dont des données de phase 3 violeraient les nouvelles contraintes. **Pas de push : aucun dépôt distant n'est configuré.**

### Partie B — Lectures, présences et points ✅ (14/11/2026)

- [x] Mes lectures : statuts (à lire, en cours, terminé), progression, note personnelle, favoris, historique ; « livre terminé » soumis à validation
- [x] Critique soumise à modération ; file de modération et validation « livre terminé » côté admin
- [x] Mes inscriptions (reprise de la V1 dans le nouveau layout) et Mes activités (historique des présences)
- [x] Scan QR des présences — **`architecte-expert`** : page admin caméra (Route Handler), pointage « présent » et case « payé », saisie manuelle de secours, `AuditLog`
- [x] Moteur de points et badges — **`architecte-expert`** : attribution après validation ou présence, anti-doublon, correction par transaction inverse motivée, badges automatiques après chaque transaction, badge manuel, niveaux ; barème modifiable dans l'admin
- [x] Classements mensuel et général (membres seulement, top 10 + sa position, retrait possible) ; page Mes récompenses
- [x] Relecture **`relecteur-expert`** : scan, points, badges
- **Critères de fin** : tests unitaires (doublons, corrections, seuils de badges, jeton rejoué) ; Playwright : lecture terminée → validée → points et badge ; critique modérée ; scan d'un QR (et saisie manuelle) → présence, payé, points ; captures 375 / 768 / 1440 px (admin : 1440 / 1280 / 375) ; typecheck, lint, tests verts ; commit

**Bilan de la partie B** (commits `6b8cf7b` et `2d99f76`) :

- **Sous-agents** : moteur de points et badges, classements et scan QR des présences par `architecte-expert` ; relecture par `relecteur-expert`. **Les deux sur Opus 5.5 et non sur Fable** (quota Fable épuisé jusqu'au 20/11 ; une limite d'usage Opus a aussi interrompu l'architecte, repris ensuite). Lectures, critiques, pages membre et administration (file de validation, points et badges) faits dans la session principale.
- **Membre** : onglet Lectures (à lire, en cours, terminés, favoris ; progression, note personnelle), fiche d'une lecture (demande de validation « livre terminé », critique notée de 1 à 5 avec accord de publication sous le prénom), ajout depuis la fiche publique d'un livre ; Mes rencontres (inscriptions et Mes activités : présences, participation réglée) ; Mes récompenses (niveau, badges obtenus et à obtenir avec avancée, historique des points, classement du mois et général : top 10 + sa position, prénom et initiale, retrait possible depuis le profil).
- **Administration** : « Lectures à valider » (livres terminés et critiques, refus toujours motivé, compteur dans le menu) ; « Points et badges » (barème modifiable, ajustement motivé, badge manuel, correction d'une ligne par ligne inverse ; un responsable ne touche pas à ses propres points) ; « Scan des présences » (`/admin/scan` : rencontre du jour, caméra avec `BarcodeDetector` ou jsqr 1.4.0 en repli, case « payé », recherche d'un inscrit en secours).
- **Points** : présence 20 / 15 / 20 selon le type, livre validé 50, critique approuvée 30 ; anti-doublon en base ; badges réévalués après chaque attribution, jamais retirés automatiquement. Un compte sans numéro de membre ne reçoit rien (comptes de responsables).
- **Relecture, quatre défauts corrigés** : une critique réécrite pendant la modération pouvait être approuvée sans avoir été lue (la décision porte désormais sur la version affichée) ; gestes simultanés sur une lecture (validation et refus, validation et retrait) ; la saisie de secours du scan pointait un compte suspendu ; total faux dans l'admin des points au-delà de 200 lignes.
- **Vérifié** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (**1 549 tests**, dont des tests du moteur et du scan sur la vraie base) ; Playwright sur build de production : `espace-membre`, `lectures` et `scan-presence` (**9 réussis, 1 ignoré volontairement** : la validation n'est jouée que sur ordinateur ; `lectures` et `scan-presence` relancés après la relecture) ; captures 375 / 768 / 1440 px (membre) et 1440 / 1280 / 375 px (admin) dans `docs/captures/phase-4b/` (non suivi). Reprises : surtitre de Mes récompenses, champs d'ajustement à l'étroit, menu d'administration devenu trop long à 900 px de haut (fondu en bas signalant la suite) ; un formulaire de lecture restait bloqué sur « Enregistrement… » sur mobile (double rafraîchissement), corrigé.
- **À trancher** (rien changé) : un compte suspendu reçoit encore les points d'une lecture validée ou d'une critique approuvée ; le pointage depuis la fiche d'un événement ne vérifie pas son statut (brouillon, annulé) ; décocher « présent » sur une séance réglée annule l'encaissement (un commentaire du code dit l'inverse : lequel fait foi ?) ; une correction compte au mois où elle est écrite dans le classement mensuel ; les critiques approuvées d'un membre archivé restent publiques sous son prénom ; inscription sur place au scan (refusée aujourd'hui) ; afficher ou non le code texte de la carte sous le QR (pour la saisie de secours) ; barème « quiz » et noms des niveaux à valider par le comité.
- **Non vérifié** : la caméra sur un vrai téléphone (elle exige HTTPS ou `localhost`, donc pas `pnpm dev:lan` par adresse IP) ; deux transactions PostgreSQL réellement simultanées sur une lecture (testé en base simulée) ; suite Playwright entière (seuls les trois parcours de l'espace membre, des lectures et du scan) ; l'avertissement de dépréciation `pg` (« client.query() already executing ») vu pendant les tests de transaction, venu de Prisma selon l'architecte. **Pas de push : aucun dépôt distant.**
- Après une validation, la demande disparaît de la file ; le message « Validée. » part avec elle (pas d'annonce persistante pour les lecteurs d'écran).

### Partie C — Scrabble, quiz et notifications ✅ (15/11/2026)

- [x] Admin Scrabble : tournois individuels et par équipes (duplicate / classique), participants (dont extérieurs), équipes, manches, appariements, récompense, records
- [x] Saisie des scores sur téléphone (`inputmode="numeric"`), validation puis publication par le responsable Scrabble
- [x] Calcul des classements — **`architecte-expert`** : règle du tournoi, égalités, forfaits, équipes, duplicate ; classement mensuel ; points de victoire
- [x] Pages publiques et membre : tournois, résultats, palmarès, records (rien à vide)
- [x] Quiz en ligne — anti-triche par **`architecte-expert`** : admin (créer, questions, aperçu, publier, clore, résultats), membre mobile d'abord (une question par écran, chrono serveur, score à la fin), points, classement des quiz
- [x] Notifications in-app (liste, non lues, marquer comme lu) et par e-mail pour les plus importantes
- [x] Archives : fiches de lecture validées et palmarès Scrabble reliés à `/archives`
- [x] Relecture **`relecteur-expert`** : classements, quiz
- **Critères de fin** : tests unitaires des classements (égalités, forfaits, participant extérieur, équipes) et des quiz (score, fenêtre, durée dépassée, double participation) ; Playwright : tournoi saisi → validé → publié → palmarès ; quiz créé → joué sur téléphone → points → classement ; notification reçue ; captures ; typecheck, lint, tests, suite e2e entière ; commit

**Bilan de la partie C** (commits `7f53302` et `5592bb5`) :

- **Sous-agents** : couche serveur du Scrabble (classements, saisie, validation, publication, points de victoire, classement mensuel, records) et couche serveur des quiz (tentative chronométrée, anti-triche, points, classements) par deux `architecte-expert` en parallèle ; relecture par `relecteur-expert`. **Tous sur Opus 5.5 et non sur Fable** (quota Fable épuisé jusqu'au 20/11 ; une limite d'usage de 5 h a interrompu les deux architectes, repris ensuite). Notifications, pages (administration, membre, public), archives et parcours Playwright dans la session principale.
- **Scrabble** : administration (`/admin/scrabble` : liste ; feuille d'un tournoi avec cycle de vie, joueurs membres ou extérieurs, équipes, manches, appariements en classique, classement provisoire en direct, validation, publication, dévalidation motivée ; réglages ; `/admin/scrabble/[id]/rounds/[roundId]` : saisie des scores sur téléphone, clavier numérique, forfait d'un geste ; `/admin/scrabble/records`). Public : `/scrabble` (à venir, palmarès en section indigo, records si définis, historique) et `/scrabble/[slug]` (classement final seulement après publication). Membre : onglet **Scrabble** activé (classement du mois, mes tournois, accès aux quiz). Règles retenues (`docs/DECISIONS.md` §13) : nulle = demi-victoire, forfait = défaite à 0, égalité parfaite = rang partagé, joueur retiré classé après les autres et jamais vainqueur, équipe = somme de ses joueurs, correction d'un score validé refusée (dévalider d'abord), classement mensuel = `classés − rang + 1` par tournoi publié dans le mois.
- **Quiz** : administration (`/admin/quizzes` : liste, fiche avec réglages, questions à une bonne réponse, aperçu côté membre, publication, clôture, archivage, résultats et réussite par question). Membre : `/member/quiz` (ouverts, à venir, terminés, classement général) et `/member/quiz/[slug]` (présentation, jeu une question par écran avec chrono tenu par le serveur, score, corrigé **après la clôture seulement**, classement du quiz). Règles (`docs/DECISIONS.md` §12) : propositions mélangées par tentative, tolérance réseau de 5 s, ce qui reste modifiable après publication, notification in-app à la première publication.
- **Notifications** : service unique (`src/features/notifications/service.ts`), in-app + e-mail pour les plus importantes : lecture validée ou refusée, critique approuvée ou refusée, résultats d'un tournoi publiés (e-mail) ; inscription à une rencontre et bienvenue à la validation de l'adhésion (in-app, l'e-mail existait déjà) ; nouveau quiz (in-app). Page `/member/notifications` (non lues, marquer comme lu, tout marquer comme lu), compteur dans la colonne latérale, bandeau discret sur mobile tant qu'il reste du non lu.
- **Archives** : fiches de lecture (critiques approuvées publiées sous le prénom) et palmarès Scrabble, filtrables par activité et par année.
- **Relecture, défauts corrigés** : un quiz dont la fermeture était passée (corrigé visible) pouvait être rouvert ; les identifiants des propositions trahissaient l'ordre de saisie (donc souvent la bonne réponse) ; un nom restait dans les pages Scrabble publiques (cache) après un retrait des classements ou un archivage. Côté interface : la fin du chrono attend la réponse en route ; « les points sont ajoutés » retiré (faux si la règle est inactive) ; les formulaires d'ajout se vident à l'envoi (Playwright a montré qu'une saisie enchaînée était effacée). `pnpm db:clear-demo` aurait échoué sur un tournoi classique de démonstration (corrigé par l'architecte).
- **Vérifié** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (**2 449 tests**) ; `e2e/scrabble-quiz.spec.ts` sur le build de production (**2 réussis**, 2 ignorés volontairement : tournoi sur ordinateur, quiz sur téléphone). **Suite Playwright entière** sur le build de production : **79 réussis, 15 ignorés volontairement, 0 échec** (passage complet, puis les 5 fichiers corrigés relancés). Les 11 échecs du premier passage venaient de parcours écrits avant la partie A et jamais relancés depuis (déconnexion passée sur la page Profil, textes du tableau de bord, numéro de membre affiché deux fois, onglet Scrabble désormais actif) : tests mis à jour, aucun défaut du produit. Captures 375 / 768 / 1440 px (public et membre) et 1440 / 1280 / 375 px (administration) dans `docs/captures/phase-4c/` (non suivi) ; reprise : titres « À venir » et « Historique » de `/scrabble` qui touchaient la date à 1440 px.
- **À trancher** (rien changé) : joueur exempt en classique (nombre impair) non modélisé ; dévalider puis republier renvoie la notification et l'e-mail ; un responsable qui joue peut saisir ses propres scores (seuls ses points de victoire sont bloqués) ; un joueur retiré garde un rang et des points mensuels, et une équipe de joueurs tous retirés peut finir 1re ; le score affiché juste après une tentative laisse deviner une réponse à un complice ; les écrans de validation sont sous `tournaments.manage` (un futur rôle « résultats seulement » ne les verrait pas) ; le quiz de démonstration garde des identifiants de propositions `cuid()` ; records et récompenses toujours non définis par le comité ; barème « quiz » à valider.
- **À savoir** : le quiz de démonstration a été repassé en brouillon le 15/11 à 02 h 16 par le compte `admin-agora@…` (journal d'audit), pas par un test : laissé tel quel ; il faut le republier depuis l'administration pour le voir côté membre.
- **Non vérifié** : vrai téléphone ; deux validations Scrabble réellement simultanées (sérialisation par verrou relue, pas exécutée) ; envoi des e-mails de notification ailleurs que vers Mailpit ; délai réel d'invalidation du cache en production. **Pas de push : aucun dépôt distant.**

- [x] **STOP — validation de toute la phase 4** : validée par le porteur du projet le 15/11/2026

## Phase 5 — V3 Assistant IA « Le Compagnon des Lettres » ✅ (validée le 20/11/2026)

- [x] Charger le skill `claude-api` avant d'écrire la couche LLM
- [x] `LLMProvider` abstrait (fournisseur et modèle par variables d'environnement)
- [x] Route Handler en streaming : contrôle d'accès, validation Zod, rate limiting
- [x] Interface de chat `/member/assistant`, mobile d'abord
- [x] Sept modes : recommandation (catalogue du club en priorité), mot expliqué, sujet de débat, quiz, questions de compréhension, aide à structurer une critique, défi de vocabulaire
- [x] Prompt système en français ; réponses présentées comme des suggestions ; signalement des références hors catalogue
- [x] Quota par membre et par jour (en base) ; gestion des erreurs ; données envoyées au modèle réduites au nécessaire
- [x] État « Assistant non connecté » sans clé API, aucune réponse simulée
- [x] Tests (fournisseur simulé **dans les tests uniquement**) ; typecheck + lint + tests ; mise à jour de ce fichier ; commit
- [x] **Validation par le porteur du projet** : le 20/11/2026

**Bilan de la phase 5** (commit `4078a7e`) :

- **Sous-agents** : couche serveur (fournisseur, route, prompt, quota, garde-fous) par `architecte-expert`, relecture par `relecteur-expert`, **tous deux sur Opus 5.5** (Fable : quota épuisé, puis « crédits d'usage requis » le 20/11 ; deux limites d'usage ont interrompu l'architecte, repris ensuite). Interface, intégration, parcours Playwright dans la session principale.
- **Couche LLM** : `src/lib/llm/` (interface `LLMProvider`, implémentation Anthropic avec `@anthropic-ai/sdk` 1.8.0). Variables : `LLM_PROVIDER` (défaut `anthropic`), `LLM_API_KEY`, `LLM_MODEL` (défaut `claude-opus-5-5`), `ASSISTANT_DAILY_LIMIT` (défaut 20). Pensée adaptative, effort `low` (chat), `max_tokens` 8 000, repli serveur sur refus (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01` : deux lignes à retirer dans `anthropic.ts` pour s'en passer), prompt stable mis en cache. Détail : `docs/DECISIONS.md` §14.
- **Route `POST /api/assistant`** : session et `member.access`, Zod, débit (5 par minute), quota du jour en base (table `RateLimit`, clé HMAC du membre et du jour, **aucune migration**), puis réponse diffusée en texte brut avec le quota restant. Refus du modèle, coupure et panne en cours de route signalés dans le texte. Aucune donnée personnelle envoyée au modèle ; rien de la conversation dans les journaux ; conversations non stockées (l'historique reste dans le navigateur).
- **Interface** : `/member/assistant` (lien dans la colonne latérale et sur le tableau de bord) : sept modes en pastilles, réponse au fil de l'eau rendue en Markdown sans HTML ni lien cliquable, « Arrêter », quota restant, état « quota atteint ». **Sans clé : « Assistant non connecté », aucun champ de saisie, la route répond 503.**
- **Relecture, défauts corrigés** : un titre du catalogue pouvait fermer la balise `<catalogue>` du prompt (injection) ; un premier morceau vide était compté comme une réponse ; une annulation avant le premier mot rendait la question (un « Arrêter » répété contournait le quota : la question reste désormais comptée) ; côté interface, une longue réponse précédente bloquait la conversation (coupée avant renvoi), lecteur d'écran saturé pendant la diffusion, défilement qui ne suivait pas le texte, liens écrits par le modèle cliquables. Le build a aussi refusé `export const dynamic` dans la route (incompatible avec `cacheComponents`), retiré.
- **Vérifié** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (**2 583 tests**, deux passages complets) ; `e2e/assistant.spec.ts` (sans clé : « non connecté », 401 visiteur, 503 membre) ; interface vérifiée dans le navigateur avec une **clé factice** et la requête interceptée par Playwright (envoi, affichage, quota restant, quota atteint ; aucun appel au modèle) ; captures 375 / 768 / 1440 px dans `docs/captures/phase-5/` (non suivi). **Suite Playwright entière** sur le build de production : **81 réussis, 15 ignorés volontairement, 0 échec**.
- **À trancher** : `LLM_MODEL` accepte n'importe quel nom alors que les paramètres envoyés (repli, pensée, effort) supposent un modèle récent ; plafond de taille du corps de la requête ; `ANTHROPIC_BASE_URL`, si elle existe sur le serveur, détourne les appels ; le nom du club dans le prompt vient de `site.ts` et non de l'administration ; quota de 20 questions par jour et coût par question (modèle Opus 5.5 par défaut) à valider ; un refus en pleine réponse fait continuer le modèle de repli à la suite (texte possiblement décousu).
- **Non vérifié** : **aucun appel réel au modèle** (aucune clé) : réponses, repli, effet du cache, délai avant le premier mot restent à constater avec la première clé ; vrai téléphone. **Pas de push : aucun dépôt distant.**

---

## Phase 6 — Qualité et livraison ✅ (validée le 20/11/2026)

- [x] Tous les contrôles : typecheck, lint, unitaires, Playwright mobile + desktop
- [x] Matrice de permissions : chaque rôle tente d'accéder à chaque zone protégée
- [x] Lighthouse mobile sur les pages principales (budget §7 bis)
- [x] Audit : erreurs console, navigation clavier, contrastes, `reduced-motion`, états vides
- [x] Revue design : 375 px pour toutes les pages publiques et membre ; 1440 px pour l'admin (+ 375 px pour adhésions, scan QR, scores) ; corrections
- [x] Revue sécurité : chaque Server Action et Route Handler (contrôle d'accès + Zod) ; liste des constats et correctifs
- [x] `README.md` : installation, migrations, seed, création de l'admin, lancement
- [x] `docs/SAUVEGARDE.md` : `pg_dump` + restauration **réellement testée**
- [x] Guide administrateur (`docs/GUIDE-ADMINISTRATEUR.md`)
- [x] `.env.example` complet
- [x] Rapport de livraison (`docs/RAPPORT-LIVRAISON.md`)
- [x] **Validation par le porteur du projet** : le 20/11/2026

**Bilan de la phase 6** (commits `1f5ff65` à aujourd'hui) :

- **Sous-agents** : revue de sécurité et revue design finale par `relecteur-expert`, **sur Opus 5.5** (Fable : « crédits d'usage requis »). Matrice des permissions, audit, Lighthouse, documentation et corrections dans la session principale.
- **Sécurité** (`docs/REVUE-SECURITE.md`) : 101 Server Actions et 9 Route Handlers relus, tous avec contrôle d'accès en premier et Zod. Corrigé : contrôle d'origine absent sur les six handlers qui modifient (couverture, photo, scan, recherche, assistant) ; aucune protection contre l'affichage dans un cadre ; échappement sans effet du JSON-LD ; un nouveau handler pouvait échapper aux matrices de tests.
- **Permissions** : test statique (toute page protégée appelle `requirePageAccess`, 45 cas) et parcours Playwright `e2e/permissions.spec.ts` (visiteur, membre et cinq rôles de responsables × chaque zone protégée) : aucun écart.
- **Lighthouse mobile** (médiane, Android milieu de gamme, 4G lente) : performance 92 à 99 et accessibilité 100 sur dix pages ; LCP 0,9 à 1,2 s ; CLS ≤ 0,002. Corrigé : contraste des compteurs « 1/5 » de `/activities`.
- **Audit** (`e2e/audit.spec.ts`, mobile et ordinateur) : aucune erreur de console sur 40 pages ; lien d'évitement et focus visible ; aucune animation avec `prefers-reduced-motion`.
- **Revue design** (`docs/REVUE-DESIGN.md`) : 51 pages, 43 au niveau, aucune « template ». Les 7 P1 sont corrigés (barre latérale d'administration, listes déroulantes sans chevron ni fond, « 16 h » coupé, badges en cartes pointillées refaits, bandeau de démonstration dans les espaces membre et admin, journal en codes techniques) et six P2 simples ; les autres P2 et les P3 restent listés dans le document. Défaut trouvé en chemin : Tailwind générait aussi les classes citées dans `docs/`, ce qui a cassé le build : dossier exclu des sources.
- **Sauvegarde** : sauvegarde et restauration retestées sur base au repos (44 tables, 2 451 lignes, 3 migrations, archive des images identique).
- **Documentation** : `README.md`, `docs/GUIDE-ADMINISTRATEUR.md`, `docs/RAPPORT-LIVRAISON.md`, `.env.example` complété.
- **Vérifié** : `pnpm typecheck`, `pnpm lint`, `pnpm test` (**2 694 tests**). **Suite Playwright entière** sur le build de production, après toutes les corrections : **88 réussis, 16 ignorés volontairement, 0 échec** (dont la matrice des permissions et l'audit).
- **Non vérifié** : vrai téléphone ; derrière le vrai proxy de production (`X-Forwarded-For`, contrôle d'origine, en-têtes, cookies hors `localhost`) ; assistant avec une vraie clé ; envoi d'e-mails hors Mailpit. **Pas de push : aucun dépôt distant.**

## Problèmes connus

- Aucun dépôt distant Git : le projet n'existe que sur ce poste. À configurer (et à sauvegarder) dès que possible.
- Une adresse `[slug]` inconnue affiche la page « introuvable » mais répond HTTP 200 pour `/library`, `/news`, `/events` et `/scrabble` (constaté le 20/11 ; la page est `noindex`). La vérification d'existence se fait sous `<Suspense>`, après le début du flux : à sortir du flux.
- `/library/[slug]` et `/news/[slug]` gardent le squelette retiré de `/events/[slug]` : même gain de LCP à aller chercher.
- `e2e/phase3-pages.spec.ts` modifie puis remet la charte : le numéro de version de la base de développement avance de deux à chaque passage.
- Administration : sur une fiche qui arrive en flux, une saisie faite avant que la page soit prête peut s'ajouter au texte du champ au lieu de le remplacer (vu une fois par Playwright, jamais constaté à la main). À surveiller sur un téléphone lent.
- `src/components/admin/data-table.tsx` (~340 lignes) et `src/features/phase3.test.ts` dépassent la limite indicative de 300 lignes : à découper.
- L'éditeur d'article publie la version enregistrée : des modifications non enregistrées ne partent pas avec « Publier ».
- La recherche globale de l'administration ouvre la fiche par `?open=<id>` : si la ligne est au-delà du plafond de la liste, le panneau ne s'ouvre pas.
- `src/features/members/components/members-table.tsx` (~500 lignes) et `src/features/events/components/event-admin-panels.tsx` dépassent la limite indicative de 300 lignes : à découper.

- `src/app/design-system/page.tsx` fait 302 lignes (limite indicative ~300) : à découper si la page grossit.
- La première passe Lighthouse après démarrage du serveur est plus basse (86) que les suivantes (98).
- Le serveur de dev est très lent sur ce poste quand Playwright tourne en même temps (mémoire saturée) : voir « Écarts et limites de la phase 2 ».
- Dans le journal d'audit, l'auteur d'une action dont le compte a été supprimé s'affiche « Système » (ne concerne aujourd'hui que les comptes de test, les vrais comptes étant archivés et non supprimés).
- Un port 3100 est occupé par une autre application sur ce poste : la configuration `agora-prod` de `.claude/launch.json` démarre alors sur 3101.

## Journal

- **20/11/2026** — **Phase 6 validée** par le porteur du projet : toutes les phases du plan sont terminées.
- **20/11/2026** — **Phase 6 terminée, en attente de validation** : revues de sécurité et de design, matrice des permissions, Lighthouse, audit, sauvegarde retestée, README, guide administrateur, rapport de livraison.
- **20/11/2026** — **Phase 5 validée** par le porteur du projet.
- **20/11/2026** — **Phase 5 terminée, en attente de validation** : assistant « Le Compagnon des Lettres » (fournisseur abstrait, route en streaming, quota en base, sept modes, interface mobile, « non connecté » sans clé). Sous-agents sur Opus. 2 583 tests unitaires. Aucun appel réel au modèle (pas de clé).
- **15/11/2026** — **Phase 4 validée** par le porteur du projet.
- **15/11/2026** — **Partie C de la phase 4 terminée, phase 4 complète, en attente de validation** : Scrabble (administration, saisie sur téléphone, classements, palmarès, records), quiz chronométrés par le serveur, notifications in-app et e-mail, archives. Sous-agents sur Opus faute de quota Fable. 2 449 tests unitaires. Rien n'est poussé (aucun dépôt distant).

- **14/11/2026** — **Partie B de la phase 4 terminée** : lectures et critiques modérées, présences par scan QR, moteur de points et badges, classements, Mes récompenses, administration des points. Sous-agents sur Opus faute de quota Fable. 1 549 tests unitaires ; parcours e2e de l'espace membre, des lectures et du scan au vert. Rien n'est poussé (aucun dépôt distant).
- **14/11/2026** — Phase 4 découpée en trois parties (A, B, C). **Partie A terminée** : schéma complet de la phase 4 et migration, espace membre (onglets, tableau de bord, inscriptions, profil, photo privée), carte de membre avec QR signé consultable hors ligne. Sous-agents lancés sur Opus faute de quota Fable. 1 214 tests unitaires, parcours e2e de l'espace membre au vert. Aucun dépôt distant : rien n'est poussé.
- **14/11/2026** — Pendant le test du MVP par le porteur du projet : configuration des modèles (`CLAUDE.md` §11, sous-agents) ; réserves des critères 8 et 9 levées par le sous-agent `relecteur-expert` (927 tests, huit validations corrigées) ; requêtes forgées et annulation depuis `/member` couvertes en Playwright ; sauvegarde et restauration d'essai testées en local ; options d'hébergement rédigées ; bogue « déconnecté en revenant sur l'accueil » corrigé (le header ne lisait pas la session) ; audit et corrections de cohérence selon le visiteur. **Phase 3 terminée.** Mise en ligne en attente du choix d'hébergement ; aucun dépôt distant.
- **13/11/2026** — Vérifications complémentaires : photo du comité et annulation d'encaissement exécutées et testées ; pages de la phase 3 ouvertes et parcourues (quatre défauts corrigés, dont des caractères corrompus dans les textes de démonstration) ; Lighthouse mobile sur cinq pages avec corrections ; `pnpm dev:lan` pour tester depuis un téléphone. `docs/CONTENUS-CLUB.md` suivi par Git, `docs/captures/` retiré du suivi.
- **13/11/2026** — Contenus officiels du club : slogan, trois dimensions, cinq activités, lancement du 26 décembre, comité, charte, cotisations, comptes rendus et archives, affiche QR. Migration, seed, pages publiques et administration ; 108 tests unitaires et le parcours Playwright `contenus.spec.ts` passent. Deux bogues de la phase 3 corrigés (validation d'adhésion, messages masqués).

- **11/11/2026** — Phase 0 : audit du dossier et des outils, versions vérifiées sur npm, deux épinglages nécessaires (Prisma 7.10.1, TypeScript 6.0.3), 31 points du cahier des charges documentés, plan des phases 1 à 6 rédigé. Rien n'a été supprimé, aucun code applicatif écrit, aucun commit.
- **11/11/2026** — Phase 1 : projet Next.js 16.4.6 initialisé, direction artistique « La page et le gradin » rédigée, tokens, composants d'identité (tuile, hémicycle, couvertures générées), page `/design-system`, page d'accueil complète en contenu de démo, page « En construction », manifest PWA. Deux itérations de contrôle qualité, budget Lighthouse mobile tenu. L'installation des paquets a été très lente (connexion instable) : prévoir `--fetch-timeout 300000 --network-concurrency 4` si cela se reproduit.
- **12/11/2026** — Phase 3 (interrompue) : site public branché sur la base, service d'adhésion, page `/member`, administration complète écrits et commités. typecheck, lint, 91 tests unitaires et build passent. Arrêt demandé avant toute vérification dans le navigateur : pas de captures, pas d'e2e, pas de SEO (sitemap, robots), pas de service worker, pas de recette.
- **12/11/2026** — Phase 2 : Docker (PostgreSQL 5433, Mailpit), variables validées par Zod, schéma Prisma complet (33 modèles) et migration initiale avec contraintes CHECK, seed idempotent, `create-admin`, `db:clear-demo`, bandeau de démonstration relié à la base. Better Auth (activation par lien, connexion, déconnexion, mot de passe oublié), `MailService` et gabarits d'e-mails, pages de compte. Permissions (`requireUser`, `requirePermission`, `can`), proxy, limitation de débit en base, `AuditLog`, gestion centralisée des erreurs. Deux causes de lenteur trouvées et corrigées : résolution de `localhost` par nodemailer (6 s), durée de cache du bandeau. Une fuite corrigée : Next journalisait en dev les arguments des Server Actions (mots de passe).

# Revue design finale — phase 6

> Relecture des 51 captures de `docs/captures/phase-6/` (build de production, données de démonstration), le 20/11/2026.
> Référentiel : CLAUDE.md §7 et §7 bis, `docs/DIRECTION-ARTISTIQUE.md`.
> Aucun fichier de code n'a été modifié pendant cette revue : les corrections proposées sont à faire dans la session principale.

## 1. Méthode

1. Les captures pleine page (jusqu'à 10 500 px de haut) sont illisibles en une image : chacune a été découpée en tranches de 1 300 px, lues à taille réelle. Les captures admin à 1440 px ont été lues entières (Journal et Paramètres découpés).
2. Chaque page a été jugée sur : hiérarchie, alignements, rythme vertical, typographie (Young Serif / Work Sans, typographie française), palette, motifs d'identité (tuile, hémicycle, filets), liste « à proscrire » du §7.3, ergonomie tactile (§7 bis), états vides, cohérence entre pages.
3. Chaque défaut qui semblait venir du code a été vérifié dans le source (fichiers cités) ; deux l'ont été aussi dans le build (`.next/static`, CSS) et avec `tailwind-merge` en ligne de commande. Aucun build, aucun Playwright lancé.
4. Artefacts ignorés comme demandé : header, barre d'onglets, CTA collant et barre d'enregistrement figés au milieu des captures ; bandeau « Données de démonstration ».

### Limite importante : une partie des pages publiques n'a pas pu être relue

Les apparitions au défilement sont pilotées en CSS (`.apparition`, `animation-timeline: view()`, `src/app/globals.css` l. 326, composant `Reveal` de `src/components/shared/motion.tsx`). Dans une capture pleine page, rien ne défile : tout bloc `Reveal` situé sous le premier écran reste à l'état initial (`opacity: 0`). Résultat dans les captures : de grands aplats vides là où il y a du contenu.

Blocs **non relus** pour cette raison : accueil (couverture du livre du mois, étagère, liste « Les prochaines rencontres », actualités), À propos (objectifs 2 et 3, contenu des dimensions, comité), Bibliothèque (deux dernières couvertures), Agenda (rencontres de janvier, février, mars), Actualités (deux articles sur trois), logo du pied de page sur ces mêmes pages. Ce n'est pas un défaut du site : un utilisateur qui fait défiler voit le contenu. Mais la revue de ces blocs reste à faire (voir P1-1).

Autre angle mort : `admin-admin_scan-375.png` ne montre que l'état vide (aucune rencontre le jour de la capture). L'écran de scan lui-même n'a pas été relu.

## 2. Verdict par page

Légende : **au niveau** (livrable, petites retouches éventuelles en P2/P3) · **à reprendre** (un défaut visible à corriger) · **à refaire** (composition à repenser). « Partielle » = des blocs invisibles dans la capture (voir ci-dessus).

### Site public (375 px)

| Page            | Capture                                             | Verdict               | Remarques principales                                                                                                                    |
| --------------- | --------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Accueil         | `public-accueil-375`                                | au niveau (partielle) | Premier écran fort : titre calé à gauche, hémicycle rogné, livre du mois sur la scène. Bloc lancement : « 16 / h » coupé (P1-4).         |
| À propos        | `public-about-375`                                  | au niveau (partielle) | Bonne alternance ivoire / indigo / sable. Les boutons « Demander mon adhésion » passent avant les montants (P3).                         |
| Activités       | `public-activities-375`                             | au niveau             | La meilleure page du site : tuiles-initiales, « 1/5 … 5/5 », sections alternées, prochaines dates en filets.                             |
| Bibliothèque    | `public-library-375`                                | à reprendre           | Trois champs de filtre + bouton occupent un écran entier avant le premier livre (P2-6).                                                  |
| Fiche livre     | `public-library_une-si-longue-lettre-375`           | à reprendre           | Trois étiquettes de styles différents empilées au-dessus du titre (P2-7). Le reste (mot du club, cartel du livre du mois) est au niveau. |
| Agenda          | `public-events-375`                                 | au niveau (partielle) | Pas de filtre par activité (P2-8).                                                                                                       |
| Fiche rencontre | `public-events_lancement-de-l-agora-375`            | au niveau             | Programme et « En pratique » en filets, très lisibles. Libellés d'action incohérents (P2-12).                                            |
| Actualités      | `public-news-375`                                   | au niveau (partielle) | —                                                                                                                                        |
| Article         | `public-news_pourquoi-commencer-par-mariama-ba-375` | au niveau             | Chapô en serif, lettrine, colonne de lecture confortable : niveau Medium.                                                                |
| Archives        | `public-archives-375`                               | au niveau             | Le défilement horizontal des filtres n'est pas signalé (P3).                                                                             |
| Scrabble        | `public-scrabble-375`                               | au niveau             | Date du record en chiffres « 06/03/2027 » (P2-10).                                                                                       |
| Tournoi         | `public-scrabble_tournoi-de-scrabble-mars-375`      | au niveau             | Classement à tuiles très réussi. Lien retour d'un autre style (P2-11).                                                                   |
| Adhésion        | `public-membership-375`                             | à reprendre           | Listes déroulantes sans chevron (P1-3) ; bloc tarifs à l'étroit (P2-9).                                                                  |
| Charte          | `public-charte-375`                                 | au niveau             | « Version 19 » : numéro gonflé par les tests e2e (P3).                                                                                   |
| Contact         | `public-contact-375`                                | au niveau             | —                                                                                                                                        |
| Confidentialité | `public-privacy-375`                                | au niveau             | « e- / mail » coupé au trait d'union (P3).                                                                                               |
| Connexion       | `public-login-375`                                  | au niveau             | Le §7.6 prévoit le logo vertical sur la connexion (P3).                                                                                  |

### Espace membre (375 px)

| Page                     | Capture                           | Verdict                     | Remarques principales                                                                                            |
| ------------------------ | --------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Accueil membre           | `membre-member-375`               | à reprendre                 | Pied de page public complet sous l'appli (P2-1) ; pas de bandeau démo (P1-6).                                    |
| Le Compagnon des Lettres | `membre-member_assistant-375`     | au niveau                   | État « non connecté » clair et honnête.                                                                          |
| Ma carte                 | `membre-member_card-375`          | au niveau                   | QR lisible, carte indigo élégante.                                                                               |
| Mes rencontres           | `membre-member_events-375`        | au niveau                   | État vide avec hémicycle : bon modèle.                                                                           |
| Notifications            | `membre-member_notifications-375` | au niveau                   | Idem.                                                                                                            |
| Profil                   | `membre-member_profile-375`       | au niveau                   | « Statut : Aucune adhésion » pour un membre qui a un numéro : à vérifier (P2-13).                                |
| Quiz                     | `membre-member_quiz-375`          | au niveau                   | « 18:00 » au lieu de « 18 h » (P2-10).                                                                           |
| Mes lectures             | `membre-member_readings-375`      | au niveau                   | —                                                                                                                |
| Récompenses              | `membre-member_rewards-375`       | **à refaire** (bloc badges) | Pile de cartes en pointillés, l'exact contraire de la DA (P1-5). Le bloc niveau et le classement sont au niveau. |
| Scrabble et quiz         | `membre-member_scrabble-375`      | au niveau                   | États vides en texte seul, message en double (P3).                                                               |

### Administration (1440 px, et 375 px pour le terrain)

| Page                         | Capture                                     | Verdict                         | Remarques principales                                                                                                                 |
| ---------------------------- | ------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Tableau de bord              | `admin-admin-1440`                          | au niveau                       | Chiffres non alignés d'une carte à l'autre (P2-14). Barre latérale tronquée (P1-2), comme sur toutes les pages.                       |
| Demandes d'adhésion          | `admin-admin_memberships-1440`              | au niveau                       | Filtres en `<select>` natifs (P2-2).                                                                                                  |
| Demandes d'adhésion (mobile) | `admin-admin_memberships-375`               | à reprendre                     | Deux `<select>` natifs de largeurs différentes, en escalier, avec le compteur accroché au second (P2-2).                              |
| Membres                      | `admin-admin_members-1440`                  | au niveau                       | —                                                                                                                                     |
| Encaissements                | `admin-admin_payments-1440`                 | au niveau                       | Gros montants en serif : très bien.                                                                                                   |
| Points et badges             | `admin-admin_points-1440`                   | au niveau                       | « Barème proposé en phase 4 » visible (P2-4).                                                                                         |
| QR d'adhésion                | `admin-admin_qr-1440`                       | au niveau                       | Affiche réussie.                                                                                                                      |
| Livres                       | `admin-admin_books-1440`                    | au niveau                       | Pas de vignette de couverture (P2-15).                                                                                                |
| Catégories et auteurs        | `admin-admin_books_categories-1440`         | au niveau                       | —                                                                                                                                     |
| Livre du mois                | `admin-admin_books_monthly-1440`            | au niveau                       | « Rencontre associée » sans chevron (P1-3).                                                                                           |
| Lectures à valider           | `admin-admin_readings-1440`                 | au niveau                       | États vides soignés.                                                                                                                  |
| Tournois                     | `admin-admin_scrabble-1440`                 | au niveau                       | —                                                                                                                                     |
| Fiche tournoi                | `admin-admin_scrabble_<id>-1440`            | au niveau                       | « Archiver » ressemble à un onglet (P2-16).                                                                                           |
| Saisie des scores (mobile)   | `admin-admin_scrabble_<id>_rounds_<id>-375` | au niveau                       | Champs de score larges, `inputmode` numérique. Titre de barre « Fiche » (P2-17).                                                      |
| Records du club              | `admin-admin_scrabble_records-1440`         | au niveau                       | « Supprimer » non signalé comme destructif ; « « / OXYDANTS » coupé (P2-18).                                                          |
| Événements                   | `admin-admin_events-1440`                   | au niveau                       | —                                                                                                                                     |
| Articles                     | `admin-admin_articles-1440`                 | au niveau                       | —                                                                                                                                     |
| Quiz                         | `admin-admin_quizzes-1440`                  | à reprendre                     | L'entrée active « Quiz » est cachée sous le fondu de la barre latérale (P1-2).                                                        |
| Comité de pilotage           | `admin-admin_committee-1440`                | au niveau                       | « : rôle » rejeté en début de ligne (P2-18).                                                                                          |
| Équipe et rôles              | `admin-admin_team-1440`                     | au niveau                       | —                                                                                                                                     |
| Charte                       | `admin-admin_charter-1440`                  | au niveau                       | Éditeur + aperçu côte à côte : bien.                                                                                                  |
| Paramètres                   | `admin-admin_settings-1440`                 | au niveau                       | —                                                                                                                                     |
| Journal                      | `admin-admin_audit-1440`                    | **à reprendre**                 | Codes techniques bruts (`points.awarded`, `quiz.published`, `PointTransaction`…) (P1-7) ; 200 lignes sans recherche ni filtre (P2-5). |
| Scan des présences (mobile)  | `admin-admin_scan-375`                      | au niveau (état vide seulement) | L'écran de scan n'a pas été capturé.                                                                                                  |

**Bilan : 51 pages. 43 au niveau, 7 à reprendre, 1 à refaire (bloc badges des récompenses).**
Aucune page ne ressemble à un template. L'identité tient partout : tuiles-initiales, hémicycles rognés, filets, Young Serif en grand corps, surtitres terracotta. L'admin évite le « kit shadcn » : titres en serif, tableaux à filets, gros chiffres en serif. Les défauts sont des finitions, plus une dette sur deux composants partagés (listes déroulantes, barre latérale admin).

## 3. Défauts classés par priorité

### P1 — à corriger avant livraison

**P1-1. Refaire les captures sans animation de défilement, puis relire les blocs manquants.**

- Captures : accueil, À propos, Bibliothèque, Agenda, Actualités (voir §1).
- Problème : les blocs `Reveal` sous le premier écran sont à `opacity: 0` dans une capture pleine page. Environ un tiers de l'accueil n'a pas été relu.
- Correction : dans `e2e/zz-captures-6.spec.ts`, créer les trois contextes avec `browser.newContext({ extraHTTPHeaders: randomClient(), reducedMotion: "reduce" })`. La règle `.apparition` ne s'applique alors pas (`@media (prefers-reduced-motion: no-preference)`). Recapturer les cinq pages et faire relire les blocs listés au §1. Ajouter au passage une rencontre du jour pour capturer l'écran de scan.

**P1-2. Barre latérale admin : à 1440 × 900, sept rubriques sont invisibles, dont la rubrique active.**

- Captures : toutes les `admin-*-1440`. Le plus visible : `admin-admin_quizzes-1440`, où « Quiz » (actif) est caché sous le fondu.
- Problème : 21 entrées à 34 px, plus 5 titres de groupe, plus le bloc compte (nom, rôle, « Voir le site », « Se déconnecter », ~160 px) dépassent la hauteur d'un portable de 900 px. « Quiz », « Comité de pilotage », « Charte du club », « QR d'adhésion », « Paramètres du club », « Équipe et rôles » et « Journal » sont dans une zone qui défile sans barre visible, sous un `mask-image`. Sur ces pages, l'administrateur ne voit pas où il est.
- Correction (`src/features/admin/components/admin-chrome.tsx`) :
  1. Faire défiler la rubrique active dans la vue au montage : `ref` sur le lien actif + `useEffect(() => ref.current?.scrollIntoView({ block: "nearest" }), [pathname])`.
  2. Gagner de la hauteur à `lg` : bloc compte réduit à une ligne (nom + menu « Voir le site / Se déconnecter » dans un `<details>` ou dans le header, à côté de la recherche) ; `lg:min-h-[32px] lg:py-1` pour les liens (l. 68) ; `lg:mt-2` entre groupes (l. 52). Objectif : tout le menu visible à 900 px de haut.
  3. Garder le fondu seulement s'il reste du contenu en dessous (sinon il fait croire à un élément désactivé, comme « Quiz » en gris).

**P1-3. Les listes déroulantes du formulaire n'ont ni chevron ni fond blanc.**

- Captures : `public-membership-375` (« Tranche d'âge », « Situation » : fond sable, pas de chevron, on dirait des champs désactivés), `admin-admin_books_monthly-1440` (« Rencontre associée »), `admin-admin_scrabble_records-1440` (« Tournoi »), `admin-admin_points-1440`.
- Cause, vérifiée : dans `src/components/ui/field.tsx` (composant `Select`, l. 33-40), la classe `bg-[url('data:image/svg+xml;utf8,<svg …>')]` contient des espaces. Tailwind ne génère aucune règle pour elle : on ne trouve pas de `svg+xml` dans la CSS de `.next/static`. En plus, `tailwind-merge` la prend pour une couleur de fond et **supprime `bg-blanc`** de `base` (testé : `twMerge("bg-blanc px-4", "bg-[url(…)]")` renvoie la chaîne sans `bg-blanc`). Le `<select>` est donc transparent et sans flèche. Or c'est le formulaire d'adhésion, le plus important du site.
- Correction : sortir le chevron de Tailwind. Ajouter dans `globals.css` une classe `.champ-select { background-color: var(--color-blanc); background-image: url("data:image/svg+xml,…"); background-repeat: no-repeat; background-position: right 14px center; background-size: 20px; }`, et dans `Select` remplacer les trois classes `bg-[…]` par `champ-select appearance-none pr-11`. Autre solution : envelopper le `<select>` dans un `div relative` avec un `<ChevronDown>` Lucide en `pointer-events-none absolute right-3.5`. Ajouter un test unitaire qui vérifie que `cn(base, …)` garde `bg-blanc`.

**P1-4. « 16 h » coupé en fin de ligne (« à partir de 16 » / « h »).**

- Capture : `public-accueil-375`, bloc « Le lancement », à côté du grand « 26 ».
- Cause : `formatTime` (`src/lib/dates.ts`, l. 39-44) renvoie `` `${hour} h` `` avec une espace ordinaire. Le défaut touche tous les horaires du site.
- Correction : `` `${hour} h` `` et `` `${hour} h ${minute}` ``. Ajouter un test dans le fichier de test des dates.

**P1-5. Badges en pile de cartes à bordure pointillée (Récompenses).**

- Capture : `membre-member_rewards-375`, section « Mes badges ».
- Problème : sept cartes identiques, bordées, empilées, avec un titre gris. C'est exactement ce que proscrivent le §7.3 et la DA (« filets plutôt que boîtes », « la tuile sert de rang, de numéro »). Le badge, objet le plus « identitaire » de l'espace membre, est le moins travaillé.
- Correction (`src/app/member/rewards/page.tsx`, l. 77-117) : remplacer la grille de cartes par une liste à filets (`border-t border-trait`, sans `rounded-[14px]` ni `border-dashed`). Chaque badge devient une ligne : une `LetterTile` de 48 px (`src/components/shared/letter-tile.tsx`) à gauche, avec l'initiale du badge (« M » pour Maître des lettres…), pleine terracotta si le badge est obtenu, ton sable et lettre grise s'il ne l'est pas ; au centre, le nom en Young Serif et la description ; à droite, « 0/1 » en chiffres tabulaires, avec la barre de progression sous la description. Les badges obtenus d'abord, avec leur date. Sur desktop, deux colonnes de lignes, pas de cartes.

**P1-6. Pas de bandeau « Données de démonstration » dans l'espace membre ni dans l'admin.**

- Captures : toutes les `membre-*` et `admin-*`. Le bandeau n'est monté que dans `src/app/(public)/layout.tsx` (l. 14).
- Problème : l'espace membre montre des données de démonstration (classement « Absa D. », quiz, tournoi du 6 mars 2027 déjà « terminé »), sans le bandeau que le §5 de CLAUDE.md, non négociable, demande « tant qu'il en existe ». Rien dans `docs/DECISIONS.md` ne limite le bandeau au site public.
- Correction : monter `<DemoBanner />` au-dessus de `<SiteHeader />` dans `src/app/member/layout.tsx`, et en haut de la colonne de contenu dans `src/app/admin/layout.tsx` (ou dans `admin-chrome.tsx`, au-dessus du header collant). **À confirmer avec le porteur du projet** si l'omission était voulue ; dans ce cas, la noter dans DECISIONS.md.

**P1-7. Journal : codes techniques bruts.**

- Capture : `admin-admin_audit-1440` (bas de page) : `points.awarded`, `quiz.published`, `member.card_revoked`, colonne « Concerne » à `PointTransaction` ou `Quiz`.
- Cause, vérifiée : la table des libellés (`src/features/settings/queries.ts`, l. 5-31) ne couvre pas les actions ajoutées depuis la phase 3 : `attendance.scanned` (la table contient `attendance.recorded`, qui n'est jamais émise), `badge.awarded`, `member.card_revoked`, `points.awarded`, `points.granted`, `points.reversed`, `points.rule_updated`, `quiz.archived`, `quiz.closed`, `quiz.published`, `quiz.unpublished`, `scrabble.record_deleted`, `scrabble.record_saved`, `scrabble.results_invalidated`, `scrabble.results_published`, `scrabble.results_validated`, `scrabble.scores_saved`, `scrabble.status_changed`. Même lacune dans `entityLabels` (l. 34).
- Correction : compléter les deux tables (par exemple « Présence scannée », « Badge attribué », « Carte de membre remplacée », « Points attribués », « Points accordés par un responsable », « Points corrigés », « Barème modifié », « Quiz publié / dépublié / fermé / archivé », « Record ajouté / supprimé », « Résultats validés / dévalidés / publiés », « Scores saisis », « Statut du tournoi modifié » ; entités « Points », « Quiz », « Tournoi », « Record »). Ajouter un test qui compare la liste des `action: "…"` émises dans `src/` (ou une constante partagée) aux clés de la table, pour que l'oubli ne se reproduise pas. Prévoir aussi un repli lisible (« Action : points.awarded » en gris) plutôt que le code seul.

### P2 — souhaitable

**P2-1. Espace membre : le pied de page public complet suit chaque écran.**

- Captures : toutes les `membre-*-375` (entre 600 et 800 px d'indigo sous un écran d'appli).
- Correction : dans l'espace membre, sous 1024 px, un pied de page réduit (slogan sur une ligne, « Charte · Confidentialité · © ») : prop `variant="compact"` sur `SiteFooter` (`src/components/layout/site-footer.tsx`), passée depuis `src/app/member/layout.tsx`. Le bouton « Mon espace » du header est aussi redondant quand on y est déjà : afficher « Se déconnecter » ou rien (`header-account.tsx`).

**P2-2. Filtres des tableaux d'admin en `<select>` natifs.**

- Captures : toutes les listes admin, surtout `admin-admin_memberships-375`.
- Problème : flèche native de Chrome et rendu système, à côté de champs de recherche habillés ; sur mobile, deux listes de largeurs différentes en escalier, avec le compteur « 2 sur 5 » accroché à la seconde.
- Correction (`src/components/admin/data-table.tsx`, l. 177-193) : réutiliser le `Select` corrigé (P1-3) avec `h-10` ; sous 768 px, mettre les filtres en grille `grid grid-cols-2 gap-2` en pleine largeur, et le compteur sur sa propre ligne.

**P2-3. Formats de date et d'heure incohérents.**

- Le site écrit « 16 h » et « 6 mars », mais aussi « 06/03/2027 » (records, public et admin : `formatShortDate`) et « 15 févr. 2027, 18:00 » (quiz membre, `formatDateTime`).
- Correction : côté public et membre, `formatDate` au lieu de `formatShortDate` (`src/app/(public)/scrabble/page.tsx` l. 206) ; `formatDateTime` doit construire l'heure avec `formatTime` (`src/lib/dates.ts`). L'admin peut garder le format numérique dans les tableaux.

**P2-4. Jargon interne visible : « Barème proposé en phase 4, à valider par le comité. »**

- Capture : `admin-admin_points-1440`, règle « Terminer un quiz en ligne ».
- Correction : `prisma/seed.ts` l. 72 : « Barème proposé, à valider par le comité. » (et mettre à jour la ligne en base par l'`upsert`).

**P2-5. Journal : 200 lignes sans recherche, filtre ni regroupement.**

- Capture : `admin-admin_audit-1440` (9 358 px de haut).
- Correction : passer la page sur le `DataTable` partagé (recherche + filtres « Action » et « Par », pagination déjà disponible), comme les autres listes ; ou au minimum grouper par jour avec un intertitre de date.

**P2-6. Bibliothèque mobile : les filtres prennent tout le premier écran.**

- Capture : `public-library-375` (recherche, catégorie, auteur, bouton : environ 360 px avant le premier livre).
- Correction : sous 768 px, garder le seul champ « Titre ou auteur » et un bouton « Filtres » qui ouvre la `BottomSheet` existante (`src/components/shared/bottom-sheet.tsx`) avec Catégorie et Auteur ; le compteur « 8 livres » à côté du bouton.

**P2-7. Fiche livre : étiquettes empilées sans hiérarchie.**

- Capture : `public-library_une-si-longue-lettre-375` : surtitre « Littérature sénégalaise », pastille indigo « Livre du mois », puis, à la ligne, pastille sable « Coup de cœur du club ».
- Correction : une seule ligne de métadonnées en surtitre (« Littérature sénégalaise · Coup de cœur ») et la seule pastille « Livre du mois » ; le cartel « Livre du mois · Novembre » plus bas le dit déjà.

**P2-8. Agenda public sans filtre par activité.**

- Capture : `public-events-375`. Les Archives en ont (pastilles « Toutes les activités »…), l'Agenda non, alors que le §1 de CLAUDE.md prévoit des filtres par activité.
- Correction : reprendre la rangée de pastilles des Archives (même composant) au-dessus des mois, dans `src/app/(public)/events/page.tsx`, avec un paramètre `?type=`.

**P2-9. Adhésion : bloc des montants à l'étroit.**

- Capture : `public-membership-375` : « CARTE DE / MEMBRE » sur deux lignes, sous-texte sur trois lignes, à côté de « 1 000 F CFA » en grand.
- Correction : sous 640 px, empiler libellé puis montant (comme sur À propos, qui est réussi) au lieu de deux colonnes ; ou mettre le montant au-dessus du libellé.

**P2-10.** Même cause que P2-3 (« 06/03/2027 » sur la page Scrabble, « 18:00 » sur les quiz) : à corriger dans le même geste.

**P2-11. Liens « retour » de trois styles différents.**

- « ← Agenda » et « ← Bibliothèque » (indigo gras, sans soulignement), « ← Tous les tournois » (terracotta souligné), « Retour au tournoi » en admin mobile (terracotta souligné, sans flèche).
- Correction : un seul composant `BackLink` (le style indigo gras), utilisé dans `src/app/(public)/scrabble/[slug]/page.tsx` et dans la page des manches admin.

**P2-12. Fiche rencontre : deux libellés pour la même action.**

- Capture : `public-events_lancement-de-l-agora-375` : bouton collant « S'inscrire », bouton du formulaire « Réserver ma place ».
- Correction : le même verbe partout (« Réserver ma place », plus concret) dans `src/features/events/components/sticky-cta.tsx`.

**P2-13. Profil : « Statut : Aucune adhésion » pour un membre qui a un numéro et une carte.**

- Capture : `membre-member_profile-375`. C'est sans doute l'utilisateur de test (compte créé sans ligne `Membership`), mais le libellé inquiète.
- Correction : à vérifier avec un vrai membre. Si le cas peut exister en production, écrire « Adhésion à enregistrer par un responsable » plutôt que « Aucune adhésion ».

**P2-14. Tableau de bord : chiffres clés mal alignés.**

- Capture : `admin-admin-1440` : dans les cartes 4 et 5 (un libellé sur une ligne, pas de sous-titre), le chiffre n'est pas à la même hauteur que dans les cartes 1 à 3.
- Correction (`src/app/admin/page.tsx`, autour de la l. 22) : `flex flex-col` avec le chiffre en haut et le bloc de libellés en `mt-auto`, ou une hauteur réservée pour le sous-titre. Au passage, retirer `shadow-posee` des cartes blanches : la DA réserve cette ombre aux couvertures et aux tuiles.

**P2-15. Liste des livres en admin sans vignette.**

- Capture : `admin-admin_books-1440`. Pour un catalogue, une vignette de 32 × 48 px (couverture téléversée ou `GeneratedCover` réduite) devant le titre aide beaucoup à s'y retrouver.

**P2-16. Fiche tournoi admin : « Archiver » ressemble à un onglet, « Dévalider pour corriger » à un titre.**

- Capture : `admin-admin_scrabble_<id>-1440`.
- Correction : « Archiver » en bouton `contour` taille `sm` ; « Dévalider pour corriger » en bouton `contour` aligné à gauche dans la carte « Résultats ».

**P2-17. Titre de barre « Fiche » dans l'admin mobile.**

- Capture : `admin-admin_scrabble_…_rounds_…-375` : la barre du haut affiche « Fiche » au lieu de « Manche 1 ».
- Cause : repli `adminBreadcrumbLabels[segment] ?? "Fiche"` (`admin-chrome.tsx` l. 97) pour les segments d'identifiant ; il manque aussi `rounds` et `records` (ce dernier est bien affiché, à vérifier).
- Correction : permettre à la page de fournir son libellé (prop ou `<title>` lu), ou au minimum « Tournoi » / « Manche » selon le segment parent.

**P2-18. Espaces insécables manquantes dans des textes d'admin.**

- `admin-admin_committee-1440` : « nécessaire / : rôle » (`src/app/admin/committee/page.tsx` l. 16-17 : espace ordinaire avant « : »).
- `admin-admin_scrabble_records-1440` : « « / OXYDANTS » » (`src/features/scrabble/components/records-editor.tsx` l. 79 : espaces ordinaires dans les guillemets).
- Correction : `&nbsp;` (ou ` `) avant « : » et à l'intérieur des « ». Dans la même page des records, mettre « Supprimer » en couleur `erreur`, comme « Retirer » ailleurs.

### P3 — plus tard

- **Accueil / À propos** : dans « Ce que l'on règle, et quand », mettre les montants avant les boutons (on lit le prix, puis on agit).
- **Activités** : la tuile « L » de l'en-tête et celle de « 1/5 Rendez-vous lecture » se suivent ; choisir une autre initiale pour l'en-tête (« A₁ », comme À propos, ou rien).
- **Archives** : la rangée de pastilles qui défile horizontalement est coupée net au bord ; ajouter un léger fondu à droite (`mask-image`) pour signaler le défilement.
- **Critiques des membres** (fiche livre, archives) : les apostrophes droites saisies par les membres (« qu'il ») pourraient être converties en ’ à l'affichage.
- **Confidentialité** : « adresse e- / mail » coupé au trait d'union : utiliser le trait d'union insécable (U+2011) dans « e‑mail » sur cette page.
- **Connexion** : le §7.6 prévoit le logo vertical (`logo-vertical.svg`) sur la page de connexion ; aujourd'hui, symbole + « L'Agora » en ligne.
- **Charte** : « Version 19 » vient des enregistrements des tests e2e ; remettre le compteur à 1 sur la base de livraison.
- **Montants en petit corps** (« 1 000 F CFA » à 14 px, accueil membre) : l'espace fine insécable (U+202F) ne se voit presque plus et on lit « 1000 ». Garder U+202F pour les grands chiffres et passer à U+00A0 sous 16 px, ou accepter.
- **Espace membre, Scrabble** : « Aucun tournoi publié ce mois-ci » puis « Le classement du mois s'ouvre avec les premiers résultats publiés » disent la même chose ; garder une phrase. Les états vides de cette page sont en texte seul, alors que Lectures, Rencontres et Notifications ont l'hémicycle.
- **Noms saisis en minuscules** (« arete sagna », « arete S. ») : capitaliser l'initiale à l'affichage des classements et des listes.
- **Tableau de bord admin** : « Dernières actions sensibles » sur deux colonnes, lues ligne à ligne : l'ordre chronologique se perd. Une seule colonne, ou une colonne par jour.
- **Points et badges (admin)** : colonne gauche presque vide face au long barème ; mettre le barème à gauche (contenu principal) et la recherche d'un membre à droite, en panneau collant.
- **CTA collant de la fiche rencontre** : `inset-x-4` (16 px) alors que les marges de page sont de 20 px ; `inset-x-5` pour l'aligner (`sticky-cta.tsx` l. 27).
- **« Choisir... »** (formulaire d'adhésion) : points de suspension typographiques « Choisir… ».
- **Classement admin du tournoi** : « 3 (1 f.) » est cryptique ; « 3, dont 1 forfait » ou une infobulle.
- **Rayons** : `rounded-[14px]` (récompenses, accueil membre) n'est pas dans l'échelle de la DA (4 / 10 / 16 px).

## 4. Points forts à préserver

- Le système d'en-tête de page (tuile-initiale + arc rogné en haut à droite + surtitre + titre serif) donne une signature immédiate à chaque page publique sans répéter la même composition.
- La page Activités, l'article et le classement du tournoi sont au niveau des références (The New Yorker, Medium).
- Les états vides à hémicycle (membre, admin) : sobres, utiles, avec une action réelle.
- L'admin a une vraie personnalité : titres en serif, tableaux à filets, gros montants en serif, affiche QR soignée. Ce n'est pas un dashboard générique.
- L'honnêteté du produit est visible : « Assistant non connecté », « Lieu à confirmer », « Date provisoire », « Version provisoire ».

## 4. Corrections faites (session principale, 20/11/2026)

Vérifiées sur une nouvelle série de captures prises avec `prefers-reduced-motion` (les blocs qui
apparaissent au défilement sont alors visibles).

| Défaut                        | Correction                                                                                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1-1 Captures incomplètes     | Nouvelle série sans animation : l'accueil, À propos, Bibliothèque, Agenda et Actualités s'affichent en entier. L'écran de scan n'a été recapturé qu'à l'état vide (aucune rencontre du jour en démonstration). |
| P1-2 Barre latérale admin     | Rubriques plus compactes, rubrique courante ramenée dans la vue à chaque navigation (`admin-chrome.tsx`)                                                                                                       |
| P1-3 Listes déroulantes       | Classe `champ-select` (`globals.css`) : fond blanc et chevron indigo. Cause : Tailwind générait aussi les classes citées dans `docs/` ; le dossier est désormais exclu des sources (`@source not`)             |
| P1-4 « 16 h » coupé           | Espaces insécables dans `formatTime`                                                                                                                                                                           |
| P1-5 Badges                   | Refaits en listes à filets (« Obtenus », « À obtenir ») avec une tuile-initiale par badge                                                                                                                      |
| P1-6 Bandeau de démonstration | Ajouté à l'espace membre et à l'administration                                                                                                                                                                 |
| P1-7 Journal                  | Libellés de toutes les actions (table typée sur `AuditAction` : une action sans libellé ne compile pas) et des objets                                                                                          |
| P2-3 / P2-10 Dates            | `formatDateTime` écrit l'heure à la française (« 15 févr. 2027, 18 h ») ; date du record en toutes lettres                                                                                                     |
| P2-4 Jargon                   | « Barème proposé, à valider par le comité » (seed et base)                                                                                                                                                     |
| P2-11 Liens retour            | Style unique (indigo gras, flèche) sur la fiche d'un tournoi                                                                                                                                                   |
| P2-12 Libellés d'inscription  | Bouton collant : « Je m’inscris » (membre), « Réserver ma place » (visiteur)                                                                                                                                   |
| P2-16 Fiche tournoi           | « Archiver » et « Dévalider pour corriger » en boutons à contour                                                                                                                                               |

**Restent à faire** (souhaitables, non bloquants) : P2-1 pied de page compact dans l'espace
membre, P2-2 filtres d'administration habillés, P2-5 journal sous forme de tableau filtrable,
P2-6 filtres de la bibliothèque en panneau sur mobile, P2-7 étiquettes de la fiche livre, P2-8
filtre par activité sur l'Agenda, P2-9 bloc des montants de l'adhésion, P2-13 libellé « Aucune
adhésion », P2-14 alignement des chiffres du tableau de bord, P2-15 vignettes des livres en
administration, P2-17, P2-18 et les P3.

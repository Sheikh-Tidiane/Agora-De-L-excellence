# RECETTE.md — Critères de recette du MVP (cahier des charges, section 13)

> Vérification du 13 novembre 2026, sur un **build de production** servi en local (port 3210),
> PostgreSQL et Mailpit dans Docker, données de démonstration du seed.
> Chaque critère est jugé sur ce qui a été **exécuté**, pas sur la lecture du code.
> Navigateur : Edge, piloté par Playwright ; « mobile » = émulation Pixel 7, « desktop » = 1440 × 900.

## Résultat

| #   | Critère                                                                                       | Résultat                                             |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Un visiteur peut consulter les informations essentielles du club sur mobile et ordinateur     | **Vérifié**                                          |
| 2   | Une personne peut soumettre une demande d'adhésion et recevoir une confirmation               | **Vérifié**                                          |
| 3   | Un responsable peut consulter et traiter les demandes d'adhésion                              | **Vérifié**                                          |
| 4   | Un administrateur peut créer, modifier et publier un événement                                | **Vérifié**                                          |
| 5   | Un visiteur ou membre peut consulter les événements et s'y inscrire selon les règles          | **Vérifié**                                          |
| 6   | Un responsable peut ajouter et modifier une fiche de livre                                    | **Vérifié**                                          |
| 7   | Un administrateur peut publier une actualité                                                  | **Vérifié**                                          |
| 8   | Les accès aux espaces privés sont protégés et les rôles sont effectivement appliqués          | **Vérifié** (réserve levée le 14/11)                 |
| 9   | Les erreurs de formulaire sont explicites et les données invalides sont rejetées côté serveur | **Vérifié** (réserve levée le 14/11)                 |
| 10  | Les pages principales sont utilisables sur smartphone                                         | **Vérifié en émulation** ; pas sur un vrai téléphone |
| 11  | Les sauvegardes et la procédure de restauration sont documentées                              | **Satisfait en local** ; à refaire en ligne          |
| 12  | Les fondateurs ont testé les parcours principaux et validé le contenu avant publication       | **En attente** : c'est le point de validation        |

Onze critères satisfaits (le n° 11 en local seulement), un qui dépend des fondateurs. Mise à jour du 14 novembre 2026 : réserves des critères 8 et 9 levées, critère 11 traité.

## Détail, critère par critère

### 1. Informations essentielles, sur mobile et ordinateur — vérifié

- `node scripts/visite.mjs` : 27 adresses publiques ouvertes à 375 px puis 1440 px. Toutes s'affichent, sans débordement horizontal ni erreur d'exécution.
- `e2e/contenus.spec.ts` (mobile et desktop) : l'accueil porte le slogan, le lancement, les trois dimensions et les cinq activités ; `/about`, `/activities`, `/charte` et `/archives` disent ce que dit `CONTENUS-CLUB.md`.
- `e2e/phase3-pages.spec.ts` (mobile et desktop) : bibliothèque, actualités, contact, confidentialité.
- `e2e/accueil.spec.ts` : aucun lien de l'accueil n'est mort ; le menu plein écran s'ouvre, se ferme au clavier et navigue.

Limite : les coordonnées, le lieu et les réseaux du club ne sont pas affichés, le comité ne les ayant pas communiqués.

### 2. Demande d'adhésion et confirmation — vérifié

- `e2e/contenus.spec.ts` et `e2e/recette.spec.ts` : formulaire rempli et envoyé, écran « Demande envoyée » avec l'adresse du demandeur.
- L'accusé de réception part réellement par e-mail (envoi SMTP vers Mailpit).

Réserve : l'arrivée de l'accusé de réception dans la boîte n'est contrôlée par aucun parcours automatique ; seul l'envoi sans erreur l'est. Les e-mails d'activation, de refus et de confirmation d'inscription, eux, sont lus dans Mailpit par les parcours.

### 3. Traiter les demandes d'adhésion — vérifié

`e2e/recette.spec.ts`, parcours « administration » :

- **Refus** avec un mot pour le demandeur : le message reçu dans Mailpit contient ce mot.
- **Validation** : le compte est créé, le membre reçoit son lien, choisit son mot de passe, entre dans `/member` et y voit son numéro `AE-AAAA-NNNN`.
- Les deux décisions figurent au journal (« Adhésion refusée », « Adhésion validée »).

### 4. Créer, modifier et publier un événement — vérifié

`e2e/recette.spec.ts`, parcours « événement » : brouillon créé (absent de l'agenda public), titre modifié et enregistré, publication, puis l'événement apparaît dans `/events` sous son titre modifié. Le parcours « administration » ajoute la clôture des inscriptions, constatée sur la page publique.

### 5. Consulter les événements et s'y inscrire selon les règles — vérifié

`e2e/recette.spec.ts`, parcours « événement », côté visiteur **sur téléphone** :

- le visiteur trouve la rencontre dans l'agenda et ouvre sa page ;
- inscription invité (nom + e-mail), **confirmation par le lien reçu par e-mail** ;
- **capacité** : avec une seule place, un second visiteur qui envoie le formulaire au même moment reçoit « Cette rencontre est complète. » ; la page indique ensuite que toutes les places sont prises ;
- **annulation** par le même lien : la place redevient disponible pour le second visiteur.

Inscription d'un membre connecté et lien de visio réservé aux inscrits : `e2e/contenus.spec.ts`.

Ajouté le 14/11 (`e2e/recette.spec.ts`, « espace membre ») : un membre, sur téléphone, annule une inscription depuis `/member` (la place se libère, l'administration voit l'annulation) ; pour une autre rencontre dont le délai est dépassé pendant que sa page est ouverte, le bouton encore affiché est **refusé par le serveur** (« Le délai d'annulation est dépassé »), puis disparaît au rechargement au profit d'une explication.

### 6. Ajouter et modifier une fiche de livre — vérifié

`e2e/recette.spec.ts` : livre ajouté, retrouvé dans la liste, titre et mot du club modifiés, fiche publique à jour. `e2e/phase3-pages.spec.ts` : création avec une couverture téléversée, visible sur la fiche publique.

### 7. Publier une actualité — vérifié

`e2e/phase3-pages.spec.ts` : article créé en brouillon, publié, lu en ligne avec sa mise en forme, présent dans `/news`, puis dépublié et absent de `/news`.

Non exécuté : la publication programmée à une date future (règle testée unitairement).

### 8. Espaces privés protégés, rôles appliqués — vérifié

- Sans session, `/member` et `/admin` renvoient à la connexion (`e2e/auth.spec.ts`, `scripts/visite.mjs`) ; les points d'accès `/api/admin/…` répondent 401.
- Un **membre** ne peut pas ouvrir l'administration (`e2e/auth.spec.ts`).
- Un **responsable bibliothèque** (`e2e/recette.spec.ts`) : son menu ne montre que la bibliothèque ; il ouvre `/admin/books` ; les huit autres rubriques essayées le renvoient à « Accès refusé » ; l'export CSV et le téléversement d'une photo du comité répondent 403 ; sans le rôle « membre », il n'a pas d'espace membre.
- Un compte **suspendu** perd l'accès à la requête suivante : le membre connecté est renvoyé à la connexion.
- Connexion bloquée après cinq tentatives sur un même compte (`e2e/auth.spec.ts`).

Réserve levée le 14/11 :

- **Tests unitaires** (`src/features/actions-security.test.ts`) : chacune des 36 Server Actions protégées est appelée sans session, avec un compte suspendu et avec chacun des six rôles ; un rôle sans la permission reçoit `FORBIDDEN` **sans aucune lecture ni écriture métier**. Le vrai `requirePermission` s'exécute, seule la base est simulée. Un test échoue si une action exportée n'est pas couverte. Retirer un `requirePermission` fait échouer cinq tests (vérifié, puis remis).
- **Navigateur** (`e2e/requetes-forgees.spec.ts`) : la requête réelle d'une action d'administration, captée chez un super-administrateur, rejouée telle quelle avec la session d'un responsable bibliothèque → `FORBIDDEN` ; sans session → refusée ; les paramètres n'ont pas changé.
- **Route Handlers** (`src/app/route-handlers-security.test.ts`) : 401 sans session, 403 sans la permission, sur les trois.

Reste : les permissions testées viennent du catalogue du code ; en service, ce sont les tables de la base qui font foi (alimentées par le seed).

### 9. Erreurs explicites, données invalides rejetées côté serveur — vérifié

- Erreurs sous le champ concerné : formulaire d'adhésion vide, mineur sans parent ou tuteur, téléphone invalide, charte non acceptée ; inscription invité sans nom ou avec une adresse invalide ; contact envoyé à vide ; mots de passe trop courts ou différents.
- Refus décidés **par le serveur**, sur des saisies que le navigateur accepte : seconde demande d'adhésion pour la même adresse ; inscription à une rencontre devenue complète ; fichier qui n'est pas une image refusé au téléversement ; identifiants incorrects ; lien d'activation déjà utilisé.

Réserve levée le 14/11 :

- **Navigateur** (`e2e/requetes-forgees.spec.ts`, mobile et desktop) : le formulaire d'adhésion est rempli correctement, puis la requête est modifiée **après** la validation du navigateur (adresse invalide, consentement ou charte retirés, tranche d'âge inconnue, mineur sans tuteur, prénom de 10 000 caractères) : le serveur refuse chaque fois avec un message explicite, rien n'est enregistré. Même chose pour l'inscription d'un invité (rencontre inconnue, nom vidé) et pour une action d'administration (durée d'adhésion négative → `VALIDATION`).
- **Tests unitaires** (`src/features/actions-validation.test.ts`, 527 cas) : saisies mal formées envoyées directement aux 45 actions qui prennent une entrée (champ manquant, mauvais type, chaîne trop longue, identifiant vide ou objet, valeur inconnue, tableau géant, `__proto__`) → `VALIDATION`, aucun accès métier.
- **Défauts trouvés et corrigés à cette occasion** : un montant de cotisation effacé s'enregistrait comme 0 (gratuit) ; un `id` lu hors du schéma ; une heure de fin illisible ignorée ; des rôles en double provoquant une erreur interne ; un retour à la ligne accepté dans l'objet du message de contact (en-tête d'e-mail) ; le téléversement répondait 422 au lieu de 401 sans session, et 500 sur un corps qui n'est pas un formulaire. Et, côté interface : une erreur du serveur portant sur un champ absent de l'écran (le tuteur, quand le formulaire croit l'adhérent majeur) laissait le formulaire muet ; elle s'affiche maintenant en tête du formulaire.

### 10. Pages principales utilisables sur smartphone — vérifié en émulation

- Les 27 pages publiques, `/member` et les 19 pages d'administration ouvertes à 375 px : aucune ne déborde.
- Tous les parcours publics tournent aussi dans le projet « mobile » de Playwright ; l'inscription d'un visiteur est faite depuis un téléphone émulé.
- Lighthouse mobile : accessibilité 100 sur les cinq pages mesurées ; performance entre 84 et 95 en médiane.
- Hors ligne : la page de repli s'affiche et la navigation reprend au retour du réseau (`e2e/seo-pwa.spec.ts`).

**Non fait : aucun essai sur un vrai téléphone**, ni sur une vraie connexion 4G. L'installation sur l'écran d'accueil n'a pas été essayée.

### 11. Sauvegardes et restauration documentées — satisfait en local

`docs/SAUVEGARDE.md` (14/11) : ce qu'il faut sauvegarder, `scripts/backup.sh` (sauvegarde vérifiée lisible), `scripts/restore-check.sh` (restauration dans une base temporaire et comparaison table par table avec la base en service), procédure de restauration complète. Exécuté en local : 38 tables, 806 lignes restaurées à l'identique ; une ligne ajoutée après la sauvegarde est bien détectée. **Non fait** : la restauration complète (seule la restauration dans une base temporaire a tourné), l'archive des images (aucune image au moment du test), et tout ce qui relève de la production (sauvegarde de nuit, copie hors du serveur, alerte, restauration sur un serveur neuf). À refaire en ligne avant d'ouvrir les adhésions ; le site ne doit pas recevoir de vraies données avant.

### 12. Test par les fondateurs — en attente

C'est l'objet du point de validation qui clôt la phase 3.

## Ce que la recette n'a pas couvert

- **Archivage (anonymisation) d'un membre** : jamais exécuté. L'action est irréversible et le parcours ne saurait pas nettoyer derrière lui.
- Catégories, auteurs et livre du mois : pages ouvertes et enregistrements faits dans `e2e/phase3-pages.spec.ts`, suppression non essayée.
- Envoi des e-mails par Resend (pas de clé) : seul SMTP vers Mailpit a tourné.
- `pnpm create-admin` au clavier dans un vrai terminal.
- Le site n'a tourné qu'en local : rien n'est déployé, `APP_URL` vaut `http://localhost:3000`.

## Rejouer la recette

```
docker compose up -d
pnpm db:migrate && pnpm db:seed
pnpm test:e2e                     # tous les parcours, sur un build de production
node scripts/visite.mjs           # visite de toutes les pages (serveur sur le port 3000)
```

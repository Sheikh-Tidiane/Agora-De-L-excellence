# REGLES-METIER.md — Règles métier par défaut

> Valeurs de départ, validées globalement par le porteur du projet le 12/11/2026.
> Toutes sont modifiables : la colonne « Où » dit à quel endroit.
> Colonne « État » : **appliquée** = codée et testée ; **schéma** = prévue par la base, logique à écrire dans la phase indiquée.

## Comptes et connexion

| Règle                           | Valeur                                                                           | Où                        | État      |
| ------------------------------- | -------------------------------------------------------------------------------- | ------------------------- | --------- |
| Identifiant de connexion (n° 4) | E-mail, unique, en minuscules. Téléphone facultatif, jamais identifiant          | Schéma                    | Appliquée |
| Inscription publique            | Aucune. Un compte naît de la validation d'une adhésion ou de `pnpm create-admin` | `src/lib/auth.ts`         | Appliquée |
| Lien d'activation               | 7 jours, usage unique ; un nouveau lien annule l'ancien                          | `src/config/auth.ts`      | Appliquée |
| Lien de réinitialisation        | 60 minutes, usage unique ; ferme toutes les sessions                             | `src/config/auth.ts`      | Appliquée |
| Mot de passe                    | 10 à 128 caractères                                                              | `src/config/auth.ts`      | Appliquée |
| Session                         | 30 jours, prolongée à chaque jour d'utilisation                                  | `src/config/auth.ts`      | Appliquée |
| Compte suspendu ou archivé      | Ne peut plus se connecter ; accès coupé à la requête suivante                    | `src/lib/permissions`     | Appliquée |
| Super-administrateur initial    | Créé par `pnpm create-admin`, jamais par le seed                                 | `scripts/create-admin.ts` | Appliquée |

## Limitation de débit

Fenêtre fixe, par action. Modifiable dans `src/lib/rate-limit.ts`.

| Action                                         | Limite                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| Connexion, par compte visé                     | 5 tentatives / 15 min (remise à zéro après une connexion réussie) |
| Connexion, par adresse IP                      | 20 / 15 min                                                       |
| Mot de passe oublié, par adresse e-mail        | 3 / heure                                                         |
| Mot de passe oublié, par adresse IP            | 10 / heure                                                        |
| Réinitialisation, activation, par adresse IP   | 10 / heure chacune                                                |
| Formulaires publics, par adresse IP            | 5 / heure (adhésion, contact, inscription d'un invité)            |
| Lien reçu par e-mail (confirmer, annuler)      | 30 / heure, par adresse IP                                        |
| Remplacement de sa carte de membre             | 3 / heure, par compte                                             |
| Scan des présences, par responsable            | 240 / 10 min                                                      |
| Recherche d'un inscrit (scan), par responsable | 120 / 10 min                                                      |
| Questions à l'assistant IA, par membre         | 5 / minute (en plus du quota quotidien, voir « Assistant IA »)    |

## Rôles et permissions (n° 24)

Rôles cumulables, moindre privilège. Source : `src/lib/permissions/catalog.ts`, puis la base.

| Rôle                      | Permissions                                                                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membre                    | Espace membre                                                                                                                                                             |
| Responsable communication | Administration ; articles ; quiz (phase 4)                                                                                                                                |
| Responsable bibliothèque  | Administration ; livres, auteurs, catégories, livre du mois ; validation des livres terminés ; modération des critiques                                                   |
| Responsable Scrabble      | Administration ; tournois ; saisie des scores ; validation et publication des résultats                                                                                   |
| Administrateur            | Administration ; articles ; bibliothèque ; adhésions ; membres ; événements ; présences ; points et barème ; badge manuel ; quiz ; exports ; paramètres ; journal d'audit |
| Super administrateur      | Tout, dont les comptes administratifs et les rôles                                                                                                                        |

À noter : l'administrateur ne saisit pas les scores (rôle Scrabble à lui ajouter si besoin) ; un responsable sans le rôle « Membre » n'a pas d'espace membre.

## Adhésion

| Règle                       | Valeur                                                                                                                      | Où                    | État                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| Parcours                    | Demande sans compte → validation par un administrateur → compte créé → e-mail d'activation                                  | —                     | Appliquée                                                           |
| Champs de la demande (n° 7) | Prénom, nom, e-mail, téléphone, tranche d'âge, statut, centres d'intérêt, motivation facultative, consentement obligatoire  | Schéma                | Appliquée                                                           |
| Mineurs (n° 8)              | Moins de 18 ans : nom et téléphone d'un parent ou tuteur obligatoires ; pas de photo de profil publique                     | Schéma                | Appliquée                                                           |
| Cotisation (n° 6)           | **Tranchée par le comité (novembre 2026)** : voir « Cotisations » ci-dessous. L'adhésion n'est plus gratuite                | —                     | Appliquée                                                           |
| Charte                      | Case « J’accepte la charte du club » obligatoire, lien vers `/charte` ; la version acceptée est enregistrée avec la demande | Schéma                | Appliquée                                                           |
| Montants affichés           | Carte et participation par séance affichées avant le formulaire d'adhésion, lues dans `Setting`                             | `Setting`             | Appliquée                                                           |
| Durée                       | 12 mois ; renouvellement validé par un responsable                                                                          | `src/config/rules.ts` | Appliquée                                                           |
| Numéro de membre            | Généré à la validation                                                                                                      | `User.memberNumber`   | Appliquée                                                           |
| Demande refusée (n° 28)     | Supprimée après 12 mois                                                                                                     | `src/config/rules.ts` | Codée (purge lancée à chaque validation), jamais exécutée ni testée |

## Cotisations

Source : `docs/CONTENUS-CLUB.md` (sections 7 et 9), décision du comité de pilotage, novembre 2026. Remplace le défaut « adhésion gratuite » du point n° 6. État : appliquée (parcours Playwright `e2e/contenus.spec.ts`).

| Règle                    | Valeur                                                                                                      | Où                     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------- |
| Carte de membre          | 1 000 F CFA, versés une fois à l'adhésion                                                                   | `Setting`              |
| Participation par séance | 100 F CFA par séance                                                                                        | `Setting`              |
| Montants                 | Réglages modifiables depuis l'admin, jamais écrits en dur                                                   | `Setting`              |
| Mode de paiement         | Espèces, sur place. Aucun paiement en ligne en V1 ; paiement mobile (Wave, Orange Money) possible plus tard | —                      |
| Paiement de la carte     | Enregistré par un responsable dans l'admin : montant, date, reçu par                                        | Admin, fiche du membre |
| Participation            | Case « payé » cochée par un responsable lors du pointage de présence à la séance                            | Admin, présences       |
| Suivi                    | Total encaissé par séance et par mois ; liste des membres dont la carte n'est pas réglée                    | Admin, encaissements   |
| Traçabilité              | Chaque enregistrement (et chaque annulation) passe dans `AuditLog`                                          | `lib/audit`            |

Précisions de mise en œuvre :

- Le pointage d'une séance (cases « présent » et « payé ») ouvre le jour de la rencontre, pour les inscriptions confirmées. Cocher « payé » pointe aussi la présence ; décocher « payé » annule l'encaissement.
- Un encaissement n'est jamais supprimé : il s'annule, avec un motif. Une seule carte active par membre et une seule participation active par inscription (index uniques en base).
- Le montant est copié du réglage au moment de l'encaissement : changer le réglage ne modifie pas le passé.
- Durée de la carte : le comité dit « versés une fois à l'adhésion ». La durée d'adhésion de 12 mois reste en place en interne mais n'est plus affichée au public, en attendant sa décision.
- Scan QR de présence (phase 4, partie B) : page `/admin/scan` (`attendance.record`), rencontres du jour publiées ou clôturées ; même règles que le pointage manuel. Un membre non inscrit est refusé (pas d'inscription sur place : les inscriptions ferment au début de la rencontre). Un second scan de la même carte ne change rien (« Déjà pointé à … ») ; il peut seulement ajouter la participation. Le scan ne retire jamais un encaissement.

## Rencontres

| Règle        | Valeur                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| Rythme       | Une rencontre en présentiel tous les quinze jours                                          |
| Durée        | Deux heures au maximum                                                                     |
| À distance   | Lien de visio facultatif par événement, visible des seuls membres inscrits                 |
| Jour, heure  | Non communiqués : non affichés                                                             |
| Lieu         | Non communiqué : non affiché (« à confirmer » pour le lancement uniquement)                |
| Compte rendu | Rédigé par un responsable sur un événement passé ; visible sur sa page et dans `/archives` |

## Activités et types d'événements

Les cinq activités de `CONTENUS-CLUB.md` remplacent la liste du cahier des charges (et le point n° 12 pour les types).

| Activité                 | Types d'événements (`EventType`)          |
| ------------------------ | ----------------------------------------- |
| Les Rendez-vous lecture  | `RENDEZ_VOUS_LECTURE`                     |
| Les Tournois de Scrabble | `INITIATION_SCRABBLE`, `TOURNOI_SCRABBLE` |
| Les Débats d’idées       | `DEBAT_IDEES` (avec l'Invité de l'Agora)  |
| Les Génies du soir       | `GENIES_DU_SOIR`                          |
| L’Agora Ciné             | `AGORA_CINE` (tous les trois mois)        |
| —                        | `LANCEMENT_AUTRE`                         |

Le libellé affiché vient d'une configuration, pas du code des pages.

## Événements

| Règle              | Valeur                                                                                                      | État      |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | --------- |
| Inscription (n° 2) | Membres connectés ; visiteurs (nom + e-mail, confirmation par lien) si l'événement est « ouvert au public » | Appliquée |
| Capacité           | Respectée en transaction ; `null` = sans limite                                                             | Appliquée |
| Annulation         | Jusqu'à 24 h avant, réglable par événement (`cancellationDeadlineHours`)                                    | Appliquée |

## Points et badges

Barème de départ du cahier des charges (§4.1), en table `PointRule`, modifiable par un administrateur. Le seed ne réécrit jamais une valeur déjà ajustée.

| Action                                   | Points | Déclencheur                                                                   |
| ---------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Participer à une séance de lecture       | 20     | Présence à un événement de type « lecture »                                   |
| Terminer un livre et renseigner sa fiche | 50     | Après validation par un responsable                                           |
| Participer à un débat                    | 15     | Présence à un événement de type « débat »                                     |
| Participer à un tournoi de Scrabble      | 20     | Présence à un événement de type « Scrabble »                                  |
| Gagner un tournoi (n° 13)                | 50     | 1er individuel, ou chaque membre de l'équipe gagnante ; ex æquo : 50 chacun   |
| Publier une critique validée             | 30     | Après validation par un modérateur                                            |
| Terminer un quiz en ligne (phase 4)      | 10     | Tentative finie, quel que soit le score. **Proposé, à valider par le comité** |

- Un type d'événement sans règle ne rapporte rien (n° 12).
- Un membre ne s'attribue jamais de points. Une transaction = une ligne ; jamais de modification ; une correction = ligne inverse motivée.
- Anti-doublon en base : même membre + même règle + même source = une seule ligne.
- Participant extérieur à un tournoi (n° 16) : ni points ni compte.

| Badge                         | Critère                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| Lecteur passionné             | 5 livres terminés (validés)                                                |
| Maître des lettres            | 1 victoire en tournoi                                                      |
| Esprit débatteur              | 10 débats                                                                  |
| Ambassadeur du savoir (n° 14) | Manuel : attribué par un administrateur, avec motif, tracé dans `AuditLog` |

État : **appliquée** (phase 4, partie B : `src/features/gamification/`, tests contre la base réelle).

Précisions de mise en œuvre (détail : `docs/DECISIONS.md`, section 11) :

- Présence pointée (scan ou case cochée) : règle du type d'événement, au membre inscrit ; présence décochée : ligne inverse « Présence décochée » ; recochée : nouvelle attribution. Jamais deux lignes actives pour une même source.
- Rien n'est attribué pour une règle inactive ou à 0 point, à un invité, à un compte sans numéro de membre, ni au responsable qui serait lui-même le bénéficiaire.
- Correction manuelle : motif obligatoire, une seule par ligne, jamais d'une correction, jamais sur ses propres points (`points.grant`).
- Ajustement manuel : de −1 000 à +1 000 points, non nul, motivé (`points.grant`).
- Barème : de 0 à 1 000 points par règle, activable ou non (`points.rules.manage`) ; une modification ne change pas le passé.
- Badges automatiques réévalués après chaque attribution ou correction, et quand un fait compte sans points ; **jamais retirés automatiquement**.
- Badge manuel : motif obligatoire, une fois par membre, jamais à soi-même (`badges.award`).
- Classements : membres actifs non retirés, totaux positifs seulement, mois calendaire de Dakar (une ligne compte au mois où elle est écrite, corrections comprises), égalités « 1, 1, 3 », prénom + initiale, top 10 + sa position.
- Tout passe dans `AuditLog`.

### Niveaux (phase 4)

Table `Level`, modifiable par un administrateur ; semée seulement si elle est vide. Le niveau d'un membre est le plus haut seuil atteint par son total de points (somme du grand livre, corrections comprises ; un total négatif compte comme zéro). Noms **proposés, à valider par le comité**.

| Niveau            | Seuil |
| ----------------- | ----- |
| Esprit curieux    | 0     |
| Plume en éveil    | 100   |
| Voix affirmée     | 300   |
| Pilier de l’Agora | 700   |
| Flamme de l’Agora | 1 500 |

## Quiz en ligne (phase 4)

État : couche serveur **appliquée** (partie C : `src/features/quizzes/`, tests contre la base réelle) ; pages à construire.

| Règle         | Valeur                                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Forme         | QCM, une seule bonne réponse par question (garanti en base)                                                     |
| Statuts       | Brouillon (invisible des membres) → publié (jouable entre l'ouverture et la fermeture) → clos (résultats seuls) |
| Participation | Une tentative par membre et par quiz (unicité en base)                                                          |
| Durée         | De 1 à 180 minutes, fixée par quiz ; chrono tenu par le serveur, sans dépasser la fermeture du quiz             |
| Score         | Nombre de bonnes réponses, calculé par le serveur ; une question passée compte comme fausse                     |
| Points        | Règle `quiz_completed` (ci-dessus) ; une seule fois par quiz et par membre                                      |
| Lien          | Rencontre « Génies du soir » liée, facultative                                                                  |
| Suppression   | Un quiz déjà joué ne se supprime pas : il se clôt                                                               |

Précisions de mise en œuvre (détail : `docs/DECISIONS.md`, section « Phase 4, partie C — quiz ») :

- Une question à la fois, la première sans réponse ; ni retour, ni saut, ni seconde réponse. Passer une question est possible (elle compte comme fausse).
- Tolérance réseau : une réponse arrivée jusqu'à **5 secondes** après la fin du chrono est acceptée ; au-delà, la tentative se termine avec les réponses déjà données.
- Fin : bouton « Terminer », dernière réponse, ou automatiquement à la lecture suivante une fois le temps écoulé ; l'heure de fin ne dépasse jamais l'échéance.
- Propositions mélangées pour chaque tentative (ordre stable pour le membre).
- Après la fin : score seul ; **le corrigé n'apparaît qu'une fois le quiz terminé pour tous** (clos ou fermeture passée).
- Après publication : seuls le titre, la consigne, la rencontre liée et la fermeture (dans le futur, et seulement tant qu'elle n'est pas passée : un quiz terminé ne se rouvre pas) se modifient ; un quiz publié que personne n'a joué peut repasser en brouillon. Clore termine les tentatives en cours. Archiver : seulement un quiz clos.
- Classement d'un quiz : score décroissant, puis durée croissante ; classement général : total des bonnes réponses. Membres actifs non retirés, prénom + initiale, top 10 + sa position.
- Notification in-app « Nouveau quiz » aux membres actifs à la première publication (pas d'e-mail).
- Limite de débit : 150 gestes de jeu par membre et par 10 minutes.

## Carte de membre (phase 4)

| Règle         | Valeur                                                                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| QR code       | Jeton opaque signé, sans donnée personnelle (ni nom, ni numéro, ni identifiant du compte)                                                    |
| Disponibilité | Compte actif seulement                                                                                                                       |
| Validité      | Pas d'expiration (la carte s'affiche hors ligne) ; refusée au scan si elle a été remplacée ou si le compte est suspendu, archivé ou inactivé |
| Remplacement  | Par le membre lui-même (3 fois par heure au plus) ou par un responsable avec un motif ; l'ancienne carte cesse aussitôt d'être acceptée      |
| Traçabilité   | Chaque remplacement passe dans `AuditLog`                                                                                                    |
| Secret        | Dérivé de `BETTER_AUTH_SECRET` : le changer invalide toutes les cartes affichées (elles se régénèrent à l'ouverture suivante)                |

## Scrabble

| Règle                       | Valeur                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Formats                     | Individuel ou équipes ; duplicate ou classique                                                                           |
| Initiation                  | Séances d'initiation avant les compétitions (type d'événement `INITIATION_SCRABBLE`)                                     |
| Classement mensuel          | En plus du classement par tournoi                                                                                        |
| Records                     | Table de records configurable. Les records à suivre ne sont pas encore définis par le comité : rien n'est affiché à vide |
| Récompense                  | Champ facultatif par tournoi. Non définie par le comité : non affichée tant qu'elle est vide                             |
| Classement par défaut       | Victoires, puis cumul des scores, puis différentiel. En duplicate : cumul des scores. Choisi par tournoi (`rankingRule`) |
| Forfait (n° 17)             | Défaite, score 0                                                                                                         |
| Appariements                | Saisis par le responsable (pas d'appariement automatique en V1)                                                          |
| Publication                 | Résultats visibles seulement après validation par le responsable Scrabble                                                |
| Tournoi ↔ événement (n° 15) | Lien facultatif ; l'inscription au tournoi vaut inscription à l'événement                                                |

État : **appliquée** pour la couche serveur (phase 4, partie C : `src/features/scrabble/`, tests contre la base réelle). Détail : `docs/DECISIONS.md`, section 13.

| Précision                    | Choix                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Partie nulle (classique)     | Une demi-victoire chacun                                                                                                               |
| Double forfait               | Deux défaites, 0 point chacun                                                                                                          |
| Égalité parfaite             | Même rang (1, 1, 3), sans autre départage                                                                                              |
| Joueur retiré                | Garde ses manches, classé après les joueurs non retirés, jamais vainqueur                                                              |
| Équipes                      | Somme des victoires, scores et différentiels des joueurs ; rang de l'équipe = rang figé de chacun de ses joueurs                       |
| Score                        | Entier de 0 à 2 000 ; un par joueur et par manche                                                                                      |
| Correction après validation  | Refusée : dévalider (motif) reprend les points de victoire, puis corriger, puis revalider                                              |
| Points de victoire           | `tournament_win` au 1er (ex æquo : chacun) ; rien à un extérieur ni au responsable qui valide sa propre victoire                       |
| Publication                  | Après validation ; notification et e-mail à chaque membre participant                                                                  |
| Classement mensuel           | Tournois comptés, publiés dans le mois : `classés − rang + 1` points par tournoi ; membres seulement, retrait des classements respecté |
| Noms publics                 | Membre : prénom + initiale (« Membre de l’Agora » s'il s'est retiré des classements) ; extérieur : nom saisi et club                   |
| Lien à une rencontre (n° 15) | Inscrire un membre au tournoi l'inscrit à la rencontre (confirmé, sans contrôle de capacité) ; l'inverse n'est pas fait                |
| Exemption (« bye »)          | Non modélisée : un score sans partie est refusé en classique. À trancher par le comité                                                 |

## Assistant IA « Le Compagnon des Lettres » (phase 5)

Couche serveur : `src/features/assistant/` et `src/lib/llm/` ; décisions détaillées dans `docs/DECISIONS.md` §14.

| Règle                      | Valeur                                                                                                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Qui                        | Comptes actifs ayant la permission `member.access` (`POST /api/assistant`). Pas d'exigence de numéro de membre en plus                                                                                                                                                                              |
| Sans clé d'API             | « Assistant non connecté » (HTTP 503, `code: "NOT_CONFIGURED"`) ; aucune réponse simulée                                                                                                                                                                                                            |
| Modes                      | Recommander des livres (catalogue du club d'abord), expliquer un mot, sujet de débat, quiz, questions de compréhension, structurer une critique (sans la rédiger), défi de vocabulaire                                                                                                              |
| Quota quotidien            | **20 questions par membre et par jour** (`ASSISTANT_DAILY_LIMIT`), jour de Dakar = jour UTC, remis à zéro à minuit                                                                                                                                                                                  |
| Question comptée           | Dès que le modèle commence à répondre (HTTP 200). Rendue si le fournisseur échoue ; comptée si le membre annule (même avant le premier mot), si la réponse est interrompue en cours de route, refusée ou coupée                                                                                     |
| Limite de débit            | 5 questions par minute et par membre, en plus du quota                                                                                                                                                                                                                                              |
| Taille d'une demande       | Question : 1 000 caractères au plus ; historique : 12 messages au plus (le dernier est une question) ; réponse renvoyée dans l'historique : 12 000 caractères au plus                                                                                                                               |
| Données envoyées au modèle | Le prompt système (règles, mode), pour les modes recommandation, compréhension, critique et quiz la liste des livres publiés (titre, auteurs, catégorie ; 150 livres au plus), et la conversation saisie par le membre. **Jamais** le nom, l'e-mail, le numéro de membre ni l'identifiant du compte |
| Conservation               | Aucune : la conversation reste dans le navigateur et disparaît quand on quitte la page. Seul un compteur de questions par jour est gardé en base (clé chiffrée par HMAC, sans identifiant en clair), supprimé le lendemain                                                                          |
| Réponses                   | Présentées comme des suggestions ; toute référence hors du catalogue du club porte « (hors du catalogue du club : à vérifier) »                                                                                                                                                                     |
| Hors mission               | Refus poli et retour à la lecture (consigne du prompt) ; un refus du modèle affiche un message en français                                                                                                                                                                                          |

## Contenus et confidentialité

| Règle                          | Valeur                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avis publics (n° 9)            | Critique validée **et** accord du membre (« publier sous mon prénom »)                                                                                                                                                                                                                                                                                                                                                                                                                |
| Classements de points (n° 10)  | Visibles des membres seulement, top 10 + sa position, retrait possible par membre                                                                                                                                                                                                                                                                                                                                                                                                     |
| Publication programmée (n° 20) | `publishedAt` futur : l'article n'apparaît qu'à cette date                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Suppression d'un utilisateur   | Archivage ou anonymisation, jamais de suppression physique s'il a un historique                                                                                                                                                                                                                                                                                                                                                                                                       |
| Données de démonstration       | Aucune depuis le 21/11/2026 : le seed ne crée que la référence et les contenus officiels ; les anciens exemples sont des contenus réels à corriger (docs/A-CORRIGER.md)                                                                                                                                                                                                                                                                                                               |
| Journal d'audit                | Création et activation de compte, liens envoyés, mot de passe changé, connexion refusée, suppression des données de démonstration. Depuis la phase 3 : rôles attribués et retirés, adhésions validées, refusées et renouvelées, encaissements, suspension, réactivation et archivage, statut d'un événement, inscription retirée, export CSV, paramètres. Depuis la phase 4 (partie B) : points attribués, ajustés et corrigés, barème, badges, présences scannées. Scores : partie C |

## Précisions de la phase 3

Règles appliquées et vérifiées par les parcours Playwright (`e2e/recette.spec.ts`, `e2e/contenus.spec.ts`), sauf mention contraire.

| Règle                      | Valeur                                                                                                                                  | Où                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Numéro de membre           | `AE-AAAA-NNNN`, la numérotation repart à 1 chaque année                                                                                 | `features/memberships/service.ts` |
| Demande en double          | Une adresse qui a déjà un compte, ou une demande en attente, est refusée avec un message explicite                                      | idem                              |
| Refus d'une demande        | Un mot facultatif du responsable est repris dans l'e-mail envoyé au demandeur                                                           | idem                              |
| Inscription d'un invité    | En attente jusqu'au clic sur le lien reçu ; la place est retenue 24 h, puis remise à disposition                                        | `features/events/rules.ts`        |
| Fermeture des inscriptions | Au début de la rencontre, ou quand un responsable la clôture ou l'annule                                                                | idem                              |
| Capacité réduite           | Elle ne peut pas descendre sous le nombre d'inscrits confirmés                                                                          | `features/events/service.ts`      |
| Statuts d'un événement     | Brouillon → publié → clôturé ou annulé ; un événement qui a des inscrits ne repasse pas en brouillon                                    | idem                              |
| Renouvellement             | La nouvelle période commence à la fin de la précédente si elle court encore, sinon aujourd'hui                                          | `features/members/service.ts`     |
| Suspension                 | Le compte ne peut plus se connecter, ses sessions sont fermées aussitôt ; un compte de responsable ne se suspend qu'avec `roles.manage` | idem                              |
| Archivage d'un membre      | Anonymisation définitive (nom, e-mail, téléphone effacés), historique conservé. **Jamais exécuté dans un parcours**                     | idem                              |
| Rôles                      | On ne se retire pas à soi-même le rôle de super-administrateur ; il en reste toujours au moins un d'actif                               | `features/auth/roles-service.ts`  |
| Livre du mois              | Une sélection par mois ; le site affiche la plus récente dont le mois a commencé                                                        | `features/library/queries.ts`     |
| Article programmé          | Publié avec une date future, il paraît de lui-même à cette date (au plus quelques minutes après)                                        | `features/articles/queries.ts`    |
| Contact                    | Le message part par e-mail au club, rien n'est stocké ; sans adresse de destination, le formulaire ne s'affiche pas                     | `features/contact/actions.ts`     |
| Images téléversées         | JPEG, PNG ou WebP reconnus à leur contenu, 2 Mo au plus, nom régénéré                                                                   | `lib/storage.ts`                  |

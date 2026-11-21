# Guide des responsables — L’Agora de l’Excellence

Ce guide explique les gestes courants de l'administration (`/admin`). Chaque responsable ne voit
que les rubriques de son rôle ; un même compte peut cumuler plusieurs rôles. Les règles du club
(montants, points, quotas…) sont détaillées dans [`REGLES-METIER.md`](REGLES-METIER.md).

## 1. Accès et rôles

- **Premier compte** : le super-administrateur est créé par un informaticien avec
  `pnpm create-admin` (voir le [README](../README.md)). Les autres comptes de responsables sont
  donnés dans **Équipe et rôles** (super-administrateur seulement).
- **Rôles** :

  | Rôle                      | Ce qu'il fait                                                                                                             |
  | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
  | Responsable communication | Articles, quiz des Génies du soir                                                                                         |
  | Responsable bibliothèque  | Livres, catégories et auteurs, livre du mois, lectures à valider et critiques à modérer                                   |
  | Responsable Scrabble      | Tournois, joueurs, manches, saisie des scores, validation et publication des résultats, records                           |
  | Administrateur            | Tout le reste : adhésions, membres, encaissements, événements, présences, points et badges, contenus, paramètres, journal |
  | Super administrateur      | Tout, plus les rôles de l'équipe                                                                                          |

- Un responsable n'a d'espace membre que s'il a aussi le rôle « Membre ».
- **Raccourcis clavier** (ordinateur) : `Ctrl K` ouvre la recherche ; `g` puis une lettre ouvre une
  rubrique (indiquée dans l'aide du clavier, icône en haut à droite) ; `n` crée un nouvel élément
  dans les listes qui le permettent.
- Sur téléphone, l'administration reste utilisable pour les tâches de terrain : valider une
  adhésion, scanner les présences, saisir des scores.

## 2. Adhésions

1. **Demandes d’adhésion** : une demande arrive quand un visiteur remplit le formulaire du site. Le
   nombre de demandes en attente s'affiche dans le menu.
2. Ouvrir la demande, vérifier les informations, puis **Valider l’adhésion** ou **Refuser** (un mot
   facultatif est repris dans l'e-mail envoyé au demandeur).
3. À la validation, le système crée le compte, attribue le numéro de membre (`AE-AAAA-NNNN`) et
   envoie le lien d'activation par e-mail. Si l'e-mail ne part pas, le lien se renvoie depuis la
   fiche du membre.
4. **QR d’adhésion** : un QR code à imprimer, qui mène au formulaire d'adhésion.

## 3. Membres et encaissements

- **Membres** : rechercher, ouvrir une fiche (panneau latéral), corriger nom et e-mail,
  renouveler l'adhésion, suspendre (l'accès est coupé aussitôt), réactiver, ou **archiver**
  (anonymisation définitive : à réserver aux départs ; un membre qui a un historique n'est jamais
  supprimé). Export CSV possible.
- **Encaissements** : pas de paiement en ligne. La carte de membre (1 000 F CFA, une fois) se
  règle en espèces : **Enregistrer l’encaissement** depuis la fiche du membre ou la rubrique
  Encaissements (montant, date, reçu par). La participation par séance (100 F CFA) se coche
  « Payé » au moment du pointage. La rubrique affiche le total par séance et par mois, et les
  membres dont la carte n'est pas réglée. Chaque encaissement est inscrit au journal.
- Les montants sont des réglages : **Paramètres du club**.

## 4. Événements et présences

1. **Événements** → nouveau : type (une des cinq activités), date, lieu, capacité, ouverture au
   public, délai d'annulation, lien de visio (visible des seuls inscrits). Enregistré en brouillon,
   puis **Publier**.
2. Pendant la vie de la rencontre : **Clôturer les inscriptions**, **Rouvrir les inscriptions**,
   **Annuler la rencontre**, retirer une inscription, exporter la liste des inscrits (CSV).
3. **Pointage** le jour même : **Scan des présences** (sur téléphone) : choisir la rencontre du
   jour, scanner la carte de membre (QR code) ; cocher « Payé » si la participation est réglée.
   Sans caméra ou si la carte ne passe pas : rechercher l'inscrit par son nom. La présence
   rapporte des points au membre.
4. Après la rencontre : rédiger le **compte rendu** depuis la fiche de l'événement ; il paraît sur
   la page de l'événement et dans les Archives.

## 5. Bibliothèque et lectures

- **Livres** : fiche (titre, auteurs, catégorie, résumé rédigé pour le club), couverture
  téléversée (format 2:3 conseillé) ; sans image, une couverture typographique est générée.
- **Catégories et auteurs**, **Livre du mois**.
- **Lectures à valider** : un membre qui déclare un livre terminé ou écrit une critique attend
  une décision. Valider rapporte les points ; refuser demande un mot pour le membre. Une critique
  approuvée n'est publique que si le membre a accepté « publier sous mon prénom ». Un responsable
  ne valide jamais ses propres lectures.

## 6. Points et badges

- Le barème se modifie dans **Points et badges**. Un membre ne s'attribue jamais de points.
- **Ajustement** : ajouter ou retirer des points avec un motif obligatoire. Une erreur se corrige
  par une **ligne inverse motivée** (jamais en modifiant une ligne existante).
- **Badge manuel** : à attribuer depuis la même rubrique. Les autres badges sont automatiques.

## 7. Scrabble

1. **Tournois** → **Nouveau tournoi** : format (individuel ou équipes), mode (duplicate ou
   classique), règle de classement, prise en compte dans le classement mensuel, récompense
   (facultative, rien n'est affiché si elle est vide).
2. Sur la feuille du tournoi : **Inscrire un joueur** (membre du club ou participant extérieur),
   créer les équipes, puis **Lancer le tournoi**.
3. **Nouvelle manche**, puis **Scores** : la saisie se fait sur téléphone (clavier numérique,
   case « Forfait »). En classique, apparier d'abord les joueurs de la manche.
4. Le classement provisoire se met à jour à chaque score ; rien n'est public.
5. **Marquer comme terminé**, puis **Valider les résultats** (rangs figés, points de victoire
   attribués), puis **Publier les résultats** (classement public, palmarès, notification et
   e-mail aux joueurs membres).
6. Une erreur après validation : **Dévalider pour corriger** (motif obligatoire : les points sont
   repris et la publication retirée), corriger, puis valider et publier à nouveau.
7. **Records du club** : à remplir quand le comité les aura définis ; la rubrique publique reste
   invisible tant qu'elle est vide.

## 8. Quiz (Génies du soir)

1. **Quiz** → **Nouveau quiz** : titre, consigne, durée, ouverture et fermeture, rencontre liée.
2. Ajouter les questions (2 à 6 propositions, une seule bonne), relire dans **Aperçu côté membre**.
3. **Publier** : les membres sont prévenus. Durée, ouverture et questions sont alors figées.
4. Le chrono est tenu par le serveur ; chaque membre joue une fois. Le corrigé s'ouvre à la
   clôture (date de fermeture ou **Clore maintenant**). **Résultats** : classement et réussite par
   question.

## 9. Contenus et réglages

- **Articles** : écrire, prévisualiser, publier (une date future programme la publication).
- **Comité de pilotage**, **Charte du club** (mention « version provisoire » tant que le comité
  n'a pas validé le texte définitif), **Paramètres du club** (nom, coordonnées, réseaux,
  montants, délais).
- **Journal** : trace des actions sensibles (rôles, adhésions, encaissements, points, scores,
  suspensions…), consultable par l'administrateur.

## 10. Données de démonstration

Le site livré contient des données d'exemple (livres, rencontres, tournoi, quiz), signalées par un
bandeau. Avant l'ouverture au public, un informaticien les retire avec `pnpm db:clear-demo`.

## 11. En cas de souci

- Un membre ne reçoit pas son e-mail d'activation : renvoyer le lien depuis sa fiche ; vérifier
  l'adresse.
- Un membre a oublié son mot de passe : « Mot de passe oublié » sur la page de connexion.
- Une carte de membre perdue ou partagée : le membre la remplace depuis sa carte (« Remplacer ma
  carte ») ; l'ancienne cesse aussitôt d'être acceptée au scan. Il n'existe pas encore de bouton
  pour qu'un responsable le fasse à sa place.
- Sauvegardes : voir [`SAUVEGARDE.md`](SAUVEGARDE.md).

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

| Action                                         | Limite                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------- |
| Connexion, par compte visé                     | 5 tentatives / 15 min (remise à zéro après une connexion réussie)      |
| Connexion, par adresse IP                      | 20 / 15 min                                                            |
| Mot de passe oublié, par adresse e-mail        | 3 / heure                                                              |
| Mot de passe oublié, par adresse IP            | 10 / heure                                                             |
| Réinitialisation, activation, par adresse IP   | 10 / heure chacune                                                     |
| Demande d'adhésion, par adresse e-mail         | 3 / jour                                                               |
| Demande d'adhésion, par adresse IP             | 100 / heure (une salle entière sur le même Wi-Fi le jour du lancement) |
| Inscription d'un visiteur, par adresse e-mail  | 3 / jour                                                               |
| Inscription d'un visiteur, par adresse IP      | 100 / heure                                                            |
| Formulaire de contact, par adresse IP          | 5 / heure                                                              |
| Lien reçu par e-mail (confirmer, annuler)      | 30 / heure, par adresse IP                                             |
| Remplacement de sa carte de membre             | 3 / heure, par compte                                                  |
| Scan des présences, par responsable            | 240 / 10 min                                                           |
| Recherche d'un inscrit (scan), par responsable | 120 / 10 min                                                           |
| Questions à l'assistant IA, par membre         | 5 / minute (en plus du quota quotidien, voir « Assistant IA »)         |

## Rôles et permissions (n° 24)

Rôles cumulables, moindre privilège. Source : `src/lib/permissions/catalog.ts`, puis la base.

| Rôle                      | Permissions                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Membre                    | Espace membre                                                                                                                                                                                   |
| Responsable communication | Administration ; articles ; quiz (phase 4) ; messages de contact                                                                                                                                |
| Responsable bibliothèque  | Administration ; livres, auteurs, catégories, livre du mois ; validation des livres terminés ; modération des critiques                                                                         |
| Responsable Scrabble      | Administration ; tournois ; saisie des scores ; validation et publication des résultats                                                                                                         |
| Administrateur            | Administration ; articles ; bibliothèque ; adhésions ; membres ; événements ; présences ; points et barème ; badge manuel ; quiz ; messages de contact ; exports ; paramètres ; journal d'audit |
| Super administrateur      | Tout, dont les comptes administratifs et les rôles                                                                                                                                              |

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

## Messages de contact

| Règle        | Valeur                                                                                                                                                                                                                | Où                                                       | État                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------- |
| Conservation | Chaque message de `/contact` est enregistré (nom, e-mail, objet, message, date), même si l'e-mail au club échoue ou si le club n'a pas d'adresse : le visiteur reçoit sa confirmation, le message attend dans l'admin | `ContactMessage`                                         | Appliquée                  |
| Statuts      | Nouveau, lu, traité. Ouvrir un nouveau message le marque comme lu ; chaque changement est tracé (`contact.status_changed`)                                                                                            | `ContactMessage.status`, `AuditLog`                      | Appliquée                  |
| Accès        | Permission `contact.manage` : administrateur, responsable communication, super-administrateur                                                                                                                         | `src/lib/permissions/catalog.ts`                         | Appliquée                  |
| Suppression  | Un message traité est supprimé 12 mois après son traitement (`handledAt`) ; le rouvrir remet le délai à zéro. Purge lancée à chaque changement de statut, comme celle des demandes refusées                           | `src/config/rules.ts` (`contact.handledRetentionMonths`) | Appliquée (testée en base) |
| Robots       | Champ piège rempli : rien n'est enregistré ni envoyé ; limite de débit `contact.ip` avant tout accès à la base                                                                                                        | `src/features/contact/actions.ts`                        | Appliquée                  |

## Cotisations

Source : `docs/CONTENUS-CLUB.md` (sections 7 et 9), décision du comité de pilotage, novembre 2026. Remplace le défaut « adhésion gratuite » du point n° 6. État : appliquée (parcours Playwright `e2e/contenus.spec.ts`).

| Règle                    | Valeur                                                                                                                                                                         | Où                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| Carte de membre          | 1 000 F CFA, versés une fois à l'adhésion                                                                                                                                      | `Setting`              |
| Participation par séance | 100 F CFA par séance                                                                                                                                                           | `Setting`              |
| Montants                 | Réglages modifiables depuis l'admin, jamais écrits en dur                                                                                                                      | `Setting`              |
| Mode de paiement         | Espèces sur place, ou à distance par Wave ou Orange Money (numéros du club dans les paramètres). Pas de paiement en ligne intégré : un responsable enregistre l'encaissement   | `Setting`              |
| Paiement de la carte     | Enregistré par un responsable dans l'admin : moyen (espèces, Wave, Orange Money), référence de la transaction (obligatoire pour Wave et Orange Money), montant, date, reçu par | Admin, fiche du membre |
| Participation            | Case « payé » cochée par un responsable lors du pointage de présence à la séance (espèces, sur place)                                                                          | Admin, présences       |
| Suivi                    | Total encaissé par séance et par mois ; liste des membres dont la carte n'est pas réglée                                                                                       | Admin, encaissements   |
| Traçabilité              | Chaque enregistrement (et chaque annulation) passe dans `AuditLog`                                                                                                             | `lib/audit`            |

Précisions de mise en œuvre :

- Le pointage d'une séance (cases « présent » et « payé ») ouvre le jour de la rencontre, pour les inscriptions confirmées. Cocher « payé » pointe aussi la présence ; décocher « payé » annule l'encaissement.
- Un encaissement n'est jamais supprimé : il s'annule, avec un motif. Une seule carte active par membre et une seule participation active par inscription (index uniques en base).
- Le montant est copié du réglage au moment de l'encaissement : changer le réglage ne modifie pas le passé.
- Durée de la carte : le comité dit « versés une fois à l'adhésion ». La durée d'adhésion de 12 mois reste en place en interne mais n'est plus affichée au public, en attendant sa décision.
- Référence d'une transaction Wave ou Orange Money : obligatoire (contrainte `Payment_reference_check`), et jamais enregistrée deux fois pour le même moyen, casse ignorée (index unique partiel). Un encaissement annulé libère sa référence. En espèces, aucune référence n'est gardée.
- Scan QR de présence (phase 4, partie B) : page `/admin/scan` (`attendance.record`), rencontres du jour publiées ou clôturées ; même règles que le pointage manuel. Un membre non inscrit est refusé (pas d'inscription sur place : les inscriptions ferment au début de la rencontre). Un second scan de la même carte ne change rien (« Déjà pointé à … ») ; il peut seulement ajouter la participation. Le scan ne retire jamais un encaissement.
- Carte de membre non réglée au scan : la présence est enregistrée quand même ; l'écran du résultat affiche le bandeau « Carte de membre non réglée : <montant des réglages> à encaisser ». Un responsable qui a le droit des paiements (`payments.record`) peut « Encaisser la carte maintenant » (espèces, Wave ou Orange Money, référence obligatoire hors espèces) : même service que la fiche membre (référence jamais deux fois, entrée « payment.recorded » au journal). Au scan suivant, la carte est « Réglée ».

### Carte réglée à distance (membres qui suivent à distance)

| Règle             | Valeur                                                                                                                                                                                                                                                                                                                                                     | Où                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Numéros du club   | Wave et Orange Money, saisis dans Administration › Paramètres ; un numéro vide n'est pas affiché                                                                                                                                                                                                                                                           | `Setting` (`payments.waveNumber`, `payments.orangeMoneyNumber`)                                        |
| Délai de grâce    | 30 jours par défaut, comptés à partir de l'acceptation de l'adhésion (début de la première adhésion) ; de 1 à 365 jours                                                                                                                                                                                                                                    | `Setting` (`membership.cardGraceDays`)                                                                 |
| Espace membre     | Tant que la carte n'est pas réglée : encadré « Régler ma carte » avec le montant, les numéros du club, la référence à indiquer en motif (le numéro de membre) et la date limite ; mention « délai passé » une fois la date dépassée                                                                                                                        | `/member`, `/member/card`                                                                              |
| Lien de visio     | Option « masquer le lien de visio si la carte n'est pas réglée après le délai », **désactivée par défaut**. Activée : un membre inscrit dont la carte n'est pas réglée après le délai ne reçoit pas le lien (il n'est pas lu en base, donc absent de la page) et est invité à régler sa carte. Un compte sans adhésion (responsable) n'est jamais concerné | `Setting` (`events.hideVideoWhenCardUnpaid`)                                                           |
| Liste des membres | Filtre « Carte » : réglée, non réglée, non réglée et délai passé ; colonne « Adhésion » : date d'acceptation et jours écoulés tant que la carte n'est pas réglée                                                                                                                                                                                           | Admin, membres                                                                                         |
| Rappels           | Notification et e-mail au membre actif dont la carte n'est pas réglée : **7 jours après l'acceptation**, puis **3 jours avant la fin du délai**. Un seul de chaque, jamais en double (table `CardReminder`, unique par membre et par sorte) ; aucun après la fin du délai ni une fois la carte réglée                                                      | Tâche `rappels-carte` de `scripts/taches.ts`, à partir de 9 h (minuterie `agora-taches`, chaque heure) |

- Rappels : seul le rappel le plus proche part. Si la tâche n'a pas tourné à temps (serveur éteint) et que la date « 3 jours avant » est arrivée, c'est lui qui part, sans rattraper « 7 jours après ». Avec un délai de moins de 10 jours, les deux dates se chevauchent : seul « 3 jours avant » part.
- Un changement du délai de grâce vaut aussitôt pour tous les membres (date limite, rappels, masquage).

## Rencontres

| Règle        | Valeur                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| Rythme       | Une rencontre en présentiel tous les quinze jours                                          |
| Durée        | Deux heures au maximum                                                                     |
| À distance   | Lien de visio facultatif par événement, visible des seuls membres inscrits                 |
| Jour, heure  | Non communiqués : non affichés                                                             |
| Lieu         | Non communiqué : non affiché (« à confirmer » pour le lancement uniquement)                |
| Compte rendu | Rédigé par un responsable sur un événement passé ; visible sur sa page et dans `/archives` |

### Statistiques

| Règle               | Valeur                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accès               | `/admin/stats`, permission « stats.read » (administrateurs). Liste des membres à relancer : en plus « members.read ». Export CSV : en plus « data.export », chaque export consigné au journal                                                                                                                                                                          |
| Période             | 3 mois, 12 mois (par défaut), année en cours, ou « du … au … » (bornes incluses, 5 ans au plus). Heure de Dakar                                                                                                                                                                                                                                                        |
| Rencontres comptées | Publiées ou clôturées, déjà passées, non archivées, hors données de démonstration. Les rencontres annulées ne comptent pas                                                                                                                                                                                                                                             |
| Présence            | Inscrits = inscriptions confirmées (annulées, en attente de confirmation et liste d'attente exclues) ; présents = inscrits pointés, invités compris. Taux de la période = présents / inscrits (et moyenne des taux par rencontre)                                                                                                                                      |
| Activités           | Présences et note moyenne des avis (à partir de 3 avis) par activité. Une rencontre à plusieurs activités compte pour chacune, ou pour sa seule activité principale (au choix, comme pour les avis)                                                                                                                                                                    |
| Membres             | Nouveaux membres : date de la première adhésion validée. Adhérents à jour : compte actif et adhésion en cours à la fin de la période. Actifs : adhérents venus au moins une fois pendant la période                                                                                                                                                                    |
| Renouvellements     | Adhésions commencées dans la période par un membre qui en avait déjà une                                                                                                                                                                                                                                                                                               |
| Lecture             | Livres terminés déclarés sur la période (et validés par un responsable), par genre (catégorie du livre) ; livre du mois : membres qui l'ont dans leurs lectures, présents à la rencontre liée                                                                                                                                                                          |
| Scrabble            | Tournois en cours ou terminés de la période (archivés exclus) : participants (retraits exclus, extérieurs compris), manches avec des scores, score moyen par partie (forfaits exclus), tournoi par tournoi                                                                                                                                                             |
| Ne reviennent plus  | Aujourd'hui : adhérents à jour sans présence depuis 6 semaines (2 à 26, réglable sur la page), ou jamais venus depuis le début de leur adhésion en cours (renouvellements compris ; un membre revenu au club après une interruption n'est pas relancé tout de suite) ; avec leurs coordonnées pour les relancer. Seules comptent les présences aux rencontres comptées |
| Listes d'attente    | Rencontres complètes (capacité atteinte, ou une liste d'attente a existé), personnes en attente, inscrites depuis la liste, restées en attente                                                                                                                                                                                                                         |
| Version partenaires | `/admin/stats/partenaires`, imprimable : chiffres agrégés seulement (aucun nom, aucune coordonnée, aucun titre de rencontre) ; effectifs de personnes inférieurs à 3 affichés « < 3 », taux donné à partir de 5 personnes                                                                                                                                              |

### Avis après la rencontre

| Règle        | Valeur                                                                                                                                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Qui          | Chaque membre actif pointé présent (scan ou case « présent »). Les invités ne sont pas concernés : leur présence ne se pointe pas encore                                                                                                                                       |
| Invitation   | Le lendemain de la fin de la rencontre (heure de fin, sinon début + 3 h), à l'heure réglée (10 h par défaut, Paramètres › Règles) : e-mail et notification. Rattrapage pendant 72 h si le serveur était arrêté. Une seule par participation, même si la tâche tourne deux fois |
| Avis         | Une note de 1 à 5 et un commentaire facultatif (1 000 caractères au plus), depuis « Mes rencontres ». Un seul par participation, déposable dès la fin de la rencontre, modifiable jusqu'à 7 jours après l'invitation (même échéance pour tous, annoncée dans l'e-mail)         |
| Lecture      | Jamais publié. Les responsables qui ont la permission « feedback.read » (administrateurs) voient les avis avec le nom de leur auteur : `/admin/feedback`                                                                                                                       |
| Moyennes     | Par rencontre (présents, avis, taux de réponse, répartition des notes) et par activité. Une rencontre à plusieurs activités compte pour chacune, ou pour sa seule activité principale (au choix). Moyenne affichée à partir de 3 avis                                          |
| Charte       | Un responsable (« feedback.moderate ») peut masquer un commentaire contraire à la charte, avec un motif ; consigné au journal (jamais le texte ni le motif). Le membre ne peut plus modifier ce commentaire, mais encore sa note                                               |
| Conservation | 24 mois après la rencontre : commentaire, motif et lien avec l'auteur effacés (tâche `purge-avis`) ; la note reste, sans nom, pour les statistiques. Annoncé sur `/privacy`                                                                                                    |

### Agenda et partage

| Règle              | Valeur                                                                                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Où                 | Fiche de chaque rencontre (sauf annulée), e-mail de confirmation d'inscription (membre et invité), e-mail « place obtenue » de la liste d'attente, rappel la veille                                      |
| Ajouter à l'agenda | Fichier `.ics` (`/events/<adresse>/agenda.ics`, fuseau Africa/Dakar, lieu, lien de la page ; une rencontre modifiée remplace l'ancienne dans l'agenda) et lien Google Agenda                             |
| WhatsApp           | « Partager sur WhatsApp » (lien wa.me) : titre, date, heure, lieu et lien de la page, sur trois lignes ; titre coupé au-delà de 120 caractères                                                           |
| Partage natif      | Sur téléphone, « Partager… » ouvre le partage du téléphone quand le navigateur le propose ; absent sinon                                                                                                 |
| Aperçu du lien     | Image propre à chaque rencontre (1200 × 630 : date, titre, heure, lieu, « Rencontre annulée » le cas échéant), titre et description de la rencontre, adresse de la page                                  |
| Confidentialité    | Jamais le lien de visio, ni dans le fichier d'agenda, ni dans le message partagé, ni dans l'aperçu. Une rencontre en brouillon ou archivée n'a ni fichier d'agenda ni aperçu (image du site sans donnée) |

### Liste d'attente

| Règle                 | Valeur                                                                                                                                                                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Quand                 | Rencontre complète (places prises par les inscrits confirmés et les invités qui ont 24 h pour confirmer) : « Je m'inscris » devient « Rejoindre la liste d'attente », pour les membres connectés et, si la rencontre est ouverte au public, les visiteurs                                              |
| Rang                  | Ordre d'arrivée sur la liste, affiché (« 1er », « 2e »…) sur la fiche, dans « Mes rencontres » et sur la page du lien de l'invité                                                                                                                                                                      |
| Invité                | Il confirme d'abord son adresse par le lien reçu : il prend son rang à ce moment-là (une fausse adresse ne bloque jamais la file). Le même lien permet de quitter la liste                                                                                                                             |
| Place libérée         | Annulation (membre, invité, responsable), capacité augmentée ou supprimée, rencontre republiée, invité qui n'a pas confirmé à temps (vérifié chaque heure) : la première personne de la liste est inscrite d'office, dans la même transaction, et prévenue par e-mail (et notification pour un membre) |
| Concurrence           | Toute inscription, annulation ou promotion verrouille la rencontre : jamais plus d'inscrits que de places, ordre de la liste toujours respecté, même avec deux annulations simultanées                                                                                                                 |
| Fin de la liste       | 2 h avant le début (réglage « Fin de la liste d'attente ») : plus d'entrée ni de promotion automatique ; une place libérée est alors ouverte à tous                                                                                                                                                    |
| Quitter               | À tout moment, même après le délai d'annulation                                                                                                                                                                                                                                                        |
| Administration        | Fiche de la rencontre : liste dans l'ordre, rang, date d'entrée. « Inscrire » donne la place à quelqu'un quel que soit son rang, jusqu'au début ; au-delà de la capacité, une seconde pression confirme le dépassement                                                                                 |
| Journal               | Entrée, sortie, promotion (automatique ou manuelle, avec le motif et le dépassement éventuel)                                                                                                                                                                                                          |
| Membres non éligibles | Compte suspendu ou archivé : ignoré par la promotion (il garde sa ligne). Les invités ne sont promus que si la rencontre est encore ouverte au public                                                                                                                                                  |
| Rappel la veille      | Jamais aux personnes en attente. Une personne promue après l'heure du rappel reçoit l'e-mail « place obtenue » (date, lieu, agenda) à la place                                                                                                                                                         |
| Historique            | Les lignes ne sont jamais supprimées (`waitlistedAt`, `promotedAt`) : statistiques des listes d'attente (étape 5)                                                                                                                                                                                      |
| Scrabble              | L'inscription d'un joueur à un tournoi passe outre la capacité (inchangé) ; s'il était en attente, sa place est notée comme obtenue                                                                                                                                                                    |

### Rappels la veille

| Règle              | Valeur                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Destinataires      | Chaque inscrit confirmé d'une rencontre publiée ou clôturée : membre actif (sauf s'il a désactivé les rappels dans son profil) ou invité. Rien pour une rencontre annulée, en brouillon ou archivée, ni pour une inscription annulée ou un invité qui n'a pas confirmé                                                                                           |
| Quand              | La veille, à l'heure réglée (10 h, heure de Dakar, par défaut ; Paramètres › Règles). Serveur éteint à cette heure : envoyé au passage suivant, jusqu'à 2 h avant le début (« aujourd'hui à … »)                                                                                                                                                                 |
| Inscrit trop tard  | Inscription confirmée après l'heure du rappel : pas de rappel (l'e-mail de confirmation vient de partir)                                                                                                                                                                                                                                                         |
| Contenu            | Titre, date, heure, lieu ; « Ajouter à mon agenda » (.ics, fuseau Africa/Dakar) et Google Agenda ; lien d'annulation (membre : page de la rencontre ; invité : un lien personnel propre à ce rappel, le premier lien reste valable) ; délai d'annulation                                                                                                         |
| Visio              | Lien de visio pour les membres inscrits seulement, masqué comme sur la page si la carte n'est pas réglée après le délai et que l'option est active. Jamais pour un invité, jamais dans le fichier .ics                                                                                                                                                           |
| Sans doublon       | Un seul rappel par inscription et par horaire (table `RegistrationMail`), même si la tâche tourne deux fois en même temps. Envoi en échec : retenté au passage suivant, 3 tentatives au plus. Seul cas de doublon possible : le programme s'arrête entre l'envoi et son enregistrement ; le rappel est alors repris 30 min plus tard (préféré à un rappel perdu) |
| Rencontre déplacée | Nouvel horaire à plus de 15 min de celui annoncé : un nouveau rappel « horaire modifié » part dans la nouvelle fenêtre                                                                                                                                                                                                                                           |
| Désactivation      | Membre : case « Recevoir un rappel… » de son profil. Invité : pas de désinscription (un seul message, lié à sa demande). Club : réglage « Envoyer un rappel… »                                                                                                                                                                                                   |
| Planification      | Tâche `rappels-rencontres` du lanceur commun `scripts/taches.ts`, chaque heure (minuterie `agora-taches`, `docs/DEPLOIEMENT.md`)                                                                                                                                                                                                                                 |

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

### Rencontres à plusieurs activités

- Une rencontre réunit **au moins une** activité (par exemple lecture + quiz, ou débat + Agora
  Ciné), et en désigne une **principale** : affichée en premier, utilisée pour le tri, et seule
  comptée si les points ne vont qu'à l'activité principale (plus bas). Sans doublon ; la base le
  garantit (`Event.activities`, contrainte `Event_activities_check`).
- Sur le site, la rencontre paraît **sous chacune de ses activités** : page Activités, filtre
  d'activité de l'agenda (`/events`) et des Archives. Sa fiche les affiche toutes.
- Le lancement du 16 janvier 2027 : présentation du club (« Vie du club », principale), Rendez-vous
  lecture et Génies du soir.
- Un quiz se rattache à une rencontre qui compte les Génies du soir parmi ses activités ; un tournoi,
  à une rencontre qui compte une activité Scrabble.

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

- Un type d'événement sans règle ne rapporte rien (n° 12) : c'est le cas de « Vie du club ».
- Un membre ne s'attribue jamais de points. Une transaction = une ligne ; jamais de modification ; une correction = ligne inverse motivée.
- Anti-doublon en base : même membre + même règle + même source = une seule ligne active (rang
  `grantSeq` : 0, puis +1 pour une nouvelle attribution après correction). Plusieurs règles peuvent
  payer une même présence : une ligne par règle.
- Participant extérieur à un tournoi (n° 16) : ni points ni compte.

| Badge                         | Critère                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| Lecteur passionné             | 5 livres terminés (validés)                                                |
| Maître des lettres            | 1 victoire en tournoi                                                      |
| Esprit débatteur              | 10 débats                                                                  |
| Ambassadeur du savoir (n° 14) | Manuel : attribué par un administrateur, avec motif, tracé dans `AuditLog` |

État : **appliquée** (phase 4, partie B : `src/features/gamification/`, tests contre la base réelle).

Précisions de mise en œuvre (détail : `docs/DECISIONS.md`, section 11) :

- Présence pointée (scan ou case cochée), au membre inscrit :
  - **par défaut, la règle de chaque activité de la rencontre** : une rencontre lecture + quiz
    rapporte « Participer à une séance de lecture » et la règle des Génies du soir si elle existe,
    une ligne par règle. Une activité sans règle, ou dont la règle est inactive ou à 0 point, ne
    rapporte rien ; les autres paient quand même.
  - réglage **« activité principale seulement »** (Administration › Points, `points.rules.manage`,
    clé `points.attendance`) : seule la règle de l'activité principale paie. Le lancement, dont
    l'activité principale « Vie du club » n'a pas de règle, ne rapporte alors rien.
  - le réglage vaut **au moment du pointage** : changer le réglage, ou les activités d'une rencontre,
    n'annule ni ne complète les points déjà payés. Un nouveau pointage de la même présence paie les
    règles attendues qui manquent, sans jamais payer deux fois la même.
  - présence décochée : chaque ligne active reçoit sa ligne inverse « Présence décochée » ; recochée :
    nouvelle attribution de chaque règle attendue, selon le réglage du moment. Jamais deux lignes
    actives pour une même règle et une même présence.
  - le badge « Esprit débatteur » compte les présences aux rencontres dont le débat est l'une des
    activités, principale ou non.
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

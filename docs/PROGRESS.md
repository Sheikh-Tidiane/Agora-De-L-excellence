# Avancement

Suivi des fonctionnalités livrées après la mise en production. Chaque étape : tests unitaires et
Playwright du parcours, contrôle visuel à 375 px et 1440 px, `docs/REGLES-METIER.md` à jour.

| Étape | Fonctionnalité                   | État    |
| ----- | -------------------------------- | ------- |
| 1     | Rappels la veille des rencontres | Livrée  |
| 2     | Liste d'attente                  | À faire |
| 3     | Agenda et partage WhatsApp       | À faire |
| 4     | Avis après la rencontre          | À faire |
| 5     | Statistiques pour le comité      | À faire |

## Étape 1 — Rappels la veille des rencontres

- E-mail la veille (10 h par défaut, réglable) à chaque inscrit confirmé, membre ou invité : titre,
  date, heure, lieu, visio (membres), annulation, « Ajouter à mon agenda » (.ics et Google Agenda).
- Sans doublon : table `RegistrationMail` (réservation puis envoi), retentée en cas d'échec ;
  nouveau rappel si la rencontre est déplacée de plus de 15 min.
- Profil : case « Recevoir un rappel… » ; réglages du club : activation et heure.
- Fichier d'agenda public : `/events/<slug>/agenda.ics` (module `src/lib/calendar.ts`, réutilisé à
  l'étape 3).
- Tâches planifiées communes : `scripts/taches.ts` (registre `src/features/tasks/registry.ts`),
  minuterie systemd `agora-taches` chaque heure ; remplace `agora-rappels-carte` (procédure de
  bascule dans `docs/DEPLOIEMENT.md`). Les prochaines tâches (étape 4) s'y ajoutent sans rien
  changer sur le serveur.
- Tests : `src/lib/calendar.test.ts`, `src/features/events/reminder-rules.test.ts`,
  `src/lib/mail/event-reminder.test.ts`, `src/features/tasks/registry.test.ts`,
  `src/features/events/reminders.db.test.ts` (base réelle, dont deux passages simultanés),
  route `.ics` dans `src/app/route-handlers-security.test.ts`, parcours
  `e2e/rappels-rencontres.spec.ts`.
- À faire sur le serveur après la mise en ligne : bascule vers `agora-taches.timer`.

## Étape 2 — Liste d'attente

- Rencontre complète : « Rejoindre la liste d'attente » (membres et invités), rang affiché ;
  l'invité confirme son adresse pour prendre son rang ; on quitte la liste à tout moment.
- Place libérée (annulation, capacité, republication, invité non confirmé à temps) : la première
  personne est inscrite d'office dans la même transaction, sous le verrou de la rencontre, et
  prévenue par e-mail (avec l'agenda) et notification. Arrêt 2 h avant le début (réglable).
- Administration : liste d'attente sur la fiche de la rencontre, « Inscrire » à la main (seconde
  pression au-delà de la capacité), journal (entrée, sortie, promotion).
- Modèle : statut `WAITLISTED`, champs `waitlistedAt` / `promotedAt` (historique gardé pour les
  statistiques), e-mail `WAITLIST_PROMOTED` renvoyé par la tâche horaire `liste-attente` s'il
  n'est pas parti.
- Tests : `src/features/events/waitlist-rules.test.ts`, `src/features/events/waitlist.db.test.ts`
  (base réelle : deux annulations simultanées, une place pour deux personnes en attente avec
  tâche et inscription concurrentes, capacité augmentée, invité, seuil, promotion manuelle),
  déclarations de sécurité, parcours `e2e/liste-attente.spec.ts` à 375 et 1440 px.

## Étape 3 — Agenda et partage WhatsApp

- Fiche de rencontre : bloc « Agenda et partage » (fichier .ics, Google Agenda, « Partager sur
  WhatsApp », partage natif du téléphone s'il existe), prérendu avec la fiche ; sur ordinateur
  au-dessus de l'inscription (seule à suivre la lecture), sur téléphone en dessous ; masqué une
  fois la rencontre passée.
- E-mail de confirmation d'inscription (membre et invité) : liens d'agenda, comme le rappel et
  l'e-mail de place obtenue.
- Aperçu du lien partagé : image Open Graph propre à chaque rencontre (polices du club, OFL,
  `src/assets/og/`, reprises dans le build autonome), dont l'adresse change à chaque modification
  de la rencontre (WhatsApp ne garde pas un ancien aperçu) ; `og:url`, `og:site_name`, `og:locale`.
- Pas de changement du modèle de données.
- Tests : `src/features/events/share.test.ts` (message, encodage wa.me, lieu à confirmer, titre
  long, jamais la visio, e-mail de confirmation), parcours `e2e/partage-agenda.spec.ts` à 375 et
  1440 px (téléchargement .ics, Google Agenda, WhatsApp, partage natif simulé, balises og et image
  PNG 1200 × 630, e-mail de confirmation d'un invité).

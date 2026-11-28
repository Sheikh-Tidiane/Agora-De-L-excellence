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

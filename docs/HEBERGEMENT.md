# HEBERGEMENT.md — Options de mise en ligne (à choisir)

> Rédigé le 14 novembre 2026, **avant tout déploiement**. Rien n'est commandé ni configuré.
> Contrainte : le lancement a lieu le **26 décembre 2026** et l'adhésion doit fonctionner en ligne ce jour-là.
> Les prix sont relevés sur les sites des hébergeurs ou des comparatifs à cette date, hors TVA ;
> ils ont bougé plusieurs fois en 2026 : **à revérifier au moment de commander.**

## Ce dont le site a besoin

- Next.js 16 en mode serveur (pas un site statique) et PostgreSQL 17.
- Un disque persistant pour les images téléversées (couvertures, photos du comité) : c'est ainsi que le code est écrit aujourd'hui (`UPLOAD_DIR`).
- Un envoi d'e-mails fiable (accusé de réception d'adhésion, activation, inscriptions).
- Un nom de domaine et HTTPS (obligatoire : `APP_URL` doit commencer par `https://` en production).
- Des sauvegardes automatiques, copiées hors du serveur, et une restauration testée.
- Un trafic modeste : quelques centaines de visiteurs par jour au plus, un pic le jour du lancement.

## Option A — Un petit serveur (VPS) en France — **recommandée**

Un serveur virtuel chez **OVHcloud** (centre de données en France), sur lequel tourne la même
configuration Docker qu'en local : l'application, PostgreSQL, et un serveur web (Caddy) qui gère
le certificat HTTPS tout seul.

| Poste                                                                        | Coût                 |
| ---------------------------------------------------------------------------- | -------------------- |
| VPS-1 OVHcloud (2 à 4 vCPU, 4 à 8 Go de RAM selon la génération, 40 à 75 Go) | ≈ 6 à 7 € / mois     |
| Sauvegarde automatique du serveur entier (quotidienne, la veille seulement)  | annoncée incluse     |
| Stockage hors du serveur pour nos sauvegardes de la base (quelques Go)       | < 1 € / mois         |
| **Total**                                                                    | **≈ 7 à 8 € / mois** |

- **Sauvegardes** : `scripts/backup.sh` chaque nuit (déjà écrit et testé en local), copie de chaque sauvegarde vers un stockage objet (OVHcloud Object Storage ou Backblaze B2), 30 jours gardés ; la sauvegarde quotidienne d'OVHcloud en plus, en filet. Restauration testée sur le serveur avant l'ouverture.
- **Pour** : le moins cher ; **aucune modification du code** (stockage des images sur disque, scripts de sauvegarde, Docker : tout existe et a tourné) ; centre de données en France, le plus proche de Dakar des trois options ; pas de limite d'usage qui fasse grimper la facture.
- **Contre** : c'est un serveur à entretenir. Je l'installe avec mises à jour de sécurité automatiques, pare-feu et accès par clé uniquement, mais quelqu'un doit rester responsable du compte et des alertes. Une seule machine : si elle tombe, le site tombe jusqu'au redémarrage.
- **Variante** : Hetzner (Allemagne ou Finlande), même principe. Le modèle utile (CPX12 : 1 vCPU, 2 Go) coûte 9,99 € à 11,99 € / mois, plus 20 % pour les sauvegardes, soit ≈ 12 à 15 € / mois : plus cher et plus loin que l'option OVHcloud, sans avantage net ici.

## Option B — Une plateforme gérée : Railway

L'application et PostgreSQL sont déployés depuis le dépôt Git, sans serveur à entretenir.

| Poste                                                                      | Coût                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| Plan Hobby (5 $ / mois, dont 5 $ d'usage)                                  | 5 $                                            |
| Usage : application (≈ 0,5 Go de RAM) + PostgreSQL + volume de quelques Go | ≈ 5 à 10 $ au-delà                             |
| **Total**                                                                  | **≈ 10 à 15 $ / mois**, variable selon l'usage |

- **Sauvegardes** : les sauvegardes de base et de volume **ne sont pas proposées sur le plan Hobby** (il faut le plan Pro, 20 $ / mois). Sur Hobby : un service planifié qui lance `pg_dump` chaque nuit vers un stockage objet ; restauration testée de la même façon.
- **Pour** : déploiement automatique à chaque commit, pas de système à mettre à jour, HTTPS fourni.
- **Contre** : facture à l'usage, donc moins prévisible ; volume limité à 5 Go sur Hobby (suffisant pour les images d'un club, à surveiller) ; centres de données hors de France (Europe de l'Ouest au plus près) ; dépendance à un service américain.

## Option C — Vercel + Neon (le plus « clé en main » pour Next.js)

Vercel héberge l'application (l'entreprise qui fait Next.js) ; Neon fournit PostgreSQL.

| Poste                                                                                                                                    | Coût                   |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Vercel Pro (le plan gratuit est réservé à un usage personnel et non commercial ; un club qui encaisse des cotisations est en zone grise) | 20 $ / mois            |
| Neon Launch (à l'usage : 0,35 $ / Go-mois, 0,106 $ / heure de calcul)                                                                    | ≈ 5 à 15 $ / mois      |
| Stockage des images (Vercel Blob ou équivalent)                                                                                          | quelques $             |
| **Total**                                                                                                                                | **≈ 30 à 40 $ / mois** |

- **Sauvegardes** : Neon garde l'historique jusqu'à 7 jours et permet de revenir à un instant précis (restauration par branche) ; à compléter par un `pg_dump` hebdomadaire hors de Neon.
- **Pour** : le plus simple à faire vivre, la meilleure prise en charge de Next.js 16 (cache, rendu partiel), tient les pics de trafic sans réglage.
- **Contre** : le plus cher ; **demande de modifier le code** : Vercel n'a pas de disque persistant, il faut écrire une implémentation de `StorageService` vers un stockage objet (≈ une demi-journée, plus les tests) ; les sauvegardes « maison » sont moins naturelles qu'avec Docker.

## E-mails en production (valable pour les trois options)

| Service                                  | Gratuit                                | Branchement dans le code                |
| ---------------------------------------- | -------------------------------------- | --------------------------------------- |
| **Brevo** — recommandé pour le lancement | 300 e-mails / jour, relais SMTP inclus | aucun changement : `MAIL_PROVIDER=smtp` |
| Resend                                   | 100 e-mails / jour, 3 000 / mois       | déjà prévu : `MAIL_PROVIDER=resend`     |

Le jour du lancement, chaque adhésion produit au moins deux e-mails (accusé de réception, puis lien d'activation à la validation). Avec 60 demandes ou plus dans la journée, la limite de Resend (100 / jour) peut être atteinte ; celle de Brevo laisse de la marge. Le compte Brevo doit être approuvé avant de pouvoir envoyer : à ouvrir **dès maintenant**.

Dans tous les cas, il faut **un nom de domaine** pour envoyer depuis une adresse du club
(`ne-pas-repondre@…`) et déclarer les enregistrements SPF, DKIM et DMARC ; sans eux, les e-mails
d'activation risquent de finir en indésirables.

## Calendrier proposé (quelle que soit l'option)

| Quand                | Quoi                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Dès le choix         | Ouverture des comptes (hébergeur, Brevo, nom de domaine) **par le club** : je ne crée pas de compte ni ne saisis de moyen de paiement |
| Semaine 1            | Déploiement, HTTPS, e-mails avec SPF/DKIM, sauvegarde de nuit et copie hors serveur                                                   |
| Semaine 1            | Restauration testée **sur le serveur** (base restaurée, contrôle ligne à ligne)                                                       |
| Semaine 2            | Recette en ligne : adhésion de bout en bout depuis un vrai téléphone, en 4G                                                           |
| Avant le 15 décembre | Gel : plus de changement de fonctionnement, seulement des corrections                                                                 |
| 26 décembre          | Lancement ; QR code de l'affiche pointant vers l'adresse définitive                                                                   |

## Ce que j'attends de vous

1. L'option retenue (A, B ou C).
2. Le nom de domaine voulu, ou s'il existe déjà.
3. Qui ouvre et garde les comptes (hébergeur, Brevo, domaine) au nom du club.

## Sources

- OVHcloud VPS : [vpsbenchmarks.com](https://www.vpsbenchmarks.com/hosters/ovhcloud/plans/vps-1), [OVHcloud, évolution des prix 2026](https://us.ovhcloud.com/lp/new-services-repricing/), [OVHcloud VPS](https://www.ovhcloud.com/en-gb/vps/vps-philippines/)
- Hetzner : [Regular Performance](https://www.hetzner.com/cloud/regular-performance/), [ajustement des prix](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- Railway : [tarifs](https://railway.com/pricing), [limites des plans](https://docs.railway.com/reference/pricing/plans), [sauvegardes absentes du plan Hobby](https://station.railway.com/questions/subject-traffic-and-backup-details-for-7c366dee)
- Vercel : [plan Hobby, usage non commercial](https://vercel.com/docs/plans/hobby) ; Neon : [tarifs](https://neon.com/pricing)
- Brevo : [300 e-mails / jour](https://www.brevo.com/en/features/email-api/), [SMTP gratuit](https://www.brevo.com/en/free-smtp-server/) ; Resend : [offre gratuite](https://automationatlas.io/answers/resend-free-tier-explained-2026/)

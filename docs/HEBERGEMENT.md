# HEBERGEMENT.md — Hébergement du site

> **Décision du 22 novembre 2026 : option A.** Un VPS **OVHcloud VPS-1** sous **Ubuntu LTS**
> (24.04), centre de données en France, et un **nom de domaine en .com** (pas encore acheté).
> Rien n'est commandé ni configuré à cette date : la configuration de production est prête et a été
> essayée de bout en bout sur un poste, avec un faux domaine (voir « Ce qui est prêt » ci-dessous).
> Les options B et C, écartées, sont gardées plus bas pour mémoire.

## Configuration retenue

| Élément                     | Choix                                                                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Serveur                     | OVHcloud VPS-1, Ubuntu 24.04 LTS, France (≈ 6 à 7 € HT / mois, à revérifier à la commande)                                                                    |
| Domaine                     | un `.com` au nom du club (≈ 10 à 15 € / an), DNS chez OVHcloud                                                                                                |
| Conteneurs                  | `docker-compose.prod.yml` : le site (Next.js « standalone »), PostgreSQL 17 **sans aucun port ouvert**, Caddy (HTTPS Let's Encrypt automatique)               |
| Données persistantes        | volumes Docker : `postgres-data` (base), `uploads` (couvertures, comité, photos de profil), `caddy-data` (certificats)                                        |
| Secrets                     | `.env.production` sur le serveur seulement (`chmod 600`), modèle : `.env.production.example`. Aucun secret dans le dépôt ni dans les images                   |
| E-mails                     | Brevo en SMTP (voir plus bas), SPF / DKIM / DMARC sur le domaine                                                                                              |
| Sauvegardes                 | chaque nuit : base (`pg_dump`) + fichiers téléversés, 14 jours sur place, copie **chiffrée** hors du serveur (Backblaze B2, région UE) : `docs/SAUVEGARDE.md` |
| Mise en ligne d'une version | `bash scripts/deploy.sh` (migrations Prisma comprises) : `docs/DEPLOIEMENT.md`                                                                                |
| Sécurisation du serveur     | utilisateur non-root, SSH par clé seulement, pare-feu 22/80/443, fail2ban, mises à jour de sécurité automatiques : `docs/DEPLOIEMENT.md`                      |

Coût total attendu : **≈ 8 € / mois** (serveur + stockage des sauvegardes) **+ le domaine** (≈ 1 € / mois ramené au mois).

### Pourquoi Backblaze B2 plutôt que le stockage objet d'OVHcloud pour la copie hors serveur

Avis de l'architecte (sécurité et sauvegardes), retenu : la copie de secours doit survivre à un
incident chez l'hébergeur (incendie du centre de Strasbourg en 2021) **et** à la perte ou au
piratage du compte OVHcloud. B2 est un fournisseur indépendant, en Europe (Amsterdam), à quelques
centimes par mois pour notre volume, avec des clés d'accès **sans droit de suppression** et le
verrouillage des fichiers (Object Lock) : un intrus sur le serveur ne peut pas effacer les
sauvegardes. OVHcloud Object Storage reste possible (même script, autre destination rclone).

### Ce qui est prêt (22 novembre 2026)

- `Dockerfile`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `.env.production.example`.
- `scripts/deploy.sh`, `scripts/prod-compose.sh`, `scripts/backup-prod.sh`, `scripts/restore-prod.sh`,
  minuteries systemd de sauvegarde (`deploy/systemd/`).
- Essai complet sur un poste avec le faux domaine `agora.test` : parcours d'adhésion à
  l'administration (`docs/DEPLOIEMENT.md`, « Essai en local ») et restauration après destruction
  totale (`docs/SAUVEGARDE.md`).

### Une contrainte à connaître : le build a besoin de la base

Le site pré-rend ses pages publiques au moment du build (`next build` lit les rencontres, livres et
articles). L'image se construit donc **sur le serveur**, contre la base de production, par un tunnel
ouvert sur `127.0.0.1` le temps du build seulement (jamais sur internet). Le VPS-1 (4 Go de RAM au
moins dans la génération 2026, plus 2 Go d'échange) suffit : le build prend ≈ 1 à 2 minutes.

---

# Annexe : les options étudiées le 14 novembre 2026

> Rédigé **avant tout déploiement**. Contrainte : le lancement a lieu le **samedi 16 janvier 2027**
> et l'adhésion doit fonctionner en ligne ce jour-là. Prix relevés à cette date, hors TVA :
> **à revérifier au moment de commander.**

## Ce dont le site a besoin

- Next.js 16 en mode serveur (pas un site statique) et PostgreSQL 17.
- Un disque persistant pour les images téléversées (couvertures, photos du comité) : c'est ainsi que le code est écrit aujourd'hui (`UPLOAD_DIR`).
- Un envoi d'e-mails fiable (accusé de réception d'adhésion, activation, inscriptions).
- Un nom de domaine et HTTPS (obligatoire : `APP_URL` doit commencer par `https://` en production).
- Des sauvegardes automatiques, copiées hors du serveur, et une restauration testée.
- Un trafic modeste : quelques centaines de visiteurs par jour au plus, un pic le jour du lancement.

## Option A — Un petit serveur (VPS) en France — **retenue le 22/11/2026**

Un serveur virtuel chez **OVHcloud** (centre de données en France), sur lequel tourne la même
configuration Docker qu'en local : l'application, PostgreSQL, et un serveur web (Caddy) qui gère
le certificat HTTPS tout seul.

| Poste                                                                        | Coût                 |
| ---------------------------------------------------------------------------- | -------------------- |
| VPS-1 OVHcloud (2 à 4 vCPU, 4 à 8 Go de RAM selon la génération, 40 à 75 Go) | ≈ 6 à 7 € / mois     |
| Sauvegarde automatique du serveur entier (quotidienne, la veille seulement)  | annoncée incluse     |
| Stockage hors du serveur pour nos sauvegardes de la base (quelques Go)       | < 1 € / mois         |
| **Total**                                                                    | **≈ 7 à 8 € / mois** |

- **Sauvegardes** : chaque nuit, copie chiffrée vers Backblaze B2, 14 jours sur place (voir `docs/SAUVEGARDE.md`) ; la sauvegarde quotidienne d'OVHcloud en plus, en filet. Restauration testée sur le serveur avant l'ouverture.
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
| 16 janvier 2027      | Lancement ; QR code de l'affiche pointant vers l'adresse définitive                                                                   |

## Ce qui reste à décider

1. ~~L'option retenue~~ : A (OVHcloud VPS-1), le 22/11/2026.
2. Le nom de domaine en .com (à vérifier disponible, puis à acheter chez OVHcloud).
3. Qui ouvre et garde les comptes (OVHcloud, domaine, Brevo, Backblaze, healthchecks.io) au nom
   du club, **à deux personnes** (double authentification sur deux téléphones).

## Sources

- OVHcloud VPS : [vpsbenchmarks.com](https://www.vpsbenchmarks.com/hosters/ovhcloud/plans/vps-1), [OVHcloud, évolution des prix 2026](https://us.ovhcloud.com/lp/new-services-repricing/), [OVHcloud VPS](https://www.ovhcloud.com/en-gb/vps/vps-philippines/)
- Hetzner : [Regular Performance](https://www.hetzner.com/cloud/regular-performance/), [ajustement des prix](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/)
- Railway : [tarifs](https://railway.com/pricing), [limites des plans](https://docs.railway.com/reference/pricing/plans), [sauvegardes absentes du plan Hobby](https://station.railway.com/questions/subject-traffic-and-backup-details-for-7c366dee)
- Vercel : [plan Hobby, usage non commercial](https://vercel.com/docs/plans/hobby) ; Neon : [tarifs](https://neon.com/pricing)
- Brevo : [300 e-mails / jour](https://www.brevo.com/en/features/email-api/), [SMTP gratuit](https://www.brevo.com/en/free-smtp-server/) ; Resend : [offre gratuite](https://automationatlas.io/answers/resend-free-tier-explained-2026/)

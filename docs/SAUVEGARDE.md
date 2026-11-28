# SAUVEGARDE.md — Sauvegarder et restaurer

> État au 22 novembre 2026 : procédure de **production** écrite et **testée en local** de bout en bout
> (sauvegarde chiffrée hors du serveur, destruction totale, réinstallation, restauration depuis la
> seule copie distante). Reste à refaire une fois sur le vrai serveur, avant l'ouverture des adhésions.
> Hébergement : OVHcloud VPS-1 (`docs/HEBERGEMENT.md`) ; copie hors serveur : Backblaze B2 (région UE).

## Ce qui est sauvegardé

| Quoi                                                                                    | Où, en production                        | Comment                                                      |
| --------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| La base PostgreSQL (membres, adhésions, encaissements, inscriptions, contenus, journal) | volume Docker `agora-prod_postgres-data` | `pg_dump` chaque nuit (`scripts/backup-prod.sh`)             |
| Les fichiers téléversés (couvertures, photos du comité, photos de profil)               | volume Docker `agora-prod_uploads`       | archive `tar.gz` chaque nuit, même script                    |
| `.env.production` (secret des sessions, mots de passe)                                  | sur le serveur seulement                 | copie **chiffrée** à la main, à chaque changement (plus bas) |
| La clé privée `age` qui déchiffre les copies distantes                                  | **jamais sur le serveur**                | gardée par deux membres du bureau (plus bas)                 |

Le code et les migrations sont dans Git. Les certificats HTTPS se régénèrent seuls.

## Le principe

Chaque nuit à 02:30 UTC (heure de Dakar), une minuterie systemd lance `scripts/backup-prod.sh` :

1. signale le début à la surveillance (healthchecks.io) ;
2. `pg_dump` de la base → `agora-AAAAMMJJ-HHMMSS.dump`, vérifié lisible (`pg_restore --list`) ;
3. archive du volume des fichiers téléversés, lu en lecture seule → `uploads-AAAAMMJJ-HHMMSS.tar.gz` ;
4. empreintes SHA-256 des deux fichiers → `SHA256SUMS-AAAAMMJJ-HHMMSS` ;
5. **chiffrement** des trois fichiers avec `age`, pour la ou les clés **publiques** du club, puis
   copie vers B2 dans un dossier du jour (`rclone copy --immutable` : jamais `sync`, rien n'est
   supprimé ni écrasé à distance), puis contrôle que la copie distante est complète ;
6. ménage sur place : seuls les **14 derniers jours** restent dans `/var/backups/agora` ;
7. signale la réussite ; en cas d'erreur, signale l'échec. **Un e-mail part si la sauvegarde
   échoue, et aussi si elle ne s'est pas présentée** (serveur éteint, minuterie cassée).

Chaque dimanche à 03:30 UTC, une seconde minuterie restaure la dernière sauvegarde dans une base
temporaire (`scripts/restore-check.sh`, `COMPARE=0`) pour prouver qu'elle se relit.

Avant chaque mise en ligne d'une version, `scripts/deploy.sh` fait en plus une sauvegarde locale
`…-avant-deploiement`.

### Pourquoi ces choix (avis de l'architecte, retenu)

- **Chiffrement côté serveur, clé privée hors du serveur** : la base contient des données
  personnelles, dont celles de mineurs. Le serveur n'a que la clé publique : une fuite de la clé B2,
  ou un accès chez le fournisseur, n'expose rien ; un intrus sur le serveur ne peut pas relire les
  copies distantes.
- **Clé B2 sans droit de suppression + verrouillage des fichiers (Object Lock)** : un intrus sur le
  serveur ne peut ni effacer ni écraser les sauvegardes distantes. La durée de conservation à
  distance est fixée chez B2 (verrou 30 jours, suppression automatique après 35 jours), pas par le
  serveur.
- **rclone + age plutôt que restic** : restic doit pouvoir supprimer pour élaguer, ce qui contredit
  une clé sans suppression ; nos fichiers sont petits (≈ 140 Ko de base aujourd'hui).
- **healthchecks.io** plutôt qu'un e-mail de cron : il prévient aussi quand rien n'arrive.

## Mise en place sur le serveur (une fois)

À faire après l'installation du serveur (`docs/DEPLOIEMENT.md`), connecté en `agora`.

### 1. La paire de clés de chiffrement (sur un poste du club, pas sur le serveur)

```bash
age-keygen -o agora-sauvegardes-cle-privee.txt
```

La commande affiche la clé **publique** (`age1…`). La clé **privée** (le fichier) :

- est rangée par **deux** membres du bureau : dans un gestionnaire de mots de passe, et sur papier
  (imprimée, sous enveloppe, dans un lieu sûr) ;
- ne va **jamais** sur le serveur, ni par e-mail, ni dans le dépôt.

Sans elle, les copies distantes sont illisibles, y compris pour le club.

### 2. Le compte Backblaze B2 (au nom du club)

1. Créer un compte B2, région **EU Central (Amsterdam)**, double authentification activée.
2. Créer un bucket privé `agora-sauvegardes` (nom à adapter s'il est pris), avec **Object Lock**
   activé, rétention par défaut **30 jours**, mode **compliance**.
3. Règle de cycle de vie : supprimer les fichiers 35 jours après leur envoi.
4. Créer une **clé d'application** limitée à ce bucket, capacités `listBuckets`, `listFiles`,
   `readFiles`, `writeFiles` — **sans `deleteFiles`**. Noter son `keyID` et sa clé (montrée une fois).

### 3. La surveillance

Créer un contrôle sur healthchecks.io (offre gratuite, compte du club) : période 1 jour, délai de
grâce 2 heures, alertes par e-mail vers deux personnes. Noter son adresse de ping.

### 4. Les fichiers de réglage sur le serveur

```bash
sudo apt install -y age rclone
sudo install -d -m 750 -o root -g agora /etc/agora
sudo install -d -m 700 -o agora -g agora /var/backups/agora
```

- `/etc/agora/age-recipients.txt` : la clé publique `age1…` (une ligne par personne si plusieurs
  paires de clés).
- `/etc/agora/rclone.conf` : d'après `deploy/rclone.conf.example`, avec le `keyID` et la clé B2.
- `/etc/agora/backup.env` : d'après `deploy/backup.env.example`, avec l'adresse de ping.

```bash
sudo chown root:agora /etc/agora/* && sudo chmod 640 /etc/agora/*
```

### 5. Les minuteries

```bash
sudo cp /srv/agora/deploy/systemd/agora-*.service /srv/agora/deploy/systemd/agora-*.timer /etc/systemd/system/
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now agora-backup.timer agora-restore-check.timer agora-taches.timer
```

Premier essai tout de suite, puis lecture du journal :

```bash
sudo systemctl start agora-backup.service && journalctl -u agora-backup -n 20
```

Vérifier dans B2 que le dossier du jour contient trois fichiers `.age`, et sur healthchecks.io que
le contrôle est passé au vert. Prochains passages : `systemctl list-timers 'agora-*'`.

### 6. La copie chiffrée de `.env.production`

À faire à l'installation, puis à chaque modification de `.env.production` :

```bash
age -R /etc/agora/age-recipients.txt -o env-production-$(date +%Y%m%d).age /srv/agora/.env.production
```

Récupérer ce fichier (`scp`) sur le poste d'un membre du bureau et le ranger avec la clé privée,
puis l'effacer du serveur (`shred -u env-production-*.age`).

## Sauvegarder à la main

```bash
bash scripts/backup-prod.sh --label avant-operation
```

`--local-only` : sans copie distante ni signal de surveillance.

## Vérifier qu'une sauvegarde se restaure (sans rien toucher)

```bash
PG_CONTAINER=agora-prod-postgres-1 bash scripts/restore-check.sh /var/backups/agora/agora-AAAAMMJJ-HHMMSS.dump
```

Restaure dans une base temporaire, compare le nombre de lignes de chaque table à la base en
service, puis supprime la base temporaire. À lancer sur une base au repos (sinon les écarts sont
normaux). `COMPARE=0` : sans comparaison, pour une sauvegarde ancienne.

**Chaque mois** : télécharger depuis B2 la dernière copie, la déchiffrer sur le poste qui détient la
clé privée, et faire ce contrôle. **Chaque trimestre** : la restauration complète ci-dessous sur
un poste (Docker suffit), fichiers téléversés compris. Une sauvegarde qu'on n'a jamais restaurée
n'est pas une sauvegarde.

## Restaurer pour de bon

À n'utiliser qu'en cas de perte : la base et les fichiers en service sont **remplacés**.

### Cas 1 — la base est abîmée, le serveur va bien

```bash
bash scripts/restore-prod.sh /var/backups/agora/agora-AAAAMMJJ-HHMMSS.dump /var/backups/agora/uploads-AAAAMMJJ-HHMMSS.tar.gz
```

Le script contrôle les empreintes (`SHA256SUMS-…` à côté), demande de **taper le domaine** pour
confirmer, arrête le site, garde une copie de l'état actuel (`…-avant-restauration`), recrée la
base, y restaure la sauvegarde, remplace les fichiers téléversés, applique les migrations plus
récentes que la sauvegarde et redémarre le site. Ensuite :

```bash
bash scripts/deploy.sh --no-pull
```

(reconstruit les pages pré-rendues avec les données restaurées, ≈ 2 minutes).

### Cas 2 — le serveur est perdu

1. Nouveau serveur : suivre `docs/DEPLOIEMENT.md` (sécurisation, clone du dépôt), remettre
   `.env.production` depuis sa copie chiffrée (**même `BETTER_AUTH_SECRET`**), puis
   `bash scripts/deploy.sh --no-pull` (installe un site vide).
2. Récupérer la dernière copie distante :
   ```bash
   rclone --config /etc/agora/rclone.conf copy b2:agora-sauvegardes/AAAAMMJJ/ ~/restauration/
   ```
3. Apporter la clé privée le temps de la restauration (fichier `cle.txt`, `chmod 600`) :
   ```bash
   AGE_IDENTITY=~/cle.txt bash scripts/restore-prod.sh ~/restauration/agora-AAAAMMJJ-HHMMSS.dump.age ~/restauration/uploads-AAAAMMJJ-HHMMSS.tar.gz.age
   ```
4. `bash scripts/deploy.sh --no-pull`, puis **effacer la clé** : `shred -u ~/cle.txt`.
5. Remettre en place les minuteries de sauvegarde (section « Mise en place », étapes 4 et 5).

## Ce qui a été testé, et ce qui ne l'a pas été

**Testé le 22/11/2026, en local**, sur la pile de production (`docker-compose.prod.yml`, faux domaine
`agora.test`), avec une destination « distante » rclone locale à la place de B2 et un faux service
de surveillance :

1. Sauvegarde complète : base (44 tables), 3 fichiers téléversés (deux photos de profil, une photo
   du comité), chiffrés avec `age`, copiés et contrôlés à distance ; surveillance : `/start` puis
   succès. Les fichiers distants sont bien chiffrés (en-tête `age-encryption.org/v1`).
2. Échec provoqué (clé publique absente) : rien ne part en clair, code de sortie 1, signal `/fail`.
3. **Catastrophe** : `docker compose down -v` (base, fichiers téléversés et certificats détruits)
   et suppression de toutes les sauvegardes locales.
4. Réinstallation à neuf (`deploy.sh` : site vide, migrations et seed), récupération de la seule
   copie distante, restauration avec la clé privée (`restore-prod.sh`) : empreintes vérifiées,
   restauration en ≈ 10 secondes, puis reconstruction (`deploy.sh`).
5. Contrôles après restauration :
   - **base identique table par table** à l'état d'avant la catastrophe : 44 tables, 195 lignes ;
   - **fichiers téléversés identiques** au bit près (SHA-256), propriétaire correct (`node`) ;
   - un super-administrateur créé **avant** la catastrophe se reconnecte avec son mot de passe ;
   - les trois parcours de `pnpm test:prod` passent sur le site restauré (adhésion, activation,
     connexion, photos, administration).
6. Essai hebdomadaire (`restore-check.sh`, `COMPARE=0`) sur la dernière sauvegarde : OK.

Corrigé pendant ces essais : faux échec du contrôle d'une sauvegarde (`grep -q` et `pipefail`),
résumé final de la restauration, moteur de migration de Prisma choisi sans openssl (image de
construction complète désormais).

**Non testé** (à faire sur le serveur, avant le 16 janvier) :

- la copie vers le vrai B2 (clé sans suppression, Object Lock) et les alertes réelles de
  healthchecks.io ;
- le lancement par les minuteries systemd (fichiers écrits, pas exécutés hors d'un vrai systemd) ;
- une restauration complète sur le serveur lui-même.

## Ancienne procédure (développement)

`scripts/backup.sh` et `scripts/restore-check.sh` (sans variable) restent utilisables sur la base
de développement (`docker-compose.yml`) : `bash scripts/backup.sh` écrit dans `./backups`.

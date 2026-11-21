# SAUVEGARDE.md — Sauvegarder et restaurer la base

> État au 20 novembre 2026 : procédure **testée en local** (PostgreSQL dans Docker), refaite pour la phase 6.
> L'automatisation en production (heure, copie hors du serveur, alerte en cas d'échec) dépend de
> l'hébergement, qui n'est pas encore choisi : cette partie reste à faire et à tester en ligne.

## Ce qu'il faut sauvegarder

| Quoi                                                                                    | Où                                | Comment                                                                                      |
| --------------------------------------------------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| La base PostgreSQL (membres, adhésions, encaissements, inscriptions, contenus, journal) | conteneur `postgres`              | `scripts/backup.sh`                                                                          |
| Les images téléversées (couvertures, photos du comité)                                  | dossier `UPLOAD_DIR` (`uploads/`) | même script, archive `uploads-….tar.gz`                                                      |
| Le fichier `.env` de production (secret des sessions, accès SMTP)                       | hors dépôt                        | copie manuelle, en lieu sûr. **Sans `BETTER_AUTH_SECRET`, toutes les sessions sont perdues** |

Le code et les migrations sont dans Git : ils ne se sauvegardent pas ici.

## Sauvegarder

```
bash scripts/backup.sh            # écrit dans ./backups
```

Produit `backups/agora-AAAAMMJJ-HHMMSS.dump` (format « custom » de `pg_dump`, compressé) et, s'il
y a des images, `backups/uploads-AAAAMMJJ-HHMMSS.tar.gz`. Le script échoue si le fichier est vide
ou illisible, et supprime les sauvegardes de plus de 14 jours (`KEEP_DAYS`).

Variables : `PG_CONTAINER`, `POSTGRES_USER`, `POSTGRES_DB`, `UPLOAD_DIR`, `KEEP_DAYS` (voir l'en-tête du script).

## Vérifier qu'une sauvegarde se restaure

```
bash scripts/restore-check.sh backups/agora-AAAAMMJJ-HHMMSS.dump
```

La sauvegarde est restaurée dans une base temporaire (`agora_restore_check`), sans toucher à la
base en service ; le nombre de lignes de chaque table est comparé à celui de la base en service ;
la base temporaire est supprimée. Le code de sortie vaut 0 seulement si tout correspond.

À faire juste après une sauvegarde, et au moins une fois par mois : **une sauvegarde qu'on n'a
jamais restaurée n'est pas une sauvegarde.**

## Restaurer pour de bon

À n'utiliser qu'en cas de perte : la base en service est **remplacée**.

```
# 1. Arrêter l'application (plus aucune écriture)
# 2. Garder une copie de l'état actuel, même abîmé
bash scripts/backup.sh backups/avant-restauration

# 3. Recréer la base et y restaurer la sauvegarde
docker cp backups/agora-AAAAMMJJ-HHMMSS.dump agora-excellence-postgres-1:/tmp/restore.dump
docker exec agora-excellence-postgres-1 psql -U agora -d postgres -c 'drop database agora;'
docker exec agora-excellence-postgres-1 psql -U agora -d postgres -c 'create database agora;'
docker exec agora-excellence-postgres-1 pg_restore -U agora -d agora --no-owner --no-privileges --exit-on-error /tmp/restore.dump

# 4. Remettre les images
tar -xzf backups/uploads-AAAAMMJJ-HHMMSS.tar.gz

# 5. Appliquer les migrations plus récentes que la sauvegarde, puis redémarrer l'application
pnpm db:deploy
```

Sous Git Bash (Windows), préfixer les commandes `docker` qui citent un chemin du conteneur par `MSYS_NO_PATHCONV=1`.

## Ce qui a été testé, et ce qui ne l'a pas été

**Testé le 20/11/2026, en local** (phase 6) :

- `scripts/backup.sh` : sauvegarde de 218 Ko, 44 tables.
- `scripts/restore-check.sh` : restauration dans une base temporaire, 44 tables, 2 451 lignes, 3 migrations (toutes celles du dépôt) ; chaque table a le même nombre de lignes que la base en service.
- Archive des images (`uploads-….tar.gz`) : extraite dans un dossier temporaire, identique au dossier `uploads/` fichier par fichier (`diff -r`).
- Un premier essai lancé pendant les tests Playwright a bien signalé des écarts (sessions, journal, limites de débit écrits entre la sauvegarde et la vérification) : le contrôle les voit, il faut le lancer sur une base au repos.

**Testé le 14/11/2026, en local** :

- `scripts/backup.sh` : sauvegarde de 145 Ko, 38 tables.
- `scripts/restore-check.sh` : restauration dans une base temporaire, 38 tables, 806 lignes, 2 migrations ; chaque table a le même nombre de lignes que la base en service.
- Le contrôle détecte un écart : une ligne ajoutée à la base en service après la sauvegarde fait échouer la vérification, en nommant la table.

**Non testé** :

- La restauration « pour de bon » (étapes 1 à 5 ci-dessus) : seule la restauration dans une base temporaire a été exécutée. Les commandes sont les mêmes, à une base près.
- Tout ce qui relève de la production : lancement automatique chaque nuit, copie hors du serveur, alerte en cas d'échec, restauration sur un serveur neuf.

## À mettre en place avec l'hébergement

1. Lancer `scripts/backup.sh` chaque nuit (tâche planifiée du serveur), ou activer les sauvegardes de l'hébergeur si la base est gérée.
2. Copier chaque sauvegarde **hors du serveur** (stockage objet ou autre machine) : sur le même disque, elle disparaît avec lui.
3. Être prévenu quand une sauvegarde échoue.
4. Refaire en ligne le test de restauration, sur un serveur neuf, avant l'ouverture des adhésions.

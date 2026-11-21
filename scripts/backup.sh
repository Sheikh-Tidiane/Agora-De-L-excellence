#!/usr/bin/env bash
# Sauvegarde de la base PostgreSQL et des images téléversées.
#
#   bash scripts/backup.sh [dossier]          (défaut : ./backups)
#
# Variables :
#   PG_CONTAINER    conteneur PostgreSQL (défaut : agora-excellence-postgres-1)
#   POSTGRES_USER   (défaut : agora)      POSTGRES_DB (défaut : agora)
#   UPLOAD_DIR      dossier des images téléversées (défaut : uploads)
#   KEEP_DAYS       nombre de jours de sauvegardes gardés sur place (défaut : 14)
#
# Produit <dossier>/agora-AAAAMMJJ-HHMMSS.dump (format « custom » de pg_dump, compressé)
# et, s'il existe des images, <dossier>/uploads-AAAAMMJJ-HHMMSS.tar.gz.
# Une sauvegarde qui reste sur le même disque que la base ne protège pas d'une panne du serveur :
# copiez ce dossier ailleurs (voir docs/SAUVEGARDE.md).
set -euo pipefail

OUT="${1:-backups}"
PG_CONTAINER="${PG_CONTAINER:-agora-excellence-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-agora}"
POSTGRES_DB="${POSTGRES_DB:-agora}"
UPLOAD_DIR="${UPLOAD_DIR:-uploads}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DUMP="$OUT/agora-$STAMP.dump"

mkdir -p "$OUT"

# Le fichier est écrit dans le conteneur puis copié : aucun flux binaire ne traverse le terminal.
# MSYS_NO_PATHCONV : sous Git Bash (Windows), empêche la réécriture des chemins du conteneur.
export MSYS_NO_PATHCONV=1
docker exec "$PG_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --format=custom --no-owner --no-privileges --file=/tmp/agora-backup.dump
docker cp "$PG_CONTAINER:/tmp/agora-backup.dump" "$DUMP"
docker exec "$PG_CONTAINER" rm -f /tmp/agora-backup.dump

# Une sauvegarde vide ou illisible doit faire échouer la commande, pas passer inaperçue.
test -s "$DUMP" || { echo "ÉCHEC : sauvegarde vide ($DUMP)" >&2; exit 1; }
docker cp "$DUMP" "$PG_CONTAINER:/tmp/agora-verify.dump"
TABLES="$(docker exec "$PG_CONTAINER" sh -c 'pg_restore --list /tmp/agora-verify.dump | grep -c "TABLE DATA"; rm -f /tmp/agora-verify.dump')"
test "$TABLES" -gt 0 || { echo "ÉCHEC : sauvegarde illisible ($DUMP)" >&2; exit 1; }

if [ -d "$UPLOAD_DIR" ] && [ -n "$(ls -A "$UPLOAD_DIR" 2>/dev/null)" ]; then
  tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
fi

# Ménage : on ne garde sur place que les KEEP_DAYS derniers jours.
find "$OUT" -maxdepth 1 -type f \( -name 'agora-*.dump' -o -name 'uploads-*.tar.gz' \) \
  -mtime +"$KEEP_DAYS" -delete

echo "Sauvegarde écrite : $DUMP ($(wc -c < "$DUMP" | tr -d ' ') octets, $TABLES tables)"

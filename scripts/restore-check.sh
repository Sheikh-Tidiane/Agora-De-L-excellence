#!/usr/bin/env bash
# Restauration d'essai : prouve qu'une sauvegarde se restaure, sans toucher à la base en service.
#
#   bash scripts/restore-check.sh backups/agora-AAAAMMJJ-HHMMSS.dump
#
# La sauvegarde est restaurée dans une base temporaire (agora_restore_check), puis le nombre de
# lignes de chaque table est comparé à celui de la base en service. La base temporaire est
# supprimée à la fin. Code de sortie 0 seulement si tout correspond.
#
# À lancer juste après une sauvegarde : si la base en service a changé entre-temps, des écarts
# sont normaux (le script les affiche).
#
# Restaurer pour de bon (remplace la base en service) : voir docs/SAUVEGARDE.md.
set -euo pipefail

DUMP="${1:?Usage : bash scripts/restore-check.sh <fichier.dump>}"
PG_CONTAINER="${PG_CONTAINER:-agora-excellence-postgres-1}"
POSTGRES_USER="${POSTGRES_USER:-agora}"
POSTGRES_DB="${POSTGRES_DB:-agora}"
CHECK_DB="agora_restore_check"
export MSYS_NO_PATHCONV=1

test -s "$DUMP" || { echo "Fichier introuvable ou vide : $DUMP" >&2; exit 1; }

psql() { docker exec "$PG_CONTAINER" psql -U "$POSTGRES_USER" -v ON_ERROR_STOP=1 -t -A "$@"; }

# Nombre exact de lignes de chaque table du schéma public, une ligne « table=nombre » par table.
counts() {
  psql -d "$1" -c "
    select string_agg(format('%s=%s', table_name,
      (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from %I', table_name), false, true, '')))[1]::text),
      E'\n' order by table_name)
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE';"
}

cleanup() {
  psql -d postgres -c "drop database if exists $CHECK_DB;" > /dev/null
  docker exec "$PG_CONTAINER" rm -f /tmp/agora-restore.dump
}
trap cleanup EXIT

psql -d postgres -c "drop database if exists $CHECK_DB;" > /dev/null
psql -d postgres -c "create database $CHECK_DB;" > /dev/null
docker cp "$DUMP" "$PG_CONTAINER:/tmp/agora-restore.dump"
docker exec "$PG_CONTAINER" pg_restore -U "$POSTGRES_USER" -d "$CHECK_DB" \
  --no-owner --no-privileges --exit-on-error /tmp/agora-restore.dump

RESTORED="$(counts "$CHECK_DB")"
LIVE="$(counts "$POSTGRES_DB")"
TABLES="$(printf '%s\n' "$RESTORED" | grep -c '=')"
ROWS="$(printf '%s\n' "$RESTORED" | awk -F= '{s+=$2} END {print s+0}')"
MIGRATIONS="$(psql -d "$CHECK_DB" -c 'select count(*) from "_prisma_migrations" where finished_at is not null;')"

echo "Restauré dans $CHECK_DB : $TABLES tables, $ROWS lignes, $MIGRATIONS migrations appliquées."

if [ "$RESTORED" = "$LIVE" ]; then
  echo "OK : chaque table a le même nombre de lignes que la base en service."
else
  echo "ÉCART avec la base en service (restauré | en service) :" >&2
  diff <(printf '%s\n' "$RESTORED") <(printf '%s\n' "$LIVE") >&2 || true
  exit 1
fi

#!/usr/bin/env bash
# Restauration COMPLÈTE de production : remplace la base et les fichiers téléversés en service.
# À n'utiliser qu'en cas de perte (serveur neuf, base abîmée). Procédure : docs/SAUVEGARDE.md.
#
#   bash scripts/restore-prod.sh <agora-….dump[.age]> <uploads-….tar.gz[.age]>
#
# Fichiers chiffrés (.age, copie hors serveur) : AGE_IDENTITY=<fichier de la clé PRIVÉE>.
# La clé privée n'est jamais laissée sur le serveur : l'apporter le temps de la restauration,
# puis l'effacer (shred -u).
#
# Étapes : déchiffrement et contrôle des empreintes (SHA256SUMS-… s'il est à côté) → confirmation
# (taper le domaine) → arrêt du site → sauvegarde de l'état actuel → base recréée et restaurée →
# fichiers téléversés remplacés → migrations plus récentes que la sauvegarde → redémarrage.
#
# Variables : ENV_FILE, COMPOSE_EXTRA (comme deploy.sh), ASSUME_YES=1 (sans confirmation, essais).
set -euo pipefail
cd "$(dirname "$0")/.."

DUMP_IN="${1:?Usage : bash scripts/restore-prod.sh <agora-….dump[.age]> <uploads-….tar.gz[.age]>}"
UPLOADS_IN="${2:?Indiquez aussi l’archive des fichiers téléversés (uploads-….tar.gz[.age])}"
ENV_FILE="${ENV_FILE:-.env.production}"
export ENV_FILE
PROJECT="${COMPOSE_PROJECT:-agora-prod}"
compose() { bash scripts/prod-compose.sh "$@"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { echo "ÉCHEC : $*" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
chmod 700 "$WORK"

# --- Déchiffrement -----------------------------------------------------------------------
plain() {
  local src="$1"
  test -s "$src" || fail "fichier introuvable ou vide : $src"
  if [[ "$src" == *.age ]]; then
    [ -s "${AGE_IDENTITY:-}" ] || fail "$src est chiffré : AGE_IDENTITY doit désigner la clé privée."
    local out="$WORK/$(basename "${src%.age}")"
    age -d -i "$AGE_IDENTITY" -o "$out" "$src"
    echo "$out"
  else
    echo "$src"
  fi
}
step "Préparation"
DUMP="$(plain "$DUMP_IN")"
UPLOADS="$(plain "$UPLOADS_IN")"

# Empreintes : SHA256SUMS-<horodatage> à côté de la sauvegarde (chiffré ou non).
stamp="$(basename "$DUMP" .dump)"; stamp="${stamp#agora-}"
for sums in "$(dirname "$DUMP_IN")/SHA256SUMS-$stamp" "$(dirname "$DUMP_IN")/SHA256SUMS-$stamp.age"; do
  if [ -s "$sums" ]; then
    sums_plain="$(plain "$sums")"
    for pair in "$DUMP:agora-$stamp.dump" "$UPLOADS:uploads-$stamp.tar.gz"; do
      file="${pair%%:*}"; name="${pair#*:}"
      expected="$(awk -v f="$name" '$2 == f { print $1 }' "$sums_plain")"
      [ -n "$expected" ] && [ "$(sha256sum < "$file" | cut -d' ' -f1)" = "$expected" ] \
        || fail "empreinte différente pour $name : sauvegarde abîmée ou fichiers de deux sauvegardes différentes."
    done
    echo "Empreintes vérifiées ($(basename "$sums"))."
    break
  fi
done
tables="$(docker run --rm -i --network none postgres:17-alpine pg_restore --list < "$DUMP" | grep -c 'TABLE DATA' || true)"
[ "$tables" -gt 0 ] || fail "$DUMP n'est pas une sauvegarde pg_dump lisible."
tar -tzf "$UPLOADS" > /dev/null || fail "$UPLOADS n'est pas une archive lisible."

# --- Confirmation ---------------------------------------------------------------------------
DOMAIN="$(set -a; . "./$ENV_FILE"; printf '%s' "$SITE_DOMAIN")"
echo "La base et les fichiers téléversés de $DOMAIN vont être REMPLACÉS par :"
echo "  $DUMP_IN"
echo "  $UPLOADS_IN"
if [ "${ASSUME_YES:-0}" != 1 ]; then
  read -r -p "Tapez le domaine ($DOMAIN) pour confirmer : " answer
  [ "$answer" = "$DOMAIN" ] || fail "confirmation incorrecte, rien n'a été modifié."
fi

# --- Restauration -----------------------------------------------------------------------------
step "Arrêt du site"
compose stop app
compose up -d --wait postgres

step "Copie de l'état actuel, même abîmé"
bash scripts/backup-prod.sh --label avant-restauration --local-only || echo "(copie impossible : on continue)"

step "Base de données"
compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists \"$POSTGRES_DB\" with (force);" -c "create database \"$POSTGRES_DB\";"'
compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges --exit-on-error' < "$DUMP"

step "Fichiers téléversés"
docker volume inspect "${PROJECT}_uploads" > /dev/null 2>&1 || docker volume create "${PROJECT}_uploads" > /dev/null
docker run --rm -i --network none -v "${PROJECT}_uploads:/uploads" postgres:17-alpine \
  sh -c 'find /uploads -mindepth 1 -delete && tar -xzf - -C /uploads && chown -R 1000:1000 /uploads' < "$UPLOADS"

step "Migrations plus récentes que la sauvegarde"
APP_TAG=current compose run --rm -T tools pnpm db:deploy

step "Redémarrage"
APP_TAG=current compose up -d --wait --remove-orphans

COUNTS="$(compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA' <<'SQL'
select (select count(*) from "User") || ' comptes, ' || (select count(*) from "Book") || ' livres, '
    || (select count(*) from "Event") || ' rencontres, ' || (select count(*) from "Article") || ' articles';
SQL
)"
FILES="$(docker run --rm --network none -v "${PROJECT}_uploads:/u:ro" postgres:17-alpine find /u -type f | wc -l)"
echo
echo "Restauration terminée : $COUNTS, $FILES fichier(s) téléversé(s)."
echo "Pour que les pages pré-rendues reflètent les données restaurées : bash scripts/deploy.sh --no-pull"

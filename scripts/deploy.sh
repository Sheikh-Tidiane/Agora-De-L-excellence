#!/usr/bin/env bash
# Met en ligne une version du site, en une commande, sur le serveur.
#
#   bash scripts/deploy.sh                 récupère la dernière version de la branche suivie, puis déploie
#   bash scripts/deploy.sh --no-pull       déploie le code tel qu'il est dans ce dossier
#   bash scripts/deploy.sh --rollback      revient à l'image précédente (le schéma de la base, lui, reste)
#
# Étapes : récupération du code → image « tools » → sauvegarde de la base → migrations Prisma
# (prisma migrate deploy) → seed à la première installation → image du site (build contre la base,
# via un tunnel 127.0.0.1 ouvert le temps du build) → redémarrage du site → contrôle de santé.
# Une erreur arrête tout : le site en service continue de tourner sur l'ancienne image.
#
# Règle pour les migrations : l'ancienne version tourne quelques minutes sur le nouveau schéma
# (pendant le build). Une migration doit donc être compatible avec la version précédente
# (ajouter des colonnes ou des tables ; retirer seulement dans une version ultérieure).
#
# Variables : ENV_FILE (défaut .env.production), COMPOSE_EXTRA (essai local), BUILD_DB_PORT (55432),
#             BACKUP_ENV (défaut /etc/agora/backup.env, pour la sauvegarde avant migration),
#             BUILD_EXTRA_CA (certificat d'un proxy HTTPS d'entreprise ; inutile sur le serveur).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.production}"
BUILD_DB_PORT="${BUILD_DB_PORT:-55432}"
export ENV_FILE BUILD_DB_PORT
STATE_DIR=".deploy"
mkdir -p "$STATE_DIR"

compose() { bash scripts/prod-compose.sh "$@"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { echo "ÉCHEC : $*" >&2; exit 1; }

PULL=1
ROLLBACK=0
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    --rollback) ROLLBACK=1 ;;
    *) fail "option inconnue : $arg" ;;
  esac
done

# --- Contrôles du fichier d'environnement ----------------------------------------------
test -f "$ENV_FILE" || fail "$ENV_FILE introuvable (modèle : .env.production.example)."
perms="$(stat -c '%a' "$ENV_FILE")"
[ "$perms" = "600" ] || [ "$perms" = "400" ] || echo "ATTENTION : $ENV_FILE est lisible par d'autres comptes (chmod 600 $ENV_FILE)." >&2
read_env() { (set -a; . "./$ENV_FILE"; set +a; eval "printf '%s' \"\${$1:-}\""); }
SITE_DOMAIN="$(read_env SITE_DOMAIN)"
APP_URL="$(read_env APP_URL)"
for name in SITE_DOMAIN APP_URL POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB BETTER_AUTH_SECRET MAIL_FROM CADDY_TLS; do
  [ -n "$(read_env "$name")" ] || fail "$name est vide dans $ENV_FILE."
done
[ "$APP_URL" = "https://$SITE_DOMAIN" ] || fail "APP_URL ($APP_URL) doit valoir https://$SITE_DOMAIN."
[ "$(read_env POSTGRES_PASSWORD | tr -d 'a-zA-Z0-9')" = "" ] || fail "POSTGRES_PASSWORD : lettres et chiffres seulement."

# --- Retour arrière ----------------------------------------------------------------------
if [ "$ROLLBACK" = 1 ]; then
  previous="$(cat "$STATE_DIR/previous" 2>/dev/null || true)"
  [ -n "$previous" ] || fail "aucune version précédente connue."
  step "Retour à la version $previous"
  docker tag "agora-app:$previous" agora-app:current
  docker tag "agora-tools:$previous" agora-tools:current
  APP_TAG=current compose up -d app caddy
  cp "$STATE_DIR/current" "$STATE_DIR/previous" 2>/dev/null || true
  echo "$previous" > "$STATE_DIR/current"
  echo "Retour effectué. Le schéma de la base n'a pas été modifié : si la version annulée avait une migration, voir docs/DEPLOIEMENT.md."
  exit 0
fi

# --- Code ----------------------------------------------------------------------------------
if [ "$PULL" = 1 ]; then
  step "Récupération du code"
  git diff --quiet && git diff --cached --quiet || fail "des fichiers suivis sont modifiés sur le serveur ; rien n'est déployé."
  git pull --ff-only
fi
TAG="$(git rev-parse --short=12 HEAD)"
git diff --quiet HEAD -- . ':!.deploy' 2>/dev/null || TAG="$TAG-modifie"
echo "Version : $TAG ($(git log -1 --format='%cd · %s' --date=format:'%d/%m/%Y %H:%M'))"

# --- Image des outils -------------------------------------------------------------------------
step "Image des outils (migrations, seed, scripts)"
extra_ca=()
if [ -n "${BUILD_EXTRA_CA:-}" ]; then extra_ca=(--secret "id=extra_ca,src=$BUILD_EXTRA_CA"); fi
# Proxy HTTPS du poste, s'il y en a un (polices Google téléchargées au build). Docker ne garde pas
# ces arguments dans l'historique de l'image.
for var in HTTPS_PROXY NO_PROXY; do
  if [ -n "${!var:-}" ]; then extra_ca+=(--build-arg "$var=${!var}"); fi
done
docker build "${extra_ca[@]}" --target tools -t "agora-tools:$TAG" .

step "Base de données"
compose up -d --wait postgres

psql_q() { compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$1"' -- "$1"; }
has_schema="$(psql_q "select count(*) from information_schema.tables where table_name = '_prisma_migrations'")"

if [ "$has_schema" = "1" ]; then
  step "Sauvegarde avant migration"
  bash scripts/backup-prod.sh --label avant-deploiement --local-only
fi

step "Migrations Prisma"
APP_TAG="$TAG" compose run --rm -T tools pnpm db:deploy

roles="$(psql_q 'select count(*) from "Role"')"
if [ "$roles" = "0" ]; then
  step "Première installation : données de référence (seed)"
  APP_TAG="$TAG" compose run --rm -T tools pnpm db:seed
fi

# --- Image du site -------------------------------------------------------------------------------
step "Image du site (next build, contre la base via 127.0.0.1:$BUILD_DB_PORT)"
cleanup_tunnel() { compose --profile build rm -sf build-db-tunnel > /dev/null 2>&1 || true; }
trap cleanup_tunnel EXIT
compose --profile build up -d build-db-tunnel
for _ in $(seq 1 20); do
  (exec 3<>"/dev/tcp/127.0.0.1/$BUILD_DB_PORT") 2>/dev/null && break
  sleep 1
done
docker build "${extra_ca[@]}" --network host \
  --secret "id=env,src=$ENV_FILE" \
  --build-arg "BUILD_DB_PORT=$BUILD_DB_PORT" \
  -t "agora-app:$TAG" .
cleanup_tunnel
trap - EXIT

# --- Mise en service ------------------------------------------------------------------------------
step "Mise en service"
current="$(cat "$STATE_DIR/current" 2>/dev/null || true)"
docker tag "agora-app:$TAG" agora-app:current
docker tag "agora-tools:$TAG" agora-tools:current
APP_TAG=current compose up -d --wait --wait-timeout 120 app caddy
if [ -n "$current" ] && [ "$current" != "$TAG" ]; then echo "$current" > "$STATE_DIR/previous"; fi
echo "$TAG" > "$STATE_DIR/current"

step "Contrôle"
code="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' --max-time 20 --resolve "$SITE_DOMAIN:443:127.0.0.1" \
  ${CURL_INSECURE:+-k} "https://$SITE_DOMAIN/" || true)"
[ "$code" = "200" ] || fail "la page d'accueil répond $code (bash scripts/prod-compose.sh logs app caddy). Retour possible : bash scripts/deploy.sh --rollback"

# Ménage : on garde les trois dernières versions de chaque image.
for repo in agora-app agora-tools; do
  docker images "$repo" --format '{{.Tag}}' | grep -vE '^(current|<none>)$' | tail -n +4 \
    | xargs -r -I{} docker rmi "$repo:{}" > /dev/null 2>&1 || true
done
docker image prune -f > /dev/null

echo
echo "En ligne : https://$SITE_DOMAIN (version $TAG)."

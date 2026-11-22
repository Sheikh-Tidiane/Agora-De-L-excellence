#!/usr/bin/env bash
# docker compose de production, avec le bon fichier d'environnement.
#
#   bash scripts/prod-compose.sh ps
#   bash scripts/prod-compose.sh logs -f app
#   bash scripts/prod-compose.sh run --rm -it tools pnpm create-admin
#
# ENV_FILE : fichier d'environnement (défaut : .env.production, à la racine du dépôt).
# COMPOSE_EXTRA : fichier compose supplémentaire (essai local : docker-compose.prod-local.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.production}"
export ENV_FILE
test -f "$ENV_FILE" || { echo "Fichier d'environnement introuvable : $ENV_FILE (modèle : .env.production.example)" >&2; exit 1; }

files=(-f docker-compose.prod.yml)
if [ -n "${COMPOSE_EXTRA:-}" ]; then files+=(-f "$COMPOSE_EXTRA"); fi

exec docker compose --env-file "$ENV_FILE" "${files[@]}" "$@"

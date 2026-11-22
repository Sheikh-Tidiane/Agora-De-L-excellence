#!/usr/bin/env bash
# Sauvegarde de production : base (pg_dump) + fichiers téléversés, copie chiffrée hors du serveur.
#
#   bash scripts/backup-prod.sh                       sauvegarde complète (lancée chaque nuit par systemd)
#   bash scripts/backup-prod.sh --label avant-x       nom repérable (ex. avant un déploiement)
#   bash scripts/backup-prod.sh --local-only          sans copie distante ni alerte
#
# Réglages : fichier BACKUP_ENV (défaut /etc/agora/backup.env, modèle deploy/backup.env.example) :
#   BACKUP_DIR           dossier local                            (défaut /var/backups/agora)
#   KEEP_DAYS            jours gardés sur place                   (défaut 14)
#   AGE_RECIPIENTS_FILE  clé(s) PUBLIQUE(S) age : la copie distante est chiffrée pour elles
#   RCLONE_REMOTE        destination rclone (ex. b2:agora-sauvegardes) ; vide = pas de copie distante
#   RCLONE_CONFIG        fichier de configuration rclone           (défaut /etc/agora/rclone.conf)
#   HEALTHCHECK_URL      adresse de surveillance (healthchecks.io) : start / succès / échec
#
# Produit dans BACKUP_DIR :
#   agora-AAAAMMJJ-HHMMSS[-label].dump        base, format « custom » de pg_dump
#   uploads-AAAAMMJJ-HHMMSS[-label].tar.gz    fichiers téléversés (volume Docker `uploads`)
#   SHA256SUMS-AAAAMMJJ-HHMMSS[-label]        empreintes des deux fichiers
# Sur place, les fichiers restent en clair (le serveur détient déjà la base) ; hors du serveur, ils
# ne partent que chiffrés. Le serveur n'a que la clé publique : il ne peut pas relire la copie distante.
set -euo pipefail
cd "$(dirname "$0")/.."

LABEL=""
LOCAL_ONLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="-${2:?--label demande un nom}"; shift 2 ;;
    --local-only) LOCAL_ONLY=1; shift ;;
    *) echo "Option inconnue : $1" >&2; exit 2 ;;
  esac
done

BACKUP_ENV="${BACKUP_ENV:-/etc/agora/backup.env}"
# shellcheck disable=SC1090
if [ -f "$BACKUP_ENV" ]; then set -a; . "$BACKUP_ENV"; set +a; fi
BACKUP_DIR="${BACKUP_DIR:-/var/backups/agora}"
KEEP_DAYS="${KEEP_DAYS:-14}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
HEALTHCHECK_URL="${HEALTHCHECK_URL:-}"
export RCLONE_CONFIG="${RCLONE_CONFIG:-/etc/agora/rclone.conf}"
PROJECT="${COMPOSE_PROJECT:-agora-prod}"
[ "$LOCAL_ONLY" = 1 ] && HEALTHCHECK_URL=""

ping_hc() { [ -z "$HEALTHCHECK_URL" ] || curl -fsS -m 10 --retry 3 -o /dev/null "$HEALTHCHECK_URL$1" || true; }
on_exit() {
  status=$?
  rm -rf "${WORK:-}"
  if [ "$status" -ne 0 ]; then echo "ÉCHEC de la sauvegarde (code $status)" >&2; ping_hc /fail; fi
}
trap on_exit EXIT
ping_hc /start

umask 077
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%d-%H%M%S)$LABEL"
DUMP="$BACKUP_DIR/agora-$STAMP.dump"
UPLOADS="$BACKUP_DIR/uploads-$STAMP.tar.gz"
SUMS="$BACKUP_DIR/SHA256SUMS-$STAMP"
WORK="$(mktemp -d)"

# --- Base ----------------------------------------------------------------------------
bash scripts/prod-compose.sh exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-privileges' > "$DUMP.part"
mv "$DUMP.part" "$DUMP"
test -s "$DUMP" || { echo "Sauvegarde vide : $DUMP" >&2; exit 1; }
TABLES="$(bash scripts/prod-compose.sh exec -T postgres pg_restore --list < "$DUMP" | grep -c 'TABLE DATA' || true)"
[ "$TABLES" -gt 0 ] || { echo "Sauvegarde illisible : $DUMP" >&2; exit 1; }

# --- Fichiers téléversés (lecture seule du volume, sans réseau) --------------------------
docker run --rm --network none -v "${PROJECT}_uploads:/uploads:ro" postgres:17-alpine \
  tar -czf - -C /uploads . > "$UPLOADS.part"
mv "$UPLOADS.part" "$UPLOADS"
FILES="$(tar -tzf "$UPLOADS" | grep -vc '/$' || true)"

(cd "$BACKUP_DIR" && sha256sum "$(basename "$DUMP")" "$(basename "$UPLOADS")") > "$SUMS"

# --- Copie hors du serveur, chiffrée ---------------------------------------------------------
if [ "$LOCAL_ONLY" = 0 ] && [ -n "$RCLONE_REMOTE" ]; then
  [ -s "${AGE_RECIPIENTS_FILE:-}" ] || { echo "AGE_RECIPIENTS_FILE manquant : rien ne part en clair." >&2; exit 1; }
  for f in "$DUMP" "$UPLOADS" "$SUMS"; do
    age -R "$AGE_RECIPIENTS_FILE" -o "$WORK/$(basename "$f").age" "$f"
  done
  # `copy` et jamais `sync` : rien n'est supprimé à distance. --immutable : rien n'est écrasé.
  rclone copy --immutable --no-traverse "$WORK" "$RCLONE_REMOTE/${STAMP:0:8}/"
  rclone check -q --one-way "$WORK" "$RCLONE_REMOTE/${STAMP:0:8}/" > /dev/null
  REMOTE="copie chiffrée envoyée vers $RCLONE_REMOTE/${STAMP:0:8}/"
else
  REMOTE="pas de copie distante"
fi

# --- Ménage sur place --------------------------------------------------------------------------
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'agora-*.dump' -o -name 'uploads-*.tar.gz' -o -name 'SHA256SUMS-*' \) \
  -mtime +"$KEEP_DAYS" -delete

ping_hc ""
echo "Sauvegarde $STAMP : base $(wc -c < "$DUMP" | tr -d ' ') octets ($TABLES tables), $FILES fichier(s) téléversé(s) ; $REMOTE."

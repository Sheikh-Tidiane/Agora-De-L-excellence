# Image de production du site (Next.js en mode « standalone »).
#
# Ne se construit pas à la main : `scripts/deploy.sh` s'en charge (voir docs/DEPLOIEMENT.md).
#
# Pourquoi la construction a besoin de la base : avec `cacheComponents`, `next build` pré-rend les
# pages publiques et appelle `generateStaticParams` (rencontres, livres, articles), qui lisent
# PostgreSQL. Sans base joignable, le build échoue (« DatabaseNotReachable »). Le script de
# déploiement ouvre donc, le temps du build seulement, un tunnel vers la base sur 127.0.0.1
# (jamais sur internet) et construit avec `--network host`.
#
# Les variables (.env.production) arrivent par un « secret » de build : elles ne sont écrites dans
# aucune couche de l'image. Les valeurs non secrètes (APP_URL, CONTACT_EMAIL…) doivent être les
# vraies, car certaines pages pré-rendues les reprennent.
#
# Cibles :
#   runner (défaut) : le site, ~200 Mo, utilisateur non root, sans pnpm ni sources.
#   tools           : dépendances complètes + sources, pour les migrations Prisma, le seed,
#                     `create-admin` et l'export des contenus. Lancé à la demande, jamais exposé.

ARG NODE_IMAGE=node:22-bookworm-slim

# --- Dépendances ---------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm \
    COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY prisma ./prisma
# `prisma generate` (postinstall) exige une DATABASE_URL, même s'il ne s'y connecte pas.
# `extra_ca` (facultatif) : certificat d'un proxy HTTPS d'entreprise, si le poste qui construit
# en a un (BUILD_EXTRA_CA dans scripts/deploy.sh). Inutile sur le serveur.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi && \
    DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build" \
    pnpm install --frozen-lockfile

# --- Outils (migrations, seed, scripts d'administration) ------------------------
FROM deps AS tools
COPY . .
USER node
CMD ["pnpm", "db:deploy"]

# --- Construction ----------------------------------------------------------------
FROM deps AS builder
COPY . .
ARG BUILD_DB_PORT=55432
ENV NODE_ENV=production
# Le fichier d'environnement est lu depuis le secret (monté le temps de cette commande, jamais
# copié), la DATABASE_URL pointe vers le tunnel local, et le secret des sessions est remplacé par
# une valeur jetable : aucune page pré-rendue ne dépend de lui.
RUN --mount=type=secret,id=env,required=true \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi && \
    set -a && . /run/secrets/env && set +a && \
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${BUILD_DB_PORT}/${POSTGRES_DB}?schema=public" && \
    export BETTER_AUTH_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))")" && \
    pnpm build

# --- Exécution ---------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UPLOAD_DIR=/app/uploads
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# Le volume des fichiers téléversés est monté ici ; créé à l'avance pour appartenir à `node`.
RUN mkdir -p /app/uploads && chown node:node /app/uploads /app /app/.next
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]

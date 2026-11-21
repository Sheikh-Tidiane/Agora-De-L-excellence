# L’Agora de l’Excellence

Plateforme web du club de lecture et de Scrabble « L’Agora de l’Excellence », à Dakar : site
public, adhésion en ligne, espace membre (lectures, rencontres, carte de membre avec QR code,
points et badges, Scrabble, quiz, assistant « Le Compagnon des Lettres ») et administration.

- Interface en français, conçue d'abord pour le téléphone.
- Règles du club : [`docs/REGLES-METIER.md`](docs/REGLES-METIER.md). Choix techniques :
  [`docs/DECISIONS.md`](docs/DECISIONS.md). Bilan : [`docs/RAPPORT-LIVRAISON.md`](docs/RAPPORT-LIVRAISON.md).
- Guide des responsables : [`docs/GUIDE-ADMINISTRATEUR.md`](docs/GUIDE-ADMINISTRATEUR.md).
  Sauvegarde : [`docs/SAUVEGARDE.md`](docs/SAUVEGARDE.md). Hébergement :
  [`docs/HEBERGEMENT.md`](docs/HEBERGEMENT.md).

## Pile technique

Next.js (App Router) et TypeScript strict · Tailwind CSS · PostgreSQL et Prisma (migrations
versionnées) · Better Auth (e-mail et mot de passe, sessions en base) · Zod · e-mails par SMTP
(Mailpit en développement) ou Resend · Vitest et Playwright · pnpm.

## Prérequis

- Node.js LTS (testé avec 22) et pnpm (`corepack enable` suffit : la version est fixée dans
  `package.json`).
- Docker, pour PostgreSQL et Mailpit en local.

## Installation

```bash
pnpm install
cp .env.example .env
```

Dans `.env`, renseigner au minimum `BETTER_AUTH_SECRET` (32 caractères ou plus) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Toutes les variables sont décrites dans [`.env.example`](.env.example) et vérifiées au démarrage
(`src/lib/env.ts`). Sans `LLM_API_KEY`, tout fonctionne et l'assistant affiche « Assistant non
connecté ».

## Base de données

```bash
docker compose up -d          # PostgreSQL (port 5433) et Mailpit (http://localhost:8025)
pnpm db:migrate               # applique les migrations (développement)
pnpm db:seed                  # barème, badges, niveaux et données de démonstration
```

- Le seed est idempotent : il peut être relancé sans créer de doublons.
- Les données de démonstration sont marquées `isDemo` ; un bandeau l'indique sur le site tant
  qu'il en reste. Pour les retirer : `pnpm db:clear-demo`.
- En production, appliquer les migrations avec `pnpm db:deploy` (jamais `db push`).

## Compte super-administrateur

```bash
pnpm create-admin
```

Le script demande l'adresse e-mail et le mot de passe dans le terminal. Aucun compte
d'administration n'est créé par le seed.

## Lancer

```bash
pnpm dev                      # http://localhost:3000
pnpm dev:lan                  # ouvert au réseau local, pour essayer sur un téléphone
```

Production : `pnpm build` puis `pnpm start`. Les e-mails envoyés en développement arrivent dans
Mailpit (http://localhost:8025).

## Vérifier

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e
```

- `pnpm test` : tests unitaires et de services (Vitest). Une partie tourne contre la vraie base
  PostgreSQL dans des transactions annulées ; sans base joignable, ces tests sont sautés.
- `pnpm test:e2e` : parcours Playwright sur un build de production servi sur le port 3210
  (`PW_DEV=1` pour le serveur de développement), en émulation mobile et ordinateur. Ils
  utilisent Mailpit pour suivre les liens reçus par e-mail. Edge est utilisé par défaut sous
  Windows (`PW_CHANNEL=chromium` ailleurs).

## Scripts utiles

| Commande                                  | Rôle                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| `bash scripts/backup.sh`                  | Sauvegarde de la base et des images (`backups/`)     |
| `bash scripts/restore-check.sh <fichier>` | Restauration d'essai dans une base temporaire        |
| `node scripts/lighthouse.mjs`             | Lighthouse mobile sur les pages clés (build servi)   |
| `pnpm captures [dossier] [chemin…]`       | Captures 375 / 768 / 1440 px pour le contrôle visuel |

## Organisation du code

```
src/app/(public)   site public          src/app/member   espace membre
src/app/(auth)     connexion, comptes   src/app/admin    administration
src/app/api        Route Handlers (assistant, scan, exports…)
src/features/<domaine>   actions, requêtes, schémas Zod, services, composants
src/lib            prisma, auth, permissions, mail, limites de débit, audit, LLM
src/config         nom du club, navigation, activités
prisma/            schéma, migrations, seed
```

Toute la logique métier vit dans `src/features/*/service.ts` (testable sans React). Chaque Server
Action et chaque Route Handler commence par un contrôle d'accès et valide ses entrées avec Zod.

# DEPLOIEMENT.md — Mettre le site en ligne

> État au 22 novembre 2026 : **rien n'est en ligne**. La configuration de production a été essayée
> de bout en bout sur un poste, avec un faux domaine (section « Essai en local »). La procédure sur
> le serveur OVHcloud sera complétée à l'étape suivante.

## Essai en local

But : faire tourner **exactement** la configuration de production (mêmes images, même
`docker-compose.prod.yml`, même Caddy, HTTPS compris) sur un poste, avant d'acheter quoi que ce soit.
Seules différences : un faux domaine (`agora.test`), un certificat de l'autorité interne de Caddy
au lieu de Let's Encrypt, et Mailpit à la place du vrai fournisseur d'e-mails
(`docker-compose.prod-local.yml`).

### Préparer

1. Faire pointer le faux domaine vers le poste, dans le fichier `hosts`
   (`/etc/hosts` sous Linux et macOS, `C:\Windows\System32\drivers\etc\hosts` sous Windows) :

   ```
   127.0.0.1 agora.test www.agora.test
   ```

2. Créer `.env.production.local` à partir de `.env.production.example` (le fichier est ignoré par Git),
   avec : `SITE_DOMAIN="agora.test"`, `CADDY_TLS="internal"`, `APP_URL="https://agora.test"`,
   `SMTP_HOST="mailpit"`, `SMTP_PORT="1025"`, `MAIL_FROM="ne-pas-repondre@agora.test"`, et un
   `POSTGRES_PASSWORD` et un `BETTER_AUTH_SECRET` générés par `openssl rand -hex 32`.
   Puis `chmod 600 .env.production.local`.
3. Les ports 80 et 443 du poste doivent être libres.

### Lancer

```bash
export ENV_FILE=.env.production.local COMPOSE_EXTRA=docker-compose.prod-local.yml CURL_INSECURE=1
```

```bash
bash scripts/deploy.sh --no-pull
```

Le premier lancement construit les images (≈ 3 minutes), applique les migrations et le seed.
Ensuite : créer le super-administrateur, comme en production :

```bash
bash scripts/prod-compose.sh run --rm tools pnpm create-admin
```

Site : <https://agora.test> (le navigateur avertit que le certificat est inconnu : normal, c'est
le certificat local de Caddy). E-mails reçus : <http://127.0.0.1:8025>.

### Vérification automatique

```bash
pnpm test:prod
```

`e2e-prod/parcours-production.spec.ts` joue, en boîte noire (sans toucher à la base) :

1. création du super-administrateur avec `create-admin` dans le conteneur d'outils ;
2. demande d'adhésion depuis le site public → accusé de réception dans Mailpit ;
3. validation par l'administrateur → e-mail d'activation, dont le lien est en `https://agora.test` ;
4. activation du compte, connexion ; cookie de session `Secure` et `HttpOnly` ;
5. photo de profil téléversée, servie à la personne connectée seulement (401 sans session, 404 par
   l'adresse publique `/uploads`) ;
6. recréation du conteneur du site : la photo (volume `uploads`) et la session sont toujours là ;
7. photo d'un membre du comité, visible sur la page « Le club », puis retirée ;
8. les 21 pages de l'administration et les 12 pages publiques principales s'affichent sans erreur ;
   `sitemap.xml` et `robots.txt` donnent les adresses du domaine.

### Résultat du 22 novembre 2026

Tout passe (3 parcours sur 3), après correction de ce qui suit.

| Constat                                                                                                      | Correction                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `next build` échoue sans base (« DatabaseNotReachable ») : les pages publiques sont pré-rendues avec la base | build contre la base, par un tunnel ouvert sur `127.0.0.1` le temps du build seulement (`build-db-tunnel`, `scripts/deploy.sh`) |
| `prisma generate` exige `DATABASE_URL` même sans s'y connecter                                               | valeur fictive à l'installation des dépendances (`Dockerfile`)                                                                  |
| `deploy.sh` ne démarrait que le site et Caddy : un service ajouté (ici Mailpit) restait arrêté               | démarrage de toute la pile (`up -d --wait --remove-orphans`)                                                                    |
| Contrôle final de `deploy.sh` passé par le proxy HTTPS du poste                                              | `curl --noproxy '*'`                                                                                                            |

Vérifié aussi :

- PostgreSQL n'a **aucun port publié** (`docker ps`) et n'est que sur le réseau interne ; le site
  n'est joignable que par Caddy.
- Redirections `http://` → `https://` (308) et `www.` → domaine nu (301) ; en-têtes HSTS,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy` et ceux de `next.config.ts`.
- Caddy **remplace** un `X-Forwarded-For` ou un `X-Forwarded-Host` envoyé par le visiteur, et retire
  `X-Real-IP` : la limitation de débit par adresse ne peut pas être trompée.
- Aucun secret dans l'image : recherche du mot de passe de la base et du secret des sessions dans
  tout le système de fichiers de l'image, sans résultat ; l'image tourne sous l'utilisateur `node`.
- Mise à jour (second déploiement) : sauvegarde automatique avant migration, migrations, nouvelle
  image, ≈ 2 minutes ; `bash scripts/deploy.sh --rollback` revient à l'image précédente, et
  inversement.

Sans incidence en production : avec le certificat local, le navigateur refuse d'installer le
service worker (« SSL certificate error ») ; avec un vrai certificat, il s'installe.

## Transférer les contenus

But : mettre en production les vrais contenus saisis sur le poste (livres, auteurs, catégories,
comité, charte, lancement, articles et rencontres), **sans** les comptes ni les données de test.

### Ce qui part, ce qui ne part pas

| Exporté                                                        | Jamais exporté                                                                    |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| catégories, auteurs, livres et leurs couvertures               | comptes, rôles attribués, sessions                                                |
| comité de pilotage et ses photos                               | demandes d'adhésion (dont les trois « Démonstration »), adhésions, encaissements  |
| charte (texte, version, mention « provisoire »)                | inscriptions aux rencontres, lectures et critiques, points, badges, notifications |
| rencontres (lancement compris) et leurs comptes rendus, images | journal d'audit, photos de profil                                                 |
| articles et leurs images                                       | livres du mois, quiz, tournois et records de Scrabble (**sur demande** seulement) |
|                                                                | autres réglages : identité du club, tarifs, contacts (à ressaisir dans l'admin)   |

Les liens vers un compte (auteur d'un article, créateur d'une rencontre) sont retirés : ces comptes
n'existent pas en production.

**Écarté comme donnée de test** : un titre ou un nom qui commence par `E2E` (tests automatiques) ou
`Essai-` (essai de production), un contenu encore marqué « démonstration », ou un contenu créé par
un compte `@e2e.agora.test`, `@essai.agora.test` ou `@demo.agora.test`. La catégorie « Essai »
(le genre littéraire) n'est pas concernée : ce piège a été vu à l'essai et corrigé.

### 1. Aperçu, sur le poste (ne modifie rien)

```bash
pnpm exec tsx scripts/contenus-export.ts
```

Affiche, et écrit dans `export-contenus/APERCU.md`, la liste de **tout** ce qui serait exporté,
titre par titre, puis ce qui est écarté comme donnée de test et ce qui n'est jamais exporté. C'est
cette liste qui se relit et se valide avant d'aller plus loin. Le dossier `export-contenus/` est
ignoré par Git et par Docker.

### 2. Export, sur le poste

```bash
pnpm exec tsx scripts/contenus-export.ts --exporter
```

Écrit `export-contenus/contenus.json` et les images citées dans `export-contenus/uploads/` (avec
leur empreinte SHA-256). Puis, depuis le poste :

```bash
scp -r export-contenus agora@<adresse-du-serveur>:/srv/agora/
```

### 3. Simulation, puis import, sur le serveur

```bash
bash scripts/prod-compose.sh run --rm -v "$PWD/export-contenus:/import:ro" tools pnpm exec tsx scripts/contenus-import.ts /import
```

La simulation liste ce qui sera créé (`+`), mis à jour (`~`), retiré du comité (`-`), les images à
copier, et ce qui existe en production sans être dans l'export (laissé tel quel). Si c'est bon :

```bash
bash scripts/backup-prod.sh --label avant-import
```

```bash
bash scripts/prod-compose.sh run --rm -v "$PWD/export-contenus:/import:ro" tools pnpm exec tsx scripts/contenus-import.ts /import --appliquer
```

```bash
bash scripts/deploy.sh --no-pull
```

(la reconstruction met les pages pré-rendues à jour tout de suite ; sans elle, elles le sont en une
minute environ). Enfin, effacer l'export du serveur : `rm -rf export-contenus`.

Règles de l'import : rapprochement par adresse (slug), par nom pour le comité, par clé pour la
charte ; ce qui existe est mis à jour, ce qui manque est créé, en une seule transaction. Seul le
comité est remplacé en entier. Rien d'autre n'est supprimé. Les images sont vérifiées (empreinte)
et jamais écrasées. Relancé, l'import ne change plus rien. Il est noté dans le journal d'audit
(« Contenus importés »).

### Essai du 22 novembre 2026 (en local)

Sur une base de développement remplie de contenus de démonstration et de données de test
(`E2E-Debat…`, `E2E-P3 Auteur…`, `E2E-Comite…`, un article écrit par un compte `@e2e.agora.test`),
importés dans la pile de production : les quatre données de test sont écartées, la catégorie
« Essai » est gardée (après correction), les deux images arrivent intactes, le lancement et les
catégories déjà semés en production sont mis à jour sans doublon, et un second passage n'a plus
rien à créer ni à copier. Le livre, sa couverture et le rôle d'un membre du comité s'affichent sur
le site.

# DEPLOIEMENT.md — Mettre le site en ligne

> État au 22 novembre 2026 : **rien n'est en ligne, rien n'est commandé.** La configuration de
> production a été essayée de bout en bout sur un poste avec un faux domaine (« Essai en local »),
> et le script de sécurisation du serveur sur un Ubuntu 24.04 de test. Aucune action ne sera faite
> en production sans ta validation (voir `docs/REVUE-MISE-EN-LIGNE.md`).
>
> Hébergement retenu : OVHcloud VPS-1, Ubuntu 24.04 LTS, domaine en .com (`docs/HEBERGEMENT.md`).

Dans ce guide, `agora-exemple.com` désigne le futur domaine et `203.0.113.10` l'adresse IPv4 du
serveur : à remplacer par les vraies valeurs.

## Vue d'ensemble

| Qui          | Quoi                                                                                                | Section |
| ------------ | --------------------------------------------------------------------------------------------------- | ------- |
| **Toi**      | comptes au nom du club, commande du VPS et du domaine, clé SSH, DNS, e-mails, comptes de sauvegarde | A       |
| **Moi**      | sécurisation du serveur, installation, secrets, premier déploiement, sauvegardes, vérifications     | B       |
| **Ensemble** | transfert des contenus (tu valides la liste), recette en ligne, ouverture                           | C       |
| Ensuite      | chaque nouvelle version : **une commande**                                                          | D       |

---

## A. Ce que tu fais (chez OVHcloud et ailleurs)

Je ne crée aucun compte et ne saisis aucun moyen de paiement. Chaque compte est ouvert **au nom du
club**, avec la **double authentification**, et connu de **deux personnes**.

### A1. Ta clé SSH (sur ton poste, une fois)

La clé SSH remplace le mot de passe pour entrer sur le serveur. Sous Windows (PowerShell), macOS
ou Linux :

```bash
ssh-keygen -t ed25519 -C "agora-serveur"
```

Accepte l'emplacement proposé et choisis une **phrase de passe**. Deux fichiers sont créés :
`id_ed25519` (privé : ne le donne à personne, ni à moi) et `id_ed25519.pub` (public : c'est lui
qu'on colle chez OVHcloud). Affiche la clé publique avec `cat ~/.ssh/id_ed25519.pub`
(PowerShell : `Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub`).

Pour que je puisse intervenir sur le serveur, ajoute aussi **ma** clé publique, que je te donnerai
au moment voulu, et celle d'un second membre du bureau : personne ne doit être seul à pouvoir entrer.

### A2. Compte OVHcloud

1. Créer le compte sur ovhcloud.com (au nom du club ou de l'association), puis activer la double
   authentification : _Mon compte_ → _Sécurité_ → _Double authentification_ (application ou clé).
2. Ajouter ta clé SSH : _Mon compte_ → _Mes clés SSH_ → _Ajouter une clé_, coller le contenu de
   `id_ed25519.pub`.

### A3. Commander le VPS

_Bare Metal Cloud_ → _Serveurs privés virtuels_ → _Commander_ :

- modèle : **VPS-1** ;
- localisation : **France** (Gravelines, Roubaix ou Strasbourg) ;
- système : **Ubuntu 24.04** (« Distribution seule », sans application préinstallée) ;
- clé SSH : la tienne (A1) ;
- option de sauvegarde automatique : garder celle incluse, s'il y en a une (filet en plus des nôtres) ;
- durée : mensuelle.

Tu reçois un e-mail avec l'**adresse IPv4** du serveur et le nom d'utilisateur (`ubuntu`). Teste :

```bash
ssh ubuntu@203.0.113.10
```

Repère dans l'espace client la **console KVM** et le **mode rescue** du VPS : c'est l'issue de
secours si l'accès SSH est perdu.

### A4. Commander le domaine .com

_Web Cloud_ → _Noms de domaine_ → _Commander_. Vérifier la disponibilité du nom choisi, le prendre
**au nom du club**, avec le **renouvellement automatique** activé (un domaine expiré, c'est le site
et les e-mails coupés). Garder les DNS chez OVHcloud.

### A5. Les enregistrements DNS

_Web Cloud_ → _Noms de domaine_ → le domaine → _Zone DNS_ :

| Type  | Sous-domaine | Cible                       | Pourquoi                                                    |
| ----- | ------------ | --------------------------- | ----------------------------------------------------------- |
| `A`   | (vide)       | `203.0.113.10`              | le site                                                     |
| `A`   | `www`        | `203.0.113.10`              | `www.` redirige vers le domaine nu                          |
| `CAA` | (vide)       | `0 issue "letsencrypt.org"` | seul Let's Encrypt peut délivrer un certificat pour le site |

- **Pas d'enregistrement `AAAA` (IPv6) pour l'instant**, et supprimer celui qu'OVHcloud aurait
  créé par défaut : l'IPv6 n'est pas configurée côté Docker, et sans elle les visiteurs en IPv6
  n'atteindraient pas le site ou partageraient tous la même adresse pour la limitation de débit.
- Supprimer aussi les `A` par défaut qui pointent vers un hébergement « parking » d'OVHcloud.
- La propagation prend de quelques minutes à quelques heures. Vérifier avec
  `nslookup agora-exemple.com` : la réponse doit être l'adresse du VPS.

### A6. Les e-mails (Brevo)

1. Compte Brevo au nom du club (à ouvrir **tôt** : l'envoi doit être approuvé).
2. _Expéditeurs, domaines_ → ajouter le domaine : Brevo affiche les enregistrements **SPF**
   (`TXT`), **DKIM** (`TXT` ou `CNAME`) et le code de vérification ; les ajouter dans la zone DNS
   (A5). Ajouter aussi un **DMARC** : `TXT` sur `_dmarc`, valeur
   `v=DMARC1; p=none; rua=mailto:<adresse du club>` (on durcira en `p=quarantine` après un mois).
3. _SMTP et API_ → créer une clé SMTP. Me transmettre l'identifiant et la clé **par un canal sûr**
   (gestionnaire de mots de passe partagé, pas par e-mail ni messagerie) : ils iront dans
   `.env.production`, sur le serveur seulement.

### A7. Sauvegardes et surveillance

- Compte **Backblaze B2** et compte **healthchecks.io** : `docs/SAUVEGARDE.md`, « Mise en place »,
  étapes 2 et 3.
- La **paire de clés de chiffrement** des sauvegardes : `docs/SAUVEGARDE.md`, étape 1. La clé
  privée reste chez deux membres du bureau ; on ne m'envoie que la clé **publique**.

### A8. Accès au dépôt depuis le serveur

Le serveur récupère le code sur GitHub en **lecture seule**. Je te donnerai une clé publique
générée sur le serveur ; tu l'ajoutes dans le dépôt : _Settings_ → _Deploy keys_ → _Add deploy key_,
**sans** cocher « Allow write access ».

---

## B. Ce que je fais sur le serveur

### B1. Sécurisation (`deploy/serveur-installation.sh`)

Connecté en `ubuntu` (le compte créé par OVHcloud), je copie le script et je le lance :

```bash
scp deploy/serveur-installation.sh ubuntu@203.0.113.10:
```

```bash
ssh ubuntu@203.0.113.10 'sudo bash serveur-installation.sh'
```

Il fait, et peut être relancé sans risque :

| Mesure                    | Détail                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Mises à jour              | `apt full-upgrade`, fuseau horaire UTC (= heure de Dakar, sans changement d'heure)                                                                                                         |
| Utilisateur non-root      | `agora`, membre de `sudo` et `docker`, avec les clés SSH du compte `ubuntu` ; s'arrête **avant** de toucher à SSH si aucune clé n'est en place                                             |
| SSH par clé seulement     | mot de passe désactivé, `root` interdit, seul `agora` autorisé, 3 essais (`/etc/ssh/sshd_config.d/10-agora.conf`, lu avant le fichier de cloud-init) ; rechargé **sans couper** la session |
| Pare-feu                  | ufw : tout fermé en entrée sauf 22 (limité contre les rafales), 80, 443 (et 443/udp pour HTTP/3)                                                                                           |
| fail2ban                  | prison SSH : 5 échecs en 10 min → bannissement 1 h, durée doublée à chaque récidive                                                                                                        |
| Mises à jour automatiques | correctifs de sécurité chaque jour, redémarrage automatique à 04:30 UTC si nécessaire ; le site redémarre seul (`restart: unless-stopped`)                                                 |
| Mémoire et journaux       | 2 Go d'échange, journal système limité à 500 Mo / 1 mois, journaux Docker en rotation (5 × 10 Mo par conteneur)                                                                            |
| Docker                    | dépôt officiel ; `userland-proxy` désactivé pour que Caddy voie la vraie adresse des visiteurs                                                                                             |
| Dossiers                  | `/srv/agora` (le site), `/etc/agora` (réglages des sauvegardes), `/var/backups/agora`                                                                                                      |

Avant de fermer la session, je vérifie dans une **seconde** session que `ssh agora@203.0.113.10`
fonctionne. À partir de là, plus personne n'entre par mot de passe ni en `root`.

Le pare-feu et Docker : un port publié par Docker contourne ufw. Seul Caddy publie des ports (80
et 443, ouverts de toute façon) ; la base et le site n'en publient **aucun**
(`docker-compose.prod.yml`). Le tunnel du build écoute sur `127.0.0.1` seulement, pendant le build.
Contrôle après chaque modification : `sudo ss -tlnp` ne doit montrer que 22, 80, 443 (et
`127.0.0.1:55432` pendant un build).

**Essai du 22/11/2026** sur un Ubuntu 24.04 de test (conteneur avec systemd) : script complet sans
erreur, relancé deux fois sans dégât ; connexion par clé de `agora` acceptée (`sudo` et Docker
opérationnels), `root` refusé, mot de passe refusé ; ufw, fail2ban et mises à jour automatiques
actifs. Seule l'étape d'échange n'a pas pu être essayée (système de fichiers du conteneur) : le
script continue alors avec un avertissement.

### B2. Le code et les secrets

```bash
ssh agora@203.0.113.10
```

```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/github-lecture -C "agora-serveur-lecture" && cat ~/.ssh/github-lecture.pub
```

(clé à ajouter comme _Deploy key_ en lecture seule, A8), puis :

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/github-lecture\n  IdentitiesOnly yes\n' >> ~/.ssh/config
```

```bash
git clone git@github.com:sheikh-tidiane/agora-de-l-excellence.git /srv/agora
```

```bash
cd /srv/agora && cp .env.production.example .env.production && chmod 600 .env.production
```

Je remplis `.env.production` : domaine, `APP_URL`, mot de passe de la base et secret des sessions
(générés sur place par `openssl rand -hex 32`, jamais transmis), accès SMTP Brevo, adresse
d'expédition, adresse de contact, `CADDY_TLS` (adresse e-mail du club pour Let's Encrypt). Une
copie chiffrée part hors du serveur (`docs/SAUVEGARDE.md`, étape 6).

### B3. Premier déploiement

```bash
bash scripts/deploy.sh
```

Construit les images, crée la base, applique les migrations Prisma et le seed (rôles,
permissions, barème, catégories, comité, lancement), démarre le site ; Caddy obtient le certificat
Let's Encrypt au premier accès (il faut que le DNS pointe déjà vers le serveur). Puis le
super-administrateur, avec ton adresse et un mot de passe que **tu** tapes :

```bash
bash scripts/prod-compose.sh run --rm tools pnpm create-admin
```

### B4. Sauvegardes

`docs/SAUVEGARDE.md`, « Mise en place », étapes 4 à 6 : réglages dans `/etc/agora`, minuteries
systemd, premier essai, contrôle dans B2 et healthchecks.io, puis **une restauration complète
sur le serveur** avant l'ouverture.

### B5. Vérifications avant ouverture

- `https://agora-exemple.com` : certificat valide ; `http://` et `www.` redirigent.
- `sudo ufw status`, `sudo ss -tlnp` (seulement 22, 80, 443), `sudo fail2ban-client status sshd`.
- Un e-mail de test vers une adresse Gmail et une Outlook : arrivé en boîte de réception, SPF,
  DKIM et DMARC à « PASS » (afficher l'original du message).
- L'adresse vue par le site est bien celle du visiteur (limitation de débit : 20 connexions par
  adresse et par quart d'heure) : envoyer depuis un poste `curl -H "X-Forwarded-For: 1.2.3.4"`
  vers le site et vérifier, dans la table `RateLimit`, que la clé enregistrée correspond à
  l'adresse réelle du poste et non à `1.2.3.4` (même contrôle qu'à l'essai local, mais derrière
  le vrai réseau d'OVHcloud).
- Le parcours complet depuis un vrai téléphone, en 4G : adhésion, e-mails, validation, activation,
  connexion, photo.

---

## C. Ensemble

1. **Transfert des contenus** : section « Transférer les contenus » plus bas. Tu lances l'aperçu
   sur ton poste, tu valides la liste, puis j'importe.
2. **Recette en ligne**, puis ouverture et QR code de l'affiche pointant vers l'adresse définitive.
3. Après deux semaines sans incident : `HSTS_MAX_AGE="31536000"` dans `.env.production`, puis
   `bash scripts/prod-compose.sh up -d caddy`.

---

## D. Mettre en ligne une nouvelle version

Sur le serveur, connecté en `agora` :

```bash
cd /srv/agora && bash scripts/deploy.sh
```

Une seule commande, qui enchaîne (≈ 2 à 3 minutes) :

1. `git pull --ff-only` (refuse si des fichiers ont été modifiés à la main sur le serveur) ;
2. image d'outils ;
3. **sauvegarde de la base et des fichiers** (`…-avant-deploiement`) ;
4. **migrations Prisma** (`prisma migrate deploy`) ; seed à la toute première installation ;
5. image du site (`next build`, contre la base, par le tunnel local) ;
6. remplacement du site, attente de son contrôle de santé, contrôle de la page d'accueil en HTTPS ;
7. ménage : les trois dernières versions de chaque image sont gardées.

Une erreur arrête tout avant l'étape 6 : l'ancienne version continue de tourner. Pendant l'étape 5,
l'ancienne version tourne sur le nouveau schéma : une migration doit rester compatible avec la
version précédente (ajouter une colonne ou une table ; ne retirer qu'à la version suivante).

### Revenir en arrière

```bash
bash scripts/deploy.sh --rollback
```

Remet l'image précédente en service, en quelques secondes. Le schéma de la base, lui, reste celui
de la nouvelle version (compatible, par la règle ci-dessus). Si une migration a vraiment cassé
des données : restaurer la sauvegarde `…-avant-deploiement` (`docs/SAUVEGARDE.md`, cas 1).

### Commandes utiles

```bash
bash scripts/prod-compose.sh ps
```

```bash
bash scripts/prod-compose.sh logs --tail 100 app
```

```bash
bash scripts/prod-compose.sh run --rm tools pnpm create-admin
```

Mise à jour des images de base (PostgreSQL, Caddy), une fois par mois :

```bash
bash scripts/prod-compose.sh pull postgres caddy && bash scripts/deploy.sh --no-pull
```

---

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

2. Créer `.env.essai-local` à partir de `.env.production.example` (le fichier est ignoré par Git),
   avec : `SITE_DOMAIN="agora.test"`, `CADDY_TLS="internal"`, `APP_URL="https://agora.test"`,
   `SMTP_HOST="mailpit"`, `SMTP_PORT="1025"`, `MAIL_FROM="ne-pas-repondre@agora.test"`, et un
   `POSTGRES_PASSWORD` et un `BETTER_AUTH_SECRET` générés par `openssl rand -hex 32`.
   Puis `chmod 600 .env.essai-local`.
   **Ne pas l'appeler `.env.production.local`** : Next.js charge ce nom tout seul en mode
   production, et le build des tests e2e (`pnpm test:e2e`) prendrait alors ces réglages (erreur
   commise puis corrigée le 22/11 : les e-mails des tests partaient vers l'hôte `mailpit`).
3. Les ports 80 et 443 du poste doivent être libres.

### Lancer

```bash
export ENV_FILE=.env.essai-local COMPOSE_EXTRA=docker-compose.prod-local.yml CURL_INSECURE=1
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
8. les 22 pages de l’administration et les 12 pages publiques principales s'affichent sans erreur ;
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

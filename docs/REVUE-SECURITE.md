# Revue de sécurité — phase 6

> Phase 6, revue de sécurité faite le 20/11/2026, sur le code du commit `416308a` plus les fichiers non commités présents à ce moment-là.

## 1. Périmètre

**101 Server Actions** dans 20 fichiers `"use server"`, toutes relues une à une :

| Fichier | Actions | Contrôle d'accès |
|---|---|---|
| `features/admin/actions.ts` | `adminSearchAction` | `admin.access`, puis une permission par famille de résultats |
| `features/articles/actions.ts` | `saveArticleAction`, `setArticleStatusAction` | `articles.manage` |
| `features/auth/actions.ts` | `signInAction`, `forgotPasswordAction`, `resetPasswordAction`, `activateAccountAction` (publiques) ; `signOutAction` | Zod puis débit par IP (et par e-mail pour la connexion et le mot de passe oublié) ; déconnexion sans contrôle, voulu |
| `features/auth/roles-actions.ts` | `createStaffAccountAction`, `setUserRolesAction` | `roles.manage` |
| `features/committee/actions.ts` | 3 actions | `settings.manage` |
| `features/contact/actions.ts` | `sendContactMessageAction` (publique) | Zod, débit par IP, champ piège |
| `features/events/actions.ts` | `registerMemberAction`, `cancelMemberRegistrationAction` ; `registerGuestAction`, `confirmGuestRegistrationAction`, `cancelGuestRegistrationAction` (publiques) | `requireUser` + propriété dans le service ; jeton opaque haché + débit pour les invités |
| `features/events/admin-actions.ts` | 5 actions | `events.manage` |
| `features/gamification/actions.ts` | 4 actions | `points.grant`, `badges.award`, `points.rules.manage` |
| `features/library/actions.ts` | 8 actions | `books.manage` |
| `features/members/actions.ts` | 6 actions | `members.manage` (le service refuse d'agir sur soi et sur un responsable sans `roles.manage`) |
| `features/members/card-actions.ts` | `regenerateMyCardAction`, `revokeMemberCardAction` | `member.access` (compte de la session) / `members.manage` |
| `features/members/profile-actions.ts` | `updateOwnProfileAction` | `member.access`, compte de la session |
| `features/memberships/actions.ts` | `submitMembershipRequestAction` (publique) ; `approveRequestsAction`, `rejectRequestAction` | débit par IP / `memberships.review` |
| `features/notifications/actions.ts` | 2 actions | `requireUser`, filtre `userId` de la session |
| `features/payments/actions.ts` | 3 actions | `payments.record` ; pointage : `attendance.record` ou `payments.record`, droits passés au service |
| `features/quizzes/actions.ts` | 11 actions d'administration, 3 de jeu | `quizzes.manage` / `member.access` + débit + tentative verrouillée sur le compte de la session |
| `features/readings/actions.ts` | 5 actions membre, 2 de modération | `member.access` + propriété (`ownReading`) / `readings.validate`, `reviews.moderate` (refus de valider ses propres lectures) |
| `features/scrabble/actions.ts` | 25 actions | `tournaments.manage`, `scores.enter`, `results.publish` (enveloppe `guarded`) |
| `features/settings/actions.ts` | 2 actions | `settings.manage` |

**9 méthodes de Route Handler** dans 8 fichiers `route.ts` :

| Route | Méthode | Accès | Zod / validation | Origine (après revue) |
|---|---|---|---|---|
| `/api/admin/attendance/scan` | POST | `attendance.record` | `scanRequestSchema` | contrôlée |
| `/api/admin/attendance/search` | POST | `attendance.record` | `searchRequestSchema` | contrôlée |
| `/api/admin/events/[id]/registrations` | GET | `data.export` **et** `events.manage` | identifiant par motif | lecture (voir §5) |
| `/api/admin/uploads` | POST | session, puis `books.manage` ou `settings.manage` selon le dossier | dossier en liste fermée, type au contenu, 2 Mo, nom régénéré | contrôlée |
| `/api/assistant` | POST | `member.access` | `assistantRequestSchema` | contrôlée |
| `/api/member/photo` | POST, DELETE | `member.access`, compte de la session | type au contenu, 2 Mo, nom régénéré | contrôlée |
| `/api/member/photo/[...path]` | GET | session | nom par motif strict | lecture |
| `/uploads/[...path]` | GET | public (couvertures, comité), photos de profil exclues | nom par motif strict | lecture |

Aussi relus : `src/proxy.ts`, `src/lib/permissions/`, `src/lib/rate-limit.ts`, `src/lib/request.ts`, `src/lib/auth.ts`, `src/config/auth.ts` (`safeNextPath`), `src/lib/logger.ts` et tous ses appels, `src/lib/storage*.ts`, `src/features/members/card-token.ts` et `card-service.ts`, les requêtes des pages publiques (noms, e-mails, critiques, Scrabble, lien de visio), `next.config.ts`, `.env.example`, `src/lib/env.ts`, les `dangerouslySetInnerHTML`.

## 2. Méthode

1. Lecture de chaque action et de chaque handler : première instruction (contrôle d'accès), validation Zod avant tout accès métier, propriété vérifiée dans le service quand l'action vise une ressource d'un membre, débit sur les actions publiques.
2. Les matrices existantes ont été relues puis exécutées :
   - `src/features/actions-security.test.ts` : liste **toutes** les fonctions exportées des fichiers `"use server"` et échoue si l'une n'est ni dans `protectedCases` ni dans `publicCases` ; chaque action protégée est jouée sans session, avec un compte suspendu et avec chacun des six rôles ; chaque action publique est jouée limite de débit dépassée ;
   - `src/features/actions-validation.test.ts` : saisies mal formées envoyées à chaque action, rien n'atteint la base ;
   - `src/app/route-handlers-security.test.ts` et `src/app/api/admin/attendance/attendance-routes.test.ts` : les handlers rôle par rôle.
3. Manque relevé dans ces matrices : **rien n'obligeait à couvrir un nouveau Route Handler**. Ajout de `src/app/route-handlers-origin.test.ts`, qui inventorie chaque `route.ts` et chaque méthode exportée (un ajout non déclaré fait échouer le test), vérifie le 401 sans session de chaque handler non public, et le contrôle d'origine de chaque handler qui modifie.
4. Chaque correctif a été prouvé : test écrit, correctif retiré (`git stash`), test en échec, correctif remis, test au vert.

## 3. Constats et correctifs

### S1 — Route Handlers qui modifient sans contrôle d'origine (gravité : moyenne, corrigé)

- **Où** : `src/app/api/admin/uploads/route.ts`, `src/app/api/member/photo/route.ts` (POST et DELETE), `src/app/api/admin/attendance/scan/route.ts`, `src/app/api/admin/attendance/search/route.ts`, `src/app/api/assistant/route.ts`. Point connu pour le premier (PROGRESS, « Problèmes connus ») ; la revue a trouvé les cinq autres.
- **Scénario** : les Server Actions comparent `Origin` et `Host` (Next.js) ; les Route Handlers non. La seule protection était le cookie `SameSite=Lax`. Or `Lax` ne distingue pas les sous-domaines d'un même site : une page servie sur un autre sous-domaine du domaine du club (ou d'un hébergeur qui n'est pas dans la Public Suffix List) peut envoyer, au nom d'un responsable connecté, un formulaire `multipart` vers `/api/admin/uploads`, ou un corps `text/plain` qui contient du JSON vers `/api/admin/attendance/scan` (`request.json()` ne regarde pas le `Content-Type`) : pointage d'une présence, encaissement de la participation, points attribués.
- **Correctif** : `src/lib/same-origin.ts` (`assertSameOrigin`), appelé juste après le contrôle d'accès et avant toute lecture du corps, du disque, du compteur de débit ou de la base. Refus (403) si `Sec-Fetch-Site` vaut autre chose que `same-origin` ou `none`, ou si `Origin` désigne un autre hôte que celui de la requête (`Host` / `X-Forwarded-Host`) ou de `APP_URL`, ou vaut `null`. Sans aucun des deux en-têtes (client hors navigateur), la session décide seule : un navigateur moderne envoie toujours `Origin` sur un POST ou un DELETE.
- **Test** : `src/app/route-handlers-origin.test.ts` — 6 méthodes × 7 provenances refusées (autre site, sous-domaine voisin, `null`, autre port, `Sec-Fetch-Site` `cross-site` ou `same-site`, `Origin` correct mais `Sec-Fetch-Site: cross-site`), avec une session de super-administrateur : 403, ni base, ni compteur, ni disque. **42 échecs sans le correctif, 0 avec.** Plus : la même origine passe, l'hôte public derrière un proxy, `APP_URL`, le téléphone sur le réseau local (`pnpm dev:lan`).

### S2 — Aucune protection contre l'affichage dans un cadre (gravité : faible, corrigé)

- **Où** : `next.config.ts`, `headers()` ne posait d'en-têtes que sur `/sw.js`.
- **Scénario** : toute page pouvait être affichée dans une `<iframe>` transparente pour faire cliquer un responsable connecté sur « Valider » ou « Suspendre ». Depuis un site tiers, le cookie `SameSite=Lax` n'accompagne pas le cadre (le responsable y apparaît déconnecté) ; depuis un sous-domaine du même site, il l'accompagne. Comme pour S1, la protection reposait donc sur le seul cookie.
- **Correctif** : sur toutes les adresses, `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'` (cette politique ne restreint que l'affichage en cadre, pas les scripts), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` (les adresses à jeton — activation, annulation d'une inscription — ne partent jamais en entier vers un autre site). Aucune page du projet n'utilise de cadre (vérifié par recherche).
- **Test** : `src/app/security-headers.test.ts` (échoue sans le correctif). **Non vérifié dans un navigateur ni sur un build** (consigne : ni `next build` ni Playwright).

### S3 — Échappement sans effet dans les données structurées de l'accueil (gravité : faible, corrigé)

- **Où** : `src/app/(public)/page.tsx:37` (avant correctif) : `JSON.stringify(organization).replace(/</g, "<")`. Dans une chaîne JavaScript, `"<"` **est** le caractère `<` : le remplacement ne faisait rien. Les trois autres pages (`events/[slug]`, `library/[slug]`, `news/[slug]`) écrivaient bien `"\\u003c"`.
- **Scénario** : aujourd'hui sans conséquence (l'accueil ne sérialise que `src/config/site.ts`). Le jour où le nom ou le slogan viendront de la table `Setting` (prévu par le cahier des charges), un `</script>` saisi dans l'administration fermerait la balise.
- **Correctif** : `src/lib/json-ld.ts` (`serializeJsonLd`), utilisé par les quatre pages.
- **Test** : `src/lib/json-ld.test.ts` : un titre `</script><script>…` ne ferme pas la balise, et chaque `application/ld+json` de `src/app` doit passer par `serializeJsonLd` (échoue avec l'ancienne page d'accueil).

### S4 — Nouveau Route Handler non couvert sans que rien n'échoue (gravité : faible, corrigé)

- Voir §2, point 3 : `src/app/route-handlers-origin.test.ts`, « inventaire des Route Handlers ».

## 4. Points conformes (vérifiés à la lecture et par les tests)

- **Contrôle d'accès en premier** dans les 91 actions protégées et les 8 handlers non publics ; les 9 actions publiques valident (Zod) puis comptent le débit avant tout accès aux comptes ou à la base ; `signOutAction` n'exige pas de session, par choix documenté (un compte suspendu doit pouvoir se déconnecter).
- **Compte suspendu ou archivé** : `loadUserAccess` renvoie `null` dès que le statut n'est pas `ACTIVE`, à chaque requête (pas de cache de session dans le cookie) ; matrice « compte suspendu, même super-administrateur ».
- **Zod côté serveur** pour chaque entrée ; matrice de saisies mal formées ; aucune propriété en trop n'arrive au service.
- **Propriété** : lectures (`ownReading`), critiques (clé `userId_bookId` de la session), inscriptions (`registration.userId !== userId` → « introuvable »), notifications (filtre `userId`), tentatives de quiz (`lockOwnAttempt`), photo et profil (`where: { id: <session> }`), carte (compte de la session). Un responsable ne valide ni ses lectures ni ses critiques, ne suspend ni n'archive son propre compte, ni celui d'un responsable sans `roles.manage`.
- **Débit** : connexion (IP 20 / 15 min, e-mail 5 / 15 min), mot de passe oublié (IP, e-mail), réinitialisation et activation (IP), formulaires publics (adhésion, contact, inscription invité : 5 / h par IP), liens à jeton (30 / h), assistant (5 / min + quota du jour en base), quiz, photo, carte, scan et recherche. Clés stockées en HMAC, sans IP ni e-mail en clair.
- **Uploads** : JPEG, PNG, WebP reconnus à leur signature (SVG refusé), 2 Mo, nom aléatoire de 32 hexadécimaux, `writeFile` en `wx` ; lecture limitée aux noms produits par le stockage (aucun chemin libre) ; photos de profil jamais servies par `/uploads`, servies aux seuls connectés en cache privé ; `nosniff`.
- **AuditLog** : rôles, comptes administratifs, validation et refus d'adhésion, suspension, réactivation, archivage, renouvellement, points (attribution, annulation, barème), badges manuels, scores, validation / dévalidation / publication des résultats, records, encaissements et annulations, pointage, révocation de carte, export CSV, paramètres et charte, réinitialisation de mot de passe.
- **Journaux** : `logger` masque les clés secrètes (`password`, `token`, `cookie`, `apiKey`…), les téléphones et adresses, tronque les e-mails partout (message, contexte, pile) ; aucun `console.*` hors du logger ; arguments des Server Actions non journalisés (`logging.serverFunctions: false`) ; aucune conversation de l'assistant dans les journaux.
- **QR de la carte** : `A1.<série aléatoire>.<version>.<HMAC tronqué à 128 bits>`, clé dérivée par HKDF (séparée des sessions et du limiteur), comparaison en temps constant, signature vérifiée avant toute lecture en base, aucune donnée personnelle, révocable.
- **Jetons** : activation et inscription invité générés sur 32 octets, stockés hachés (SHA-256) ; liens des e-mails construits depuis `APP_URL`, jamais depuis l'en-tête `Host`.
- **Cookies** : Better Auth, `HttpOnly`, `SameSite=Lax`, `Secure` dès que `APP_URL` est en `https` ; aucun endpoint `/api/auth/*` exposé (tout passe par les Server Actions).
- **Proxy** (`src/proxy.ts`) : filtre optimiste sur `/member` et `/admin` seulement, le vrai contrôle étant dans chaque page, layout, action et handler.
- **Redirections** : `safeNextPath` n'accepte que `/member…`, `/admin…` et `/events/<slug>`, refuse `//`, `\`, blancs, caractères de contrôle et segments `..` ; `/admin` n'est suivi que si l'utilisateur y a accès. Les formes encodées (`%2e%2e`, `%5c`) restent sur l'origine du site (vérifié avec l'analyseur d'URL de Node).
- **Pages publiques** : membres affichés « prénom + initiale » (ou « Membre de l’Agora » s'ils se sont retirés des classements), critiques sous le prénom seul et avec l'accord du membre, aucun e-mail ni téléphone de membre, lien de visio lu pour les seuls inscrits confirmés, photo de profil (mineurs compris) jamais publique.
- **Export CSV** : formules neutralisées, `no-store`, tracé.
- **`.env.example`** : aucun secret réel (secret, clés et mots de passe vides ; le seul mot de passe présent est celui de la base Docker locale, `agora`). `.env` est ignoré par Git.

## 5. Choix à trancher par le porteur du projet (rien n'a été changé)

1. **`X-Forwarded-For` lu sans condition** (`src/lib/request.ts`) : si l'hébergement ne place pas un proxy inverse qui **écrase** cet en-tête, chacun peut le falsifier et contourner toutes les limites par IP (formulaires publics notamment ; les limites par compte restent efficaces). Déjà noté dans `DECISIONS.md` ; à régler au déploiement (ou rendre configurable le nombre de proxys de confiance).
2. **Taille du corps non plafonnée** pour `/api/assistant`, le scan et la recherche (`request.json()` lit tout), et pour les téléversements quand `Content-Length` est absent. Réservé aux connectés ; déjà signalé aux phases 3 et 5.
3. **Politique de sécurité du contenu complète** (`script-src`…) et **HSTS** non posées : elles dépendent de l'hébergeur (scripts injectés, domaine, HTTPS). À ajouter à la mise en ligne.
4. **L'export CSV est un GET qui écrit dans le journal** : une navigation déclenchée par un autre site emporte le cookie `Lax` ; l'attaquant ne lit pas le fichier, mais peut faire télécharger un export au responsable et créer une ligne `data.exported`. Le passer en POST changerait le bouton de l'interface.
5. **[Réglé le 22/11/2026]** **Jeton de réinitialisation stocké en clair** par Better Auth dans `Verification` (`reset-password:<jeton>`, 60 min), alors que les jetons d'activation du projet sont hachés. Better Auth 1.7.20 propose `verification.storeIdentifier: "hashed"` ; non activé ici (effet à vérifier sur les liens en cours et sur `purgeExpiredVerifications`). **Réglé** : empreinte SHA-256 seule pour `reset-password:` (`src/lib/auth.ts`) ; Better Auth retombant sur la valeur en clair quand l'empreinte manque, un jeton en clair est supprimé avant la vérification (`discardPlainResetToken`) et la migration `20261122120000_jetons_reinitialisation_haches` efface les anciens. Test : `src/features/auth/reset-token.db.test.ts`.
6. **L'objet d'un message de contact** (texte libre du visiteur) est écrit dans le journal à l'envoi (`lib/mail/index.ts`), e-mails masqués mais pas un nom tapé dans l'objet.
7. **Pas de limite de débit sur `/api/admin/uploads`** (réservé à `books.manage` et `settings.manage`), contrairement à la photo de profil.
8. Rappel des choix déjà signalés, toujours ouverts : responsable sans rôle « membre » qui s'inscrit à une rencontre ; administrateur qui réactive un responsable suspendu par un super-administrateur ; adhésion et inscription invité qui révèlent qu'une adresse est connue ; blocage d'un compte 15 min après cinq échecs, pour tout le monde ; les trois formulaires publics partagent un même compteur par IP (5 / h, gênant derrière le NAT d'un lycée).

## 6. Limites (non vérifié)

- **Aucun navigateur, aucun build** : les en-têtes de S2 et le contrôle d'origine de S1 n'ont été exécutés qu'en tests unitaires. À constater avec Playwright sur le build de production : téléversement d'une couverture et d'une photo, retrait de la photo, scan, recherche d'un inscrit, assistant (le navigateur envoie `Origin` et `Sec-Fetch-Site: same-origin` : la requête doit passer), et derrière le vrai proxy inverse (`X-Forwarded-Host`).
- Les tests de sécurité simulent la session et la base (`src/test/security-harness.ts`) : ils prouvent l'ordre des contrôles et les refus, pas le comportement de PostgreSQL. Les règles de propriété ont été relues dans les services, pas toutes rejouées contre une vraie base dans cette revue.
- Pages et layouts (`requirePageAccess`) : non relus page par page ici (la matrice d'accès aux pages est un autre point de la phase 6).
- Dépendances : aucun audit (`pnpm audit`) lancé (pas d'appel externe).
- Comportement exact de Next.js 16 face aux chemins `//…` en redirection : non éprouvé ; `safeNextPath` les refuse avant.

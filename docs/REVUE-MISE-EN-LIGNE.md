# REVUE-MISE-EN-LIGNE.md — Ce qui bloque encore

> Revue du 22 novembre 2026. **Rien n'est en ligne
> et rien ne sera changé en production sans ta validation.** Cible : ouverture des adhésions le
> samedi 16 janvier 2027.

Légende : 🔴 bloque l'ouverture · 🟠 à faire avant l'ouverture, sans bloquer la préparation ·
🟢 souhaitable, peut attendre.

## 1. Tests

| Vérification                                                         | Résultat du 22/11/2026                                                                                                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tests unitaires (`pnpm test`)                                        | ✅ 2 733 / 2 733, 39 fichiers (après fusion de `main`)                                                                                                                                        |
| Types (`pnpm typecheck`) et lint (`pnpm lint`)                       | ✅ (un avertissement ancien : directive `eslint-disable` inutile dans `opengraph-image.tsx`)                                                                                                  |
| Parcours de production (`pnpm test:prod`, Docker + Caddy HTTPS)      | ✅ 3 / 3                                                                                                                                                                                      |
| Restauration après destruction totale                                | ✅ base et fichiers identiques (`docs/SAUVEGARDE.md`)                                                                                                                                         |
| Parcours Playwright complets (`pnpm test:e2e`, mobile et ordinateur) | ✅ 89 réussis, 0 échec, 17 sautés exprès (parcours réservés à un format)                                                                                                                      |
| Format (`pnpm format:check`)                                         | 🟢 47 fichiers à reformater, tous antérieurs (surtout `communication/`) : sans effet sur le site                                                                                              |
| Dépendances (`pnpm audit --prod`)                                    | 🟢 1 alerte « haute » : `effect` ≤ 3.22.0 (ReDoS), utilisé par la configuration de Prisma en ligne de commande, jamais par une saisie de visiteur. Disparaîtra avec une mise à jour de Prisma |

Les 3 échecs du premier passage sont réglés (mise à jour du 22/11, après décisions) :

- `e2e/contenus.spec.ts:113` : test périmé, mis à jour pour le lancement confirmé (16 janvier
  2027, 16 h – 19 h, Foyer des jeunes de Yeumbeul Nord, date non provisoire).
- `e2e/lectures.spec.ts:113` (mobile) : **vrai défaut, corrigé**. Toucher l'onglet du bas déjà
  actif remontait en haut de la page au lieu de naviguer ; l'onglet étant actif sur ses
  sous-pages (fiche d'une lecture, carte de membre, quiz), il ne ramenait jamais à sa page
  principale. La remontée ne vaut plus que sur la page principale de l'onglet.
- `e2e/scrabble-quiz.spec.ts:38` : instable une fois dans la suite complète ; passe depuis.

Pendant cette revue, j'ai trouvé et corrigé une erreur de ma part : le fichier d'essai local
s'appelait `.env.production.local`, nom que Next.js charge tout seul ; le premier passage
Playwright prenait donc les réglages de l'essai (e-mails vers un hôte inexistant). Renommé en
`.env.essai-local`.

## 2. Contenus (`docs/A-CORRIGER.md`)

Les 32 enregistrements de la liste sont **tous encore à cocher**. Ils seront exportés tels quels
vers la production (`docs/DEPLOIEMENT.md`, « Transférer les contenus ») : il vaut mieux les corriger
**avant** l'export.

- 🔴 **8 livres et 8 auteurs** : auteurs, éditions et résumés « pas encore vérifiés ». Un résumé ou
  un auteur erroné sur le site public du club de lecture se voit tout de suite.
- 🔴 **6 rencontres** (9 janvier → 20 mars 2027), toutes « publiées » : dates, lieux et descriptions
  à confirmer par le comité. Le **lancement du 16 janvier** est confirmé (date, heure, lieu).
- 🔴 **3 articles** publiés : à relire.
- 🟠 **Livre du mois de novembre 2026** : à repasser à décembre ou janvier (non exporté par défaut).
- 🟠 **Tournoi de mars 2027 déjà « terminé » avec des résultats**, **record de 845 points**, **quiz
  « Échauffement des Génies du soir »** : contenus fictifs. Ils ne sont **pas** exportés par défaut ;
  à recréer en production quand ils seront réels.
- 🟢 **3 demandes d'adhésion « Démonstration »** : jamais exportées (aucune demande ne l'est).

Autres contenus attendus du comité (`docs/RAPPORT-LIVRAISON.md`, § 7) :

- 🔴 **Texte définitif de la charte** : le formulaire d'adhésion fait **accepter** la charte ; les
  premières adhésions doivent porter sur le texte définitif, sans la mention « version provisoire ».
- 🟠 Coordonnées, adresse de contact du club, réseaux sociaux (Administration → Paramètres).
- 🟠 Photos du comité, outil de visio, barème des points et noms des niveaux à valider,
  expiration de la carte de membre.

## 3. Comptes, achats et réglages (à faire par le club)

Tout est détaillé dans `docs/DEPLOIEMENT.md`, partie A.

- 🔴 Compte OVHcloud (double authentification), **VPS-1**, **domaine .com** (renouvellement
  automatique), zone DNS (A, CAA ; pas d'AAAA).
- 🔴 **Brevo** : compte approuvé, domaine vérifié (SPF, DKIM, DMARC), clé SMTP. Sans lui, ni
  accusé de réception ni lien d'activation : l'adhésion en ligne ne fonctionne pas. À ouvrir tôt.
- 🔴 **Sauvegardes** : compte Backblaze B2 (bucket verrouillé, clé sans suppression),
  healthchecks.io, paire de clés `age` gardée par deux personnes.
- 🔴 Clé SSH, et une deuxième personne capable d'entrer sur le serveur ; _deploy key_ GitHub en
  lecture seule.
- 🟠 Hors technique, à vérifier par le bureau : déclaration du traitement de données personnelles
  auprès de la **CDP** (loi sénégalaise n° 2008-12), d'autant que des mineurs peuvent adhérer et que
  les données seront hébergées en France ; nom et adresse de l'**hébergeur** (OVH SAS) à ajouter à
  la page Confidentialité ou à une page de mentions légales.

## 4. Ce qui n'a été vérifié qu'en local (à refaire sur le serveur)

- 🔴 Certificat **Let's Encrypt réel** (l'essai local utilise le certificat interne de Caddy).
- 🔴 **Délivrabilité des e-mails** (Gmail, Outlook, Orange) avec Brevo : seul Mailpit a reçu des
  e-mails ; Resend et le vrai SMTP n'ont jamais tourné.
- 🔴 **Restauration complète sur le serveur** et premier envoi réel vers B2 ; alertes
  healthchecks.io ; minuteries systemd (écrites, jamais exécutées par un vrai systemd).
- 🔴 **Parcours complet sur un vrai téléphone, en 4G** : jamais fait (seulement l'émulation
  Playwright).
- 🟠 Adresse IP vue par le site derrière le vrai réseau d'OVHcloud (vérifiée en local : Caddy
  écrase `X-Forwarded-For`) ; IPv6 laissée de côté (pas d'`AAAA`).
- 🟠 Script de sécurisation : essayé sur un Ubuntu 24.04 de test, pas sur le VPS ; l'échange (swap)
  n'a pas pu y être essayé.
- 🟠 Service worker : jamais installé avec un vrai certificat (refusé avec le certificat local).
- 🟢 Assistant « Le Compagnon des Lettres » : jamais appelé pour de vrai (pas de clé) ; sans clé,
  il s'affiche « non connecté », ce qui est acceptable pour l'ouverture.

## 5. Pages non vérifiées ou défauts connus

- 🟠 Une adresse inconnue de livre, d'article ou de rencontre affiche « introuvable » mais répond
  **HTTP 200** (constaté de nouveau sur la pile de production : `/library/livre-inconnu`,
  `/news/inconnu`, `/events/inconnu`). Marquée `noindex`, donc sans effet sur les moteurs de
  recherche ; à corriger.
- 🟠 Revue de design : une partie des pages publiques n'a pas pu être relue (apparitions au
  défilement invisibles en capture : accueil, À propos, Bibliothèque) ; à regarder à l'œil sur
  téléphone. 15 améliorations P2 restent ouvertes (`docs/REVUE-DESIGN.md`), aucune bloquante.
- 🟠 Recette : l'archivage (anonymisation) d'un membre n'a jamais été exécuté ; la suppression de
  catégories, d'auteurs et de livres du mois non plus (`docs/RECETTE.md`).
- 🟢 Retirer un membre du comité laisse sa photo sur le disque (fichier orphelin, public de toute
  façon). Constaté pendant l'essai de production.
- 🟢 `docs/RAPPORT-LIVRAISON.md` dit encore « aucun dépôt distant » : le dépôt GitHub existe.

## 6. Sécurité

Réglé par la configuration de production :

- `X-Forwarded-For` falsifiable (`REVUE-SECURITE.md` § 5.1) : **réglé** par Caddy, qui écrase
  l'en-tête (vérifié en local).
- Taille des requêtes non plafonnée (§ 5.2) : **plafonnée à 5 Mo** par Caddy.
- HSTS (§ 5.3) : **posé** (5 minutes au départ, un an après deux semaines).
- Base de données : aucun port publié, réseau interne sans accès à internet ; secrets hors du dépôt
  et hors des images (vérifié) ; site sous un utilisateur non-root ; sauvegardes chiffrées,
  non effaçables depuis le serveur.

Restent à trancher (`docs/REVUE-SECURITE.md` § 5), aucun ne bloque à lui seul :

- ✅ **Formulaires publics** (était 🔴) : la limite unique de 5 envois par heure et par IP est
  remplacée. Adhésion : 3 demandes par adresse e-mail et par jour, 100 par heure et par IP (une
  salle entière sur le même Wi-Fi peut adhérer) ; inscription d'un visiteur : même logique ;
  contact : 5 par heure et par IP. Test sur la vraie base : 50 adhésions depuis la même IP.
- ✅ **Jeton de réinitialisation** (était 🟠) : stocké en empreinte SHA-256 ; un ancien jeton en
  clair est refusé et supprimé (migration et garde dans l'action). Test avec le vrai Better Auth.
- 🟢 Politique de sécurité du contenu complète (`script-src`) : à poser en mode « rapport seul »
  après l'ouverture.
- 🟢 Export CSV en GET, objet du message de contact dans le journal, pas de limite de débit sur le
  téléversement d'images par les responsables.

## 7. Ma proposition d'ordre

1. Toi : ouvrir Brevo **maintenant** (délai d'approbation), puis OVHcloud, domaine, B2,
   healthchecks.io (partie A de `DEPLOIEMENT.md`).
2. Toi et le comité : corriger les contenus de `A-CORRIGER.md` et la charte définitive, sur ton
   poste ; puis lancer l'**aperçu de l'export** et me montrer la liste.
3. ~~Moi : compteur des formulaires publics, jeton de réinitialisation haché~~ (fait le 22/11) ;
   reste l'adresse inconnue en 404 (🟠), après ton feu vert.
4. Moi, après ton feu vert et la commande du VPS : sécurisation, premier déploiement, sauvegardes,
   restauration testée sur le serveur, import des contenus validés.
5. Ensemble : recette sur un vrai téléphone en 4G, e-mails vers plusieurs messageries, puis
   ouverture.

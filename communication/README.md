# Communication de L’Agora de l’Excellence

Vidéos et visuels de la campagne, fabriqués avec [Remotion](https://www.remotion.dev) (vidéo en React).
Projet indépendant de l’application : son propre `package.json`, ses propres dépendances.

Les textes ne viennent que de `../docs/CONTENUS-CLUB.md`.

## Licence de Remotion

Gratuite pour un particulier, une entreprise de 3 salariés au plus et **toute organisation à but non lucratif** (vérifié dans `node_modules/remotion/LICENSE.md`, version 4.0.545). L’association peut donc l’utiliser sans licence payante, y compris pour publier les vidéos. Interdit seulement : revendre Remotion ou un dérivé de Remotion. La licence annonce un léger changement pour Remotion 5 : à relire avant une montée de version majeure.

## Installation

Node LTS et pnpm, depuis ce dossier :

```
cd communication
pnpm install
```

Le premier rendu télécharge une fois le navigateur sans interface de Remotion (environ 130 Mo). ffmpeg est fourni par Remotion : rien d’autre à installer.

## Commandes

| Commande | Ce qu’elle fait |
|---|---|
| `pnpm studio` | Ouvre Remotion Studio dans le navigateur : toutes les compositions, lecture image par image. |
| `pnpm images-cles <Id> <image>… [--sortie <dossier>]` | Rend des images clés en PNG. Les images se donnent en numéro (30 par seconde) ou en secondes (`3.5s`). Exemple : `pnpm images-cles DemoKit-Vertical 20 100 290 --sortie out/demo-kit/images-cles`. Sert aussi pour les visuels fixes (`pnpm images-cles PlancheKit-Portrait 0`). |
| `pnpm export <Id> [<Id>…]` | Rendu final d’une ou plusieurs vidéos : `out/<Id>/<Id>-HQ.mp4` (haute qualité : archives, Instagram, TikTok) et `out/<Id>/<Id>-WhatsApp.mp4` (compressée, 16 Mo au plus, texte net). MP4 H.264, BT.709 en plage standard (ce que lisent correctement les applis et les téléphones), 30 i/s, sans son. |
| `pnpm export <Id> --essai` | Même chaîne sur la première seconde seulement, dans `out/_essais/`, pour vérifier que tout fonctionne. |
| `pnpm sonoriser <Id> <bande.mjs> [--lufs -14] [--pic -1]` | Ajoute une bande son à la version WhatsApp déjà exportée (`out/<Id>/<Id>-WhatsApp.mp4`, image recopiée telle quelle) : construit la bande du module (fonction `bande()`), la normalise à −14 LUFS avec un pic vrai ≤ −1 dBTP (limiteur à anticipation, plusieurs passes), garde la bande en WAV (`out/<Id>/<Id>-bande-son.wav`), mesure le fichier final et refuse de le remplacer si la cible n’est pas tenue. Exemple : `semaine-5/son-texte-lancement.mjs`. |
| `pnpm controle <fichier.mp4> [--pixel x,y,image,référence]…` | Contrôle qualité d’une vidéo exportée : caractéristiques, fluidité image par image (sauts, clignotements), couleur d’une zone de 4 × 4 px comparée à une couleur (`#1F2A55`) ou, mieux, à la même image rendue en PNG par `images-cles` (les fonds ont une lumière et un grain, donc pas exactement la couleur du token). |
| `pnpm typecheck` | Vérifie le code TypeScript du projet. |

Toutes les sorties vont dans `out/`, exclu de Git. Les identifiants de composition suivent la forme `<Production>-<Format>` (`DemoKit-Vertical`, plus tard `Teaser-Vertical`, `SaveTheDate-Carre`…) ; la liste complète est dans `src/Root.tsx` et dans le Studio.

Pas de musique dans les fichiers : on l’ajoute depuis la bibliothèque d’Instagram ou de TikTok au moment de publier. Exception, à la demande du porteur : une version WhatsApp peut être sonorisée (un statut ne permet pas d’ajouter de musique), avec `pnpm sonoriser`. Les sons sont synthétisés dans le projet (`scripts/son/synthese.mjs` : chocs de tuiles, cordes pincées façon kora, bourdon, impacts feutrés, cloche, réverbération, limiteur) : rien n’est téléchargé.

## Déposer tes plans filmés et tes photos

| Quoi | Où | Comment c’est utilisé |
|---|---|---|
| Plans filmés (MP4, MOV) et photos d’ambiance | `assets/plans/` | Chaque `<Emplacement libelle="…" fichier="nom-du-fichier.mp4" />` cherche son fichier ici. Tant qu’il manque, la vidéo affiche « Plan à filmer : … » avec le nom attendu ; dès qu’il est déposé, il le remplace, sans toucher au code. |
| Photos du comité de pilotage | `assets/comite/` | Utilisées seulement si `CONTENUS-CLUB.md` indique l’accord des personnes. |

Conseils de tournage : filmer en vertical, 1080 × 1920 au moins, 30 i/s, lumière du jour, téléphone stable ; 5 à 8 secondes par plan suffisent. Uniquement des personnes qui ont donné leur accord.

## Réutiliser le kit

Tout vient de `src/kit/` :

```tsx
import { FondPapier, RangeeDeTuiles, TexteCinetique, couleurs } from "../src/kit";
```

| Pièce | Rôle |
|---|---|
| `tokens.ts` | Couleurs, polices, courbes d’animation par type de mouvement, durées de transition, formats et zones de sécurité, `tempsLecture()` (1 s pour 3 mots, 1,5 s au moins). |
| `scrabble.ts` | Valeurs des lettres au Scrabble francophone, `valeurMot()`. |
| `<Tuile lettre valeur />` (jamais d’accent sur une tuile : il les retire) | Une tuile avec sa matière (relief, ombre douce qui se resserre au contact, rotation en vol, rebond amorti). Sans `debut`, elle est déjà posée. Variantes : ivoire, indigo, terracotta, terracotta clair. |
| `<RangeeDeTuiles mot />` | Un mot qui s’écrit tuile par tuile, avec les valeurs. `dureeRangee(mot)` donne sa durée. |
| `<Hemicycle />` | Les gradins du logo qui se remplissent rang après rang, puis la tuile A1. `auRepos` pour une image fixe. |
| `<RevelationLogo />` | Hémicycle, puis logo officiel par fondu (géométrie identique), puis logotype. `chronologieRevelation()` donne tous les repères temporels. |
| `<TexteCinetique lignes />` | Texte mot par mot ou ligne par ligne, avec le temps de lecture des règles. `dureeTexteCinetique()` pour caler la suite. |
| `<SousTitres cues />` | Sous-titres intégrés, au-dessus de la zone de sécurité du bas ; `haut` pour les poser juste sous ce qu’ils expliquent. |
| `<FondPapier />`, `<FondIndigo />` | Les deux fonds, avec la lumière unique d’en haut à gauche. |
| `<PassageDeFond debut />` | Passage du papier ivoire à l’indigo : couleur interpolée en OKLCH par les bleus (jamais le gris-mauve d’un mélange RVB), deux images intermédiaires seulement, textures croisées. Le décor du papier se passe en enfant et part avec lui. Faire sortir texte et lettres **avant** son début. `vers="ivoire"` : le même chemin à rebours, de l’indigo au papier. |
| `couleur.ts` (`interpolerOklch`) | Interpolation de deux couleurs en OKLCH, avec choix du sens de rotation de la teinte. À utiliser pour tout changement de couleur animé. |
| `<Transition duree />` | Le langage de transition commun (glissement ou fondu). Chevaucher les deux `<Sequence>` de la durée de la transition, la nouvelle scène déclarée en second. |
| `<Reglette />`, `placeSurReglette()` | Le chevalet du Scrabble : la barre terracotta sous une rangée de tuiles, et la position de chaque tuile dessus (semaines 3 et 5). |
| `<ArcDeGradins />` | Motif de gradins en arc, plat, pour habiller un fond. |
| `<TuileEnMigration depuis vers />` | Une tuile posée qui se soulève, voyage et se repose ailleurs, en changeant de taille, d’orientation et d’aspect (une lettre qui devient une place des gradins). Avec `geometrieRevelation()`, elle amène les lettres d’un mot sur les places exactes de l’hémicycle (exemple : `demo-kit/DemoKit.tsx`). |
| `geometrieHemicycle()`, `geometrieRevelation()` | Position, rotation et taille de chaque place et de la tuile A1, en px, dans l’hémicycle ou dans le logo vertical. `<Hemicycle>` et `<RevelationLogo>` acceptent `avecA1={false}` et `exclusInterieur` / `exclusExterieur` pour laisser ces places aux tuiles venues d’ailleurs. |
| `<PageDeLivre progression />` | Un livre ouvert vu de dessus, dont la page de droite se tourne (coin bas d’abord, revers rabattu, ombres douces, tout en 2D). Vrais textes (`textes` : titre courant, paragraphes, ornement) ou texte figuré. Apparition et disparition sur l’indigo par `papier` (couleur interpolée en OKLCH, jamais par transparence), `opaciteTexte` et `presence`. `pageGauche={false}` pour une image fixe. |
| `<Emplacement libelle />` | Cadre pour un plan filmé (voir plus haut). |
| `<ZoneSecurite format />` | Conteneur limité à la zone de sécurité du format. |

Pour une nouvelle production : créer son dossier (`semaine-1/`…), y écrire `STORYBOARD.md` et les compositions, les déclarer dans `src/Root.tsx`, rendre les images clés, faire valider, puis exporter. Si un besoin revient deux fois, il devient un composant du kit.

Le dossier `demo-kit/` sert d’exemple complet : une vidéo (`DemoKit.tsx`), une planche de contrôle (`PlancheKit.tsx`) et une image de contrôle du logo (`ReferenceLogo.tsx` : le fichier officiel seul, au cadrage de la fin de la vidéo, pour vérifier au pixel près que la dernière image est bien le logo intact).

Les ombres et les reliefs des tuiles sont contre-tournés selon leur rotation : une tuile tournée garde la lumière commune, d’en haut à gauche.

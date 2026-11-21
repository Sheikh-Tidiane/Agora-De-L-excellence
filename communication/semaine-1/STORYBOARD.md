# Semaine 1 — Le mystère : storyboard (version 1.1, validée)

Objectif : **intriguer**. On ne dit pas encore ce qu’est le club, ni la date, ni le lieu (la date du lancement est provisoire et le lieu n’est pas confirmé : rien de tout cela n’apparaît).

Pièces :

| Pièce | Composition | Format |
|---|---|---|
| Teaser avec plan filmé | `Teaser-Vertical` | vertical 1080 × 1920, 30 i/s, 19,3 s (578 images), sans son |
| Teaser 100 % animé | `TeaserAnime-Vertical` | idem ; publiable tout de suite |
| Visuel 1 : le logo seul | `S1Logo-Carre`, `S1Logo-Portrait` | 1080 × 1080 et 1080 × 1350 |
| Visuel 2 : le slogan | `S1Slogan-Carre`, `S1Slogan-Portrait` | idem |
| Visuel 3 : la question | `S1Question-Carre`, `S1Question-Portrait` | idem |

Code : `semaine-1/` (`minutage.ts` pour tous les temps et positions, `Scenes.tsx`, `Finale.tsx`, `Teaser.tsx`, `Visuels.tsx`). Un nouveau composant rejoint le kit, car il sert deux fois (teaser et visuel 3) : `<PageDeLivre>` (`src/kit/PageDeLivre.tsx`). `<PassageDeFond>` accepte maintenant `vers="ivoire"` : le même chemin de couleurs validé, parcouru à rebours.

## Narration sans son

Sur une table sombre, des lettres tombent, sans ordre. On lit, on joue : des tuiles se posent sur un plateau, une page se tourne (on y lit, à l’arrêt sur image, les objectifs du club). Les lettres reviennent et se rangent : elles écrivent AGORA. Puis elles prennent place dans les gradins d’un théâtre, le A de valeur 1 sur la scène : c’est le logo. Le papier revient : « Bientôt à Dakar. »

Le texte à lire en lecture normale est « Bientôt à Dakar. » et le logo ; la page du livre est un clin d’œil pour qui met en pause (décision du porteur, 21/11/2026), pas un texte narratif. Pas de sous-titres nécessaires (aucune parole).

## Séquences du teaser

Temps en secondes (30 i/s). Les deux versions sont identiques, sauf les plans 2a et 2c.

| # | Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal | Vers la suite |
|---|---|---|---|---|---|
| 1 | 0,00 – 3,00 | **Les tuiles tombent.** Table indigo (grain, lumière d’en haut à gauche). Cinq tuiles ivoire tombent une à une, à un rythme irrégulier (0,67 / 1,03 / 1,37 / 1,77 / 2,10 s), et se posent au hasard, chacune un peu tournée : O, R, G, A, puis A. Ce sont les lettres d’AGORA dans le désordre ; le spectateur peut tenter l’anagramme. | Les lettres et leurs valeurs (A1 G2 O1 R1 A1) | Chute des tuiles : elles grossissent légèrement en hauteur, accélèrent jusqu’au contact, rebond court, ombre qui se resserre. | Fondu de 0,4 s. |
| 2a | 2,60 – 4,40 | **Le plateau.** *Version plan filmé* : `<Emplacement>` « mains qui posent des tuiles sur un plateau » (`assets/plans/tuiles-plateau.mp4`, premier extrait). *Version animée* : vu de dessus, un plateau sobre (grille de cases en creux, sans les cases colorées d’un plateau du commerce) ; quatre tuiles se posent et écrivent LIRE. | (version animée) L1 I1 R1 E1 | Pose des tuiles, toutes les 0,17 s. Caméra fixe. | Fondu de 0,4 s. |
| 2b | 4,00 – 6,00 | **La page se tourne.** Un livre ouvert sur la table, en gros plan. Le livre apparaît par un passage de couleur du papier (indigo → ivoire en OKLCH, par les bleus, deux images intermédiaires, 4,40 – 4,50 s), puis son texte entre. Page de droite, composée comme une ouverture de chapitre : titre courant « OBJECTIFS » et les deux premiers objectifs du club. Elle se soulève par le coin bas, le pli la traverse jusqu’au dos et découvre la page suivante : « Cultiver l’excellence. », suivi d’un ornement de trois places des gradins. Le texte sort, puis le papier se fond dans la table (5,57 – 5,67 s). | Objectifs du club, mot pour mot (`CONTENUS-CLUB.md` §3), Young Serif 40 px, lisibles à l’arrêt sur image | Tour de page, 0,8 s (4,57 – 5,37 s) : découpe le long du pli, revers rabattu, ombres douces. Tout est plat, sans rotation 3D. Caméra fixe. | Fondu de 0,4 s. |
| 2c | 5,60 – 7,40 | **Le plateau, encore.** *Plan filmé* : second extrait du même plan (à partir de 2,5 s dans le fichier). *Animée* : le cadre s’est élargi ; SAVOIR se pose à la verticale et croise LIRE sur le I. | (animée) S1 A1 V4 O1 I1 R1 | Pose des tuiles. | Fondu de 0,4 s vers la table du début. |
| 3 | 7,00 – 10,53 | **AGORA.** Retour sur la table : les cinq tuiles sont là où elles étaient tombées. Elles se soulèvent l’une après l’autre (0,2 s d’écart) et se rangent au centre, à 860 px du haut : AGORA. | A1 G2 O1 R1 A1 | Les tuiles voyagent (passage par les tuiles), se redressent, se reposent. Mot formé à 9,3 s, tenu 1,2 s immobile. | Les tuiles repartent. |
| 4 | 10,53 – 16,47 | **L’hémicycle.** Comme dans la démo validée : le premier A glisse au centre et devient la tuile A1 ; G, O, R et le dernier A perdent leur lettre et deviennent quatre places du rang intérieur ; les autres places remplissent les gradins ; la matière s’efface, le symbole officiel puis le logotype apparaissent par fondu. Logo vertical inversé, 1 064 px de large, centré à 900 px. Logo complet de 15,07 à 16,07 s, puis fondu de sortie (0,4 s). | Le logo officiel | Migration des tuiles, remplissage des gradins, fondus du logo (jamais déformé ni animé dans ses éléments). | Le logo est sorti, puis le passage de fond. |
| 5 | 16,53 – 19,27 | **Bientôt à Dakar.** Le fond passe de l’indigo au papier (OKLCH, par les bleus, deux images intermédiaires, 16,53 – 16,63 s). Le symbole officiel (190 px) apparaît par fondu, puis « Bientôt / à Dakar. » mot par mot, en Young Serif 168 px, centré ; « Dakar. » en terracotta. Tenu 1,6 s après la dernière lettre. | « Bientôt à Dakar. » | Texte cinétique, mot par mot. | Fin. |

### Emplacements pour plans filmés

Un seul plan à tourner, utilisé en deux extraits : **mains qui posent des tuiles sur un plateau** → `communication/assets/plans/tuiles-plateau.mp4`.
Conseils : vertical, vu de dessus ou de trois quarts, 5 à 6 s, lumière du jour venant du haut gauche de l’image si possible (cohérence avec les ombres des tuiles), plateau neutre et mains seules (pas de visage). Les deux extraits commencent à 0 s et à 2,5 s du fichier : prévoir au moins 4,5 s de geste utile. Tant que le fichier manque, la vidéo affiche « Plan à filmer » : c’est pourquoi la version animée existe.

## Visuels fixes

| Visuel | Composition |
|---|---|
| 1. Le logo seul | Fond indigo, logo vertical inversé officiel seul (560 px de large en carré, 600 px en portrait), centré, son centre optique 2 % au-dessus du milieu. Plus de la moitié de l’image reste vide : c’est la respiration demandée. |
| 2. Le slogan | Papier ivoire. « Le savoir / comme flamme, / l’excellence / comme ambition » en Young Serif 104 px, aligné à gauche dans le haut de l’image (composition asymétrique) ; « flamme, » en terracotta (la couleur de la flamme et de la latérite). Au pied à droite, un arc de gradins en très faible contraste, en partie hors cadre. Logo horizontal officiel (300 px) en bas à gauche. |
| 3. La question | Fond indigo. « Quel est / le dernier livre / qui vous a / marqué ? » en Young Serif ivoire (96 px en carré, 104 en portrait), « livre » en terracotta clair ; dessous, l’invitation « DITES-LE-NOUS EN COMMENTAIRE » (Work Sans gras, capitales espacées). En bas à droite, en partie hors cadre, la page du teaser dont le coin se soulève (même composant `<PageDeLivre>`). Logo horizontal inversé en bas à gauche. |

## Images clés

Rendues dans `out/semaine-1/` :

- `images-cles/` : `pnpm images-cles Teaser-Vertical 30 76 110 150 205 285 470 577 --sortie out/semaine-1/images-cles` (et de même pour `TeaserAnime-Vertical`, avec en plus les images 140 et 360).
- `visuels/` : les six visuels fixes (`pnpm images-cles S1Logo-Carre 0 --sortie out/semaine-1/visuels`, etc.).

| Image | Temps | Moment |
|---|---|---|
| 0030 | 1,00 s | Les premières tuiles posées, d’autres encore à venir |
| 0076 | 2,53 s | Les cinq tuiles éparses : l’anagramme |
| 0110 | 3,67 s | Plateau (LIRE) / plan filmé, premier extrait |
| 0140 | 4,67 s | La page des objectifs, lisible (avant le tour) |
| 0150 | 5,00 s | La page au milieu de son tour |
| 0205 | 6,83 s | Plateau (SAVOIR croise LIRE) / plan filmé, second extrait |
| 0285 | 9,50 s | AGORA |
| 0360 | 12,00 s | Les gradins se remplissent autour de la tuile A1 (version animée) |
| 0470 | 15,67 s | Le logo officiel |
| 0577 | 19,23 s | Image finale : « Bientôt à Dakar. » |

## Vérifications faites

- **Logo intact** : l’image 470 du teaser comparée pixel par pixel à `ReferenceLogo-Vertical` (fond indigo + fichier officiel `logo-vertical-inverse.svg`, même cadrage que la démo) : **0 pixel différent**.
- **Zones de sécurité (vertical)** : tuiles éparses entre 425 et 1 413 px de haut et 218 – 872 px de large ; plateau entre 430 et 1 430 px ; AGORA 97 – 983 px de large ; carton final entre 596 et 1 210 px. Rien d’important dans les 250 px du haut, les 300 px du bas ni les 80 px des côtés. Le livre déborde volontairement du cadre à gauche (la page de gauche, sans texte) ; le texte de la page reste entre 260 et 872 px de large et 430 et 1 330 px de haut. Visuels : tout le texte entre 96 et 995 px de large.
- **Temps de lecture** : AGORA (1 mot) formé à 9,3 s et tenu jusqu’à 10,5 s, lisible lettre à lettre bien avant ; logotype entier tenu 1 s, visible 1,8 s ; « Bientôt à Dakar. » visible 2,4 s, dont 1,6 s complet.
- **Couleurs** : uniquement les tokens ; passage de fond indigo → ivoire par le chemin OKLCH déjà validé (à rebours) ; aucun texte ni lettre à l’écran pendant le passage.
- `pnpm typecheck` passe.

## Autocritique

Corrigé pendant la mise au point :

1. **Le revers de la page dépassait du livre** (une pointe au-dessus de la tranche haute, à 5 s) : il reste désormais dans la hauteur du livre ; l’inclinaison du pli a été augmentée pour qu’on lise vraiment un coin qui se soulève, et non une bande étroite.
2. **Rangement d’AGORA confus** : le premier A, en haut à droite, traversait toute l’image et les tuiles s’empilaient. Les places au hasard ont été redistribuées (chaque tuile a un trajet court) et le départ des tuiles espacé (0,2 s) ; la tuile en vol passe au-dessus de celle qui se soulève. Il reste un croisement bref de G sous O (environ 0,1 s), naturel pour des objets posés.
3. **Carton final trop petit** : symbole et texte agrandis (150 → 190 px et 150 → 168 px), bloc recentré optiquement.
4. **Slogan portrait trop large** (« comme ambition » touchait la marge) : 104 px dans les deux formats. **Question carrée** : l’invitation touchait la page ; la page est descendue.

Ce qui me semble au niveau : la continuité (la table, les mêmes tuiles du début à la fin, le A qui revient trois fois : tuile, lettrine, scène), un seul langage de transition (fondu de 0,4 s, puis passage par les tuiles, puis passage de fond), une seule direction de lumière, deux tailles de texte au plus par écran, le logo vérifié au pixel.

Ce qui reste à juger, honnêtement :

- **Durée : 19,3 s** au lieu d’environ 18 s. Pour revenir à 18 s sans couper le temps de lecture, on peut raccourcir le moment de lecture de 1 s (plans 2a et 2c plus courts). Je préfère le garder tel quel : les deux plans du plateau sont déjà brefs.
- **Le texte figuré de la page** (lignes de mots, pas de vrai texte) : honnête et lisible comme « une page de livre » en mouvement, mais un peu schématique en image fixe. Alternative : un vrai texte du domaine public, à choisir par le comité.
- **Le plateau animé** est volontairement sobre (grille en creux, sans cases colorées) pour ne pas imiter un plateau du commerce ; il est moins chaleureux qu’un vrai plan filmé.
- **Le plan filmé** n’est pas encore tourné : la version `Teaser-Vertical` n’est pas publiable avant son dépôt. La version animée l’est.
- Fluidité et rendu encodé non contrôlés (pas de rendu final avant ta validation).

**Arrêt ici pour ta validation** : aucun rendu final n’a été fait.

## Retour du porteur et rendu final (21/11/2026, version 1.1)

Validée pour le rendu final, avec ces décisions : durée gardée à 19,3 s ; vrais textes sur la page du livre ; note de vérification des mots laissée dans `LEGENDES.md` ; rendu de `TeaserAnime-Vertical` et des six visuels ; **pas de rendu de `Teaser-Vertical` tant que `assets/plans/tuiles-plateau.mp4` n’est pas déposé.**

Changements :

1. **Page du livre** : le texte figuré est remplacé par les objectifs du club, mot pour mot (`CONTENUS-CLUB.md` §3), composés comme l’ouverture d’un chapitre (titre courant en capitales espacées Work Sans, texte en Young Serif 40 px, interligne 1,5, aligné à gauche : sans coupure de mots, la justification creusait de grands blancs). Page qui se tourne : « Créer un lieu… » et « Inculquer aux jeunes… » ; page découverte : « Cultiver l’excellence. » et un ornement de trois places des gradins. Lisible à l’arrêt sur image (vérifié en pleine résolution, image 140). Deux tailles de texte sur la page. Le visuel 3 garde le texte figuré : la page y est coupée par le cadre, un vrai texte y serait tronqué en pleine phrase.
2. **Apparition et disparition du livre, refaites** : en testant les images, le fondu du livre ivoire sur la table indigo donnait un gris terne pendant 0,4 s (le mélange RVB déjà refusé pour le passage de fond). Le livre apparaît et disparaît maintenant par un passage de couleur du papier en OKLCH, le même que le passage de fond validé (deux images intermédiaires bleutées), texte sorti avant. Le kit (`<PageDeLivre>`) accepte pour cela `papier`, `opaciteTexte` et `presence`.
3. **Caméra fixe sur le plateau et la page** : le contrôle image par image de la première vidéo encodée montrait, au début du tour de page et à la fin des plans du plateau, des écarts qui alternaient d’une image à l’autre (1,0 / 0,2 / 1,1 / 0,3). Cause trouvée sur les PNG rendus : la lente dérive de caméra (0,4 px par image) faisait sauter le texte et la grille d’un pixel une image sur deux. Dérive supprimée ; le défaut a disparu.

### Fichiers

| Fichier | Poids | Caractéristiques |
|---|---|---|
| `out/TeaserAnime-Vertical/TeaserAnime-Vertical-HQ.mp4` | 2,5 Mo | H.264, 1080 × 1920, 30 i/s, 578 images, 19,27 s, BT.709 plage standard, sans son |
| `out/TeaserAnime-Vertical/TeaserAnime-Vertical-WhatsApp.mp4` | 1,5 Mo | idem, compressée (bien sous les 16 Mo) |
| `out/semaine-1/visuels-finaux/S1Logo-Carre-0000.png`, `S1Logo-Portrait-0000.png`, `S1Slogan-Carre-0000.png`, `S1Slogan-Portrait-0000.png`, `S1Question-Carre-0000.png`, `S1Question-Portrait-0000.png` | — | PNG 1080 × 1080 et 1080 × 1350 |

Copie de l’ensemble, pour la publication : `out/semaine-1/final/`.

### Contrôle (`pnpm controle`, sur les deux versions)

- **Fluidité** : les 578 images comparées chacune à la suivante. Aucun saut ni clignotement isolé. Vérifié en détail :
  - *chute des tuiles* (images 0 – 66) : cinq courbes régulières, une par tuile (montée, pic à la pose, décroissance du rebond), aucune image figée en plein mouvement ;
  - *page qui se tourne* (132 – 170) : passage de couleur d’apparition sur 3 images (132 – 134), puis une seule courbe régulière pendant le tour (143 – 157, pic 7,1), puis passage de disparition (167 – 169) ; plus aucune alternance ;
  - *passage vers l’hémicycle* (316 – 470) : migration des lettres en une courbe régulière, remplissage des gradins et fondus du logo sans à-coup.
  - Le seul pic isolé est l’image 497, cœur du passage de fond indigo → ivoire, volontairement bref (deux images intermédiaires), comme dans la démo validée.
- **Couleurs** : zones comparées au rendu PNG direct : 3/255 d’écart au plus (fond indigo et tuile A1 du logo, image 470 ; papier final, image 577 ; page, image 150).
- **Logo** : image 470 identique au pixel près à l’image de contrôle `ReferenceLogo-Vertical` avant encodage ; 3/255 au plus après.
- **Non vérifié** : la lecture sur un vrai téléphone et le passage par WhatsApp, qui recompresse.

## Corrections du porteur (version 1.2, rendue)

1. **LIRE et SAVOIR deviennent AGORA par un vrai mouvement** (version animée). Le plateau, le livre et le second plateau forment maintenant un seul plan continu sur la même table (`semaine-1/TableAnimee.tsx`, images 78 à 316) : plus de fondu entre deux plans de tuiles. Après la pose de SAVOIR, la grille s’efface ; L, I, S et le R de SAVOIR s’envolent hors du cadre (7,6 – 8,0 s) ; A, V, O (de SAVOIR), R et E (de LIRE) volent jusqu’à la rangée centrale (7,67 – 9,2 s). En vol, le V devient G et le E devient A, sur une seule tuile opaque : la lettre s’efface, puis la nouvelle apparaît (nouveau cas dans `TuileEnMigration`). Jamais deux tuiles semi-transparentes l’une sur l’autre. La finale prend le relais à 316 sans aucun écart (au plus 1/255).
2. **La page entre en glissant, déjà ivoire.** Le livre glisse dans le cadre par le bas (4,2 – 4,8 s), entièrement opaque, et ressort par le haut (6,07 – 6,67 s) : plus aucun changement de couleur, donc plus de ton gris-lavande. Pendant que le livre couvre le plateau, le cadre se recentre (invisible) pour accueillir SAVOIR.

La version avec plan filmé garde ses fondus entre plans filmés (le livre y glisse aussi) ; son passage vers AGORA sera à revoir avec le vrai plan, une fois `tuiles-plateau.mp4` déposé.

Images de contrôle : `out/semaine-1/corrections/` (planches `planche-a.png` 4,2 – 4,8 s, `planche-b.png` 6,8 – 7,6 s, `planche-c.png` 7,8 – 9,2 s).

**Rendu muet 1.2** (21/11/2026, son reporté à plus tard par le porteur) : `out/TeaserAnime-Vertical/TeaserAnime-Vertical-HQ.mp4` (2,7 Mo) et `-WhatsApp.mp4` (1,7 Mo), 578 images, 19,27 s ; copies dans `out/semaine-1/final/`. Contrôle sur les deux : aucun saut ni clignotement isolé, aucune alternance d’une image à l’autre ; glissement du livre (130 – 143, 182 – 196) et vol des tuiles vers AGORA (228 – 272) en courbes continues ; seul pic isolé : le passage de fond (497), voulu ; couleurs à 3/255 près du rendu direct.

**Son : reporté.** Le dossier `communication/assets/sons/` (bruitages et musiques) et les règles audio n’existent pas encore dans le projet.

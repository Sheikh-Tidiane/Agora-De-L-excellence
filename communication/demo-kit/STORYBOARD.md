# Démonstration du kit — storyboard (version 2)

Composition `DemoKit-Vertical` · vertical 1080 × 1920 · 30 i/s · 10 s (300 images) · sans son, sans musique.
Rôle : montrer le kit en mouvement (tuiles, texte cinétique, transition, hémicycle, révélation du logo) avant les vraies productions. Pas destinée à la publication telle quelle.

Narration sans son : un mot s’écrit en tuiles (« AGORA »), le club se résume en trois mots (ses trois dimensions). Puis les lettres d’AGORA rejoignent l’hémicycle : le A de valeur 1 prend la scène, les autres lettres deviennent des places des gradins, le public remplit le reste. C’est L’Agora de l’Excellence.

Tous les textes viennent de `docs/CONTENUS-CLUB.md` (§1 et §4). Aucune date, aucun lieu.

La version 2 répond à ton retour du 21/11/2026 : composition verticale rééquilibrée, transition organique (les tuiles rejoignent les gradins) à la place du rectangle qui montait, logo agrandi de 40 %, image finale vérifiée identique au fichier officiel. La matière des tuiles, les couleurs et la révélation du logo, validées, sont inchangées.

## Séquences (un seul plan continu)

| # | Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal | Vers la suite |
|---|---|---|---|---|---|
| 1 | 0,00 – 1,47 s | Papier ivoire. Au pied de l’image, en très faible contraste et en partie hors cadre, trois rangs de gradins (motif `ArcDeGradins`, immobile) qui équilibrent le bloc et annoncent l’hémicycle. Cinq tuiles tombent l’une après l’autre et écrivent « AGORA », centré sur l’axe, à 660 px du haut. | A1 G2 O1 R1 A1 (valeurs du Scrabble francophone) | Pose des tuiles : vol avec inertie, rotation qui se redresse, rebond court et amorti, ombre qui se resserre. Une tuile toutes les 0,17 s. | Le texte entre pendant que la dernière tuile se stabilise. |
| 2 | 1,33 – 4,17 s | Sous la rangée, centrées, les trois dimensions, ligne par ligne (128 px). « Sociale. » en terracotta. Le bloc tuiles + texte occupe 578 – 1 215 px : son centre optique est un peu au-dessus du milieu de l’image. | « Culturelle. » / « Intellectuelle. » / « Sociale. » | Texte cinétique, ligne par ligne (0,4 s d’écart). Tout est lisible à 2,67 s et reste immobile 1,5 s. | Le texte sort (fondu en montant, 0,4 s). |
| 3 | 4,17 – 5,50 s | **Transition.** Le texte s’efface (4,17 – 4,57 s). Les tuiles se soulèvent et voyagent : le premier A, de valeur 1, glisse au centre et grandit légèrement pour devenir la tuile A1 ; G, O, R et le dernier A perdent leur lettre (entièrement effacée à 4,60 s), prennent la teinte terracotta claire et se posent comme quatre places du rang intérieur. Une fois texte et lettres partis, le papier passe à l’indigo (4,67 – 4,77 s) : couleur interpolée en OKLCH par les bleus, deux images intermédiaires seulement ; le motif des gradins part avec le papier. | — | Migration des tuiles (0,87 s chacune, décalées de 0,1 s, le A passant au-dessus des autres). Le fond ne change qu’après la sortie du texte et l’effacement des lettres : aucun texte, aucune lettre sur un ton intermédiaire. | Les places restantes arrivent. |
| 4 | 5,47 – 7,60 s | Fond indigo. Autour de la tuile A1, les cinq places restantes du rang intérieur puis les treize du rang extérieur arrivent de l’extérieur, chacune dans l’axe de son gradin. | — | Remplissage des gradins. | — |
| 5 | 7,47 – 10,00 s | La matière des tuiles s’efface (ombres, reliefs), le symbole officiel prend le relais par fondu (géométrie identique : aucun saut), puis le logotype apparaît par fondu. Le logo fait 1 064 px de large (+40 %), centré à 900 px. Tenue finale de 1,2 s sur le logo complet. | Le logo (fichier officiel `logo-vertical-inverse.svg`, intact) | Fondus uniquement : le logo n’est ni déplacé, ni déformé, ni animé dans ses éléments. | Fin. |

Emplacements pour des plans filmés : aucun dans cette démonstration (le composant `<Emplacement>` est montré sur la planche du kit, `PlancheKit-Portrait`).

## Images clés

Rendues dans `out/demo-kit/images-cles/` (`pnpm images-cles DemoKit-Vertical 15 75 137 150 210 299 --sortie out/demo-kit/images-cles`).

| Image | Temps | Moment |
|---|---|---|
| 0015 | 0,50 s | Les premières tuiles d’AGORA se posent, O encore en vol |
| 0075 | 2,50 s | « AGORA » posé, les trois dimensions écrites : la composition de référence |
| 0137 | 4,57 s | Transition, début : le texte est sorti, les tuiles se soulèvent, le A part vers le centre |
| 0150 | 5,00 s | Transition, fin : fond indigo, la tuile A1 au centre, les lettres devenues places se posent |
| 0210 | 7,00 s | Les gradins presque complets autour de la tuile A1 |
| 0299 | 9,97 s | Image finale : le logo officiel |

## Vérifications

- **Logo officiel intact (point 4 de ton retour).** La dernière image a été comparée, pixel par pixel, à une image de contrôle qui ne contient que le fond et le fichier `public/logos/logo-vertical-inverse.svg` au même cadrage (composition `ReferenceLogo-Vertical`) : **0 pixel différent sur 2 073 600**. L’animation reconstruit l’hémicycle avec des tuiles, puis se termine par un fondu vers le symbole officiel (géométrie relevée dans `symbole.svg`), puis vers le logo vertical officiel ; à partir de 8,8 s, seul le fichier officiel est affiché.
- **Lisibilité sur téléphone (point 3).** Image finale réduite à 360 px de large : « DE L’EXCELLENCE » reste lisible. Avec le logo agrandi, le logotype occupe 870 px de large dans le cadre (contre 620 px).
- **Zones de sécurité.** Rangée de tuiles 97 – 983 px en largeur, texte et logo entre 578 et 1 340 px en hauteur : tout dans les marges (80 px sur les côtés, 250 px en haut, 300 px en bas). Seul le motif décoratif des gradins entre dans la marge du bas. Les marges transparentes du fichier du logo débordent du cadre, pas son dessin.
- **Temps de lecture.** Les trois dimensions sont lisibles 1,5 s une fois entières, le logotype 2 s.

## Autocritique

Corrections de la version 2 :

1. **Composition (refaite).** Le contenu tenait dans le haut de l’image. Désormais le bloc est centré sur l’axe, plus grand (tuiles 164 px, texte 128 px), son centre optique un peu au-dessus du milieu, et un motif de gradins au pied de l’image équilibre réellement le haut et le bas. Sur l’indigo, le logo agrandi occupe le centre.
2. **Transition (refaite).** Le rectangle qui montait du bas est remplacé par un mouvement qui raconte quelque chose : les lettres d’AGORA deviennent l’hémicycle. Trois défauts trouvés et corrigés pendant la mise au point : le texte encore visible sur un fond déjà en train de virer au gris (le fond attend maintenant que le texte soit sorti) ; G qui passait au-dessus du A pendant leur croisement (le A, plus soulevé, passe au-dessus) ; un fantôme de lettre quand une tuile devenait une place (une seule tuile désormais : sa lettre s’efface, sa couleur change).
3. **Lumière (corrigée dans tout le kit).** Les ombres CSS tournent avec l’élément : une place tournée de 80° recevait la lumière d’ailleurs que ses voisines. Ombres et reliefs sont maintenant contre-tournés : une seule direction de lumière, d’en haut à gauche, pour toutes les tuiles.
4. **Logo.** Agrandi de 40 % et vérifié au pixel près contre le fichier officiel.

Ce qui reste à juger, honnêtement :

- **Valeurs serrées contre la lettre** sur les tuiles de mots (R1, A1) : fidèle à la tuile A1 du logo, à réduire si tu préfères.

## Retouche du passage de fond (21/11/2026, version 2.1)

Ton retour : un gris-mauve terne sur 2 à 3 images vers 4,7 s, et des fantômes de lettres pendant ce passage.

- **Diagnostic.** Le fond passait par une transparence du papier sur l’indigo, c’est-à-dire un mélange RVB : le milieu tombait sur un gris. Mesuré en OKLCH, le chemin de teinte le plus court entre l’ivoire (87°) et l’indigo (270°) passe par les roses : c’est le mauve (#A2808A au milieu). Par l’autre sens, en tournant au rythme de la couleur, il passe par un vert-de-gris (#6D948B).
- **Correction dans le kit** (`src/kit/couleur.ts`, `PassageDeFond` dans `src/kit/Fonds.tsx`) : interpolation en OKLCH, teinte tournant par les bleus et installée dès 10 % du passage (quand la couleur est encore presque blanche), clarté et saturation interpolées régulièrement. Passage en 3 images : la dernière ivoire, **deux intermédiaires**, puis l’indigo. Mesures : 4,67 s ivoire #F0EDE7, 4,70 s #C2C7D4 (gris-bleu clair), 4,73 s #515C7E (bleu ardoise), 4,77 s indigo. Les teintes des tuiles qui deviennent des places sont, elles aussi, interpolées en OKLCH.
- **Lettres.** `TuileEnMigration` accepte un `effacementLettre` (début et fin, en images) : dans la démo, les lettres s’effacent de 4,27 à 4,60 s et ont entièrement disparu (opacité 0) avant que le fond ne bouge, à 4,67 s.

## Rendu final et contrôle (21/11/2026, version 2.1)

`pnpm export DemoKit-Vertical` :

| Fichier | Poids | Caractéristiques |
|---|---|---|
| `out/DemoKit-Vertical/DemoKit-Vertical-HQ.mp4` | 1,1 Mo | H.264, 1080 × 1920, 30 i/s, 300 images, 10,0 s, BT.709 plage standard, sans son |
| `out/DemoKit-Vertical/DemoKit-Vertical-WhatsApp.mp4` | 0,6 Mo | idem, compressée (bien sous les 16 Mo) |

Contrôle (avec `pnpm controle`, sur les deux versions) :

- **Fluidité** : les 300 images comparées chacune à la suivante : aucun saut, aucun clignotement isolé, y compris au passage de la rangée de tuiles aux tuiles en migration (image 128) et au passage des tuiles au symbole officiel. Le plus grand écart (image 142) est le cœur du passage ivoire → indigo, volontairement bref : il s’étale sur les images 141 à 143, sans image isolée.
- **Couleurs** : zones unies comparées au rendu PNG direct (images 140 à 143 du passage de fond, image de contrôle du logo officiel pour la dernière) : 3/255 d’écart au plus ; les deux images intermédiaires restent bleutées après encodage (#C1C6D5, #505A7C).
- **Logo** : la dernière image est le fichier officiel seul (0 pixel différent au rendu, voir « Vérifications ») ; dans la vidéo encodée, l’écart reste sous 3/255.
- **Netteté** : tuiles, texte et « DE L’EXCELLENCE » nets dans la version WhatsApp, vérifiés en pleine résolution.
- **Zones de sécurité et temps de lecture** : conformes (voir « Vérifications »).
- **Non vérifié** : la lecture sur un vrai téléphone et le passage par WhatsApp lui-même, qui recompresse.

# Semaine 2 — La révélation : storyboard (version 1.1, rendue)

Objectif : dire enfin ce qu’est le club, ses trois dimensions, ses cinq activités, son rythme, son slogan, et donner la date du lancement.

| Pièce | Composition | Format |
|---|---|---|
| Vidéo de présentation | `Presentation-Vertical` | vertical 1080 × 1920, 30 i/s, 47,3 s (1 418 images), sous-titrée, sans son |
| Même vidéo, emplacements visibles (validation) | `PresentationPlans-Vertical` | idem ; montre où iront les trois plans filmés |
| Save the date | `SaveTheDate-Vertical`, `SaveTheDate-Carre`, `SaveTheDate-Portrait` | 1080 × 1920, 1080 × 1080, 1080 × 1350 |

Code : `semaine-2/` — `contenus.ts` (tous les textes, avec la section de `CONTENUS-CLUB.md` dont ils viennent), `minutage.ts` (tout est calculé à partir des temps de lecture), `Motifs.tsx`, `Presentation.tsx`, `SaveTheDate.tsx`.

**Date du lancement** : le porteur du projet a donné le 21/11/2026 la date du **samedi 2 janvier 2027** (à la place du 26 décembre 2026) ; `docs/CONTENUS-CLUB.md` est mis à jour. L’heure, « à partir de 16 h », est celle du programme existant. Le lieu n’est pas confirmé : « Lieu dévoilé bientôt ».

## Narration sans son

Le logo se construit. « L’Agora de l’Excellence, c’est… » : trois mots, trois motifs de tuiles (une étagère, une grille de mots croisés, une ronde). Puis les cinq activités, au rythme d’une toutes les 2,3 s. Une rencontre tous les quinze jours. Le slogan. La date.

Tout ce qui est dit est écrit à l’écran : les titres en grand, les phrases d’explication en sous-titres intégrés (bandeau plein, Work Sans 44 px), posés juste sous ce qu’ils expliquent : sous le titre de la dimension (à 1 215 px du haut), sous la rangée de tuiles de l’activité (à 1 045 px).

## Langage de transition

Un seul, du début à la fin : les textes et les tuiles **sortent** (fondu et légère montée, 0,4 s), puis la suite **entre** ; quand le fond change, c’est par le **passage de fond OKLCH** validé (deux images intermédiaires bleutées), toujours une fois textes et tuiles sortis. Les tuiles se posent avec leur matière (poids, rebond, ombre).

## Séquences

| # | Temps | Fond | Ce qu’on voit | Texte à l’écran | Mouvement principal | Vers la suite |
|---|---|---|---|---|---|---|
| 1 | 0,00 – 5,73 | indigo | **Révélation du logo**, comme validée : les gradins se remplissent rang après rang, la tuile A1 se pose au centre, le logo officiel (`logo-vertical-inverse.svg`, 1 064 px) prend le relais par fondu. Logo complet tenu 1 s. | le logo | remplissage des gradins, pose de A1, fondus du logo | le logo sort (0,4 s), passage vers l’ivoire |
| 2 | 5,80 – 8,83 | ivoire | « L’Agora / de l’Excellence, / c’est… », centré, Young Serif 108 px ; « c’est… » en terracotta | idem | texte mot par mot | le texte sort |
| 3a | 8,97 – 14,17 | ivoire | **Culturelle.** Une étagère : SAVOIR en tuiles indigo, posées une à une sur un rayon terracotta qui se dessine dessous. Le mot « Culturelle. » en grand (150 px) sous l’étagère. | titre + sous-titre « Le goût de la lecture et de la recherche du savoir. » | pose des tuiles | motif et titre sortent |
| 3b | 14,30 – 18,17 | ivoire | **Intellectuelle.** Une grille de mots croisés : IDEE à l’horizontale croise SENS à la verticale sur le E final (tuile terracotta). | titre + « Stimuler la réflexion et enrichir le vocabulaire. » | pose des tuiles | idem |
| 3c | 18,30 – 22,50 | ivoire | **Sociale.** Une ronde : ENSEMBLE, huit tuiles terracotta clair en cercle, comme des personnes réunies. | titre + « Créer des rencontres, tisser des liens, évoluer ensemble. » | pose des tuiles | sortie, passage vers l’indigo |
| 4 | 22,80 – 34,47 | indigo | **Les cinq activités**, 2,3 s chacune, même gabarit : numéro (1/5…5/5, terracotta clair) et nom officiel en Young Serif 72 px ; un mot en tuiles ivoire posées très vite (une toutes les 2 images) : LECTURE, SCRABBLE, DEBATS, GENIES, CINE (sans accent, comme au Scrabble) ; une ligne d’explication en sous-titre. | « Un livre, chacun son interprétation. » / « Initiation, compétitions, classement mensuel. » / « Un sujet d’actualité, choisi et débattu. » / « Quiz, devinettes, éloquence, mémorisation. » / « Un film, suivi d’un débat. » | pose des tuiles, au rythme | chaque activité sort avant la suivante |
| 5 | 34,60 – 38,23 | indigo | « Une rencontre / tous les / quinze jours. », Young Serif 112 px ; « quinze jours. » en terracotta clair | idem | texte mot par mot | sortie, passage vers l’ivoire |
| 6 | 38,50 – 42,97 | ivoire | Le slogan, ligne par ligne, aligné à gauche (104 px) ; « flamme, » en terracotta | « Le savoir comme flamme, l’excellence comme ambition » | texte ligne par ligne | sortie |
| 7 | 43,10 – 47,27 | ivoire | **Le lancement** : étiquette « LANCEMENT », « Samedi / 2 janvier 2027 » en 124 px (« 2 » en terracotta), « À partir de 16 h » et « Lieu dévoilé bientôt » en étiquettes, puis le logo horizontal officiel apparaît par fondu. Tenu 2,8 s. | idem | lignes, puis fondu du logo | fin |

### Emplacements pour plans filmés (facultatifs)

| Activité | Fichier attendu | À filmer |
|---|---|---|
| Rendez-vous lecture | `communication/assets/plans/lecture.mp4` | une lecture partagée autour d’un livre |
| Tournois de Scrabble | `communication/assets/plans/scrabble.mp4` | une partie de Scrabble |
| Débats d’idées | `communication/assets/plans/debat.mp4` | un débat d’idées |

Ils sont **facultatifs** : tant qu’un fichier manque, la séquence reste entièrement animée (`Presentation-Vertical` est publiable telle quelle). Quand il est déposé, le plan passe en plein cadre sous un voile indigo (72 %) qui garde tuiles et textes lisibles. `PresentationPlans-Vertical` montre ces emplacements pour la validation. Conseils : vertical, 3 s utiles au moins, personnes ayant donné leur accord, de préférence vues de dos ou de profil, mains et livres.

## Save the date

Fond indigo, gradins en très faible contraste qui montent du bas, alignement à gauche : étiquette « RÉSERVEZ LA DATE · LANCEMENT » (terracotta clair), puis « Samedi / 2 janvier / 2027 » en très grand (Young Serif, « 2 » en terracotta clair), puis « À PARTIR DE 16 H » et « LIEU DÉVOILÉ BIENTÔT » ; logo horizontal inversé en bas à gauche. Deux tailles de texte. Tailles de la date : 176 px (vertical), 150 px (portrait), 128 px (carré).

## Images clés

Dans `communication/out/semaine-2/images-cles/` :

- vidéo : `pnpm images-cles Presentation-Vertical 100 140 230 360 490 620 715 790 930 1000 1090 1250 1415 --sortie out/semaine-2/images-cles` ;
- emplacements : `PresentationPlans-Vertical` 715 et 785 ;
- Save the date : les trois formats, image 0.

| Image | Temps | Moment |
|---|---|---|
| 0100 | 3,33 s | les gradins presque complets, la tuile A1 posée |
| 0140 | 4,67 s | le logo officiel |
| 0230 | 7,67 s | « L’Agora de l’Excellence, c’est… » |
| 0360 | 12,00 s | Culturelle : l’étagère SAVOIR |
| 0490 | 16,33 s | Intellectuelle : IDEE × SENS |
| 0620 | 20,67 s | Sociale : la ronde ENSEMBLE |
| 0715 · 0790 · 0930 · 1000 | 23,8 – 33,3 s | activités 1, 2, 4 et 5 |
| 1090 | 36,33 s | une rencontre tous les quinze jours |
| 1250 | 41,67 s | le slogan |
| 1415 | 47,17 s | image finale : le lancement |

## Autocritique

Corrigé pendant la mise au point :

1. **Faute dans les mots croisés** : SENS croisait IDÉE sur le É (on lisait « SÉNS » à la verticale). Le croisement se fait maintenant sur le E final.
2. **Étiquettes trop petites** : 30 px, soit 10 px sur un téléphone de 360 px. Passées à 34–36 px ; le nom des activités, d’abord en étiquette, est devenu un titre en Young Serif 72 px, ce qui donne une vraie hiérarchie (nom, tuiles, explication).

Ce qui me semble au niveau : un gabarit constant pour chaque famille (dimensions sur l’ivoire, activités sur l’indigo), un motif de tuiles propre à chaque dimension, le rythme régulier des activités, deux tailles de texte par écran, aucun texte pendant un changement de fond, tous les textes tirés de `CONTENUS-CLUB.md`.

À juger, honnêtement :

- **Durée : 47,3 s** au lieu d’environ 40 s. Tout est calé sur le temps de lecture (1 s pour 3 mots) ; pour revenir vers 40 s, il faudrait retirer une séquence (par exemple « c’est… ») ou raccourcir les phrases des dimensions.
- **Phrases raccourcies** : les phrases des dimensions et des activités sont des extraits de `CONTENUS-CLUB.md` (la source exacte est notée dans `contenus.ts`), raccourcis pour être lisibles en 2 à 4 s. Rien n’est ajouté, mais une partie du sens est laissée de côté (« le culte de l’excellence », « déployer les capacités intellectuelles », « l’Invité de l’Agora », « tous les trois mois » pour l’Agora Ciné).
- **Haut des écrans d’activités** un peu vide entre 250 et 560 px : il accueillera les plans filmés ; sans eux, c’est de l’espace négatif assumé.
- **Heure** : « à partir de 16 h » reprend le programme prévu pour le 26 décembre ; à confirmer pour le 2 janvier.
- Fluidité et rendu encodé non contrôlés : pas de rendu final avant ta validation.

## Retouches du porteur (version 1.1)

1. **Tuiles sans accents**, comme au Scrabble : IDEE (croisé avec SENS sur le E), DEBATS, GENIES, CINE. Les titres gardent leurs accents. La règle est dans le kit : `<Tuile>` retire accents et cédilles de lui-même. Semaine 1 vérifiée : aucune tuile accentuée (AGORA, LIRE, SAVOIR) ; images inchangées.
2. **Activité 3/5** : « Les Débats d’idées » est bien dans la vidéo (27,5 – 29,4 s, image clé 0860). L’Invité de l’Agora n’y est pas nommé : la ligne d’explication est « Un sujet d’actualité, choisi et débattu. »
3. **Phrases rapprochées** : les sous-titres sont posés sous le titre de la dimension (1 215 px) et sous la rangée de tuiles de l’activité (1 045 px) ; le bloc des activités est descendu de 60 px pour rester centré. Tout reste dans la zone de sécurité (250 – 1 620 px). Le composant `<SousTitres>` du kit accepte pour cela une position `haut`.
4. **Durée et « c’est… » gardés** (47,3 s). Pas de version courte : la même vidéo sert aux statuts WhatsApp (60 s au plus) ; au rendu final, `pnpm export` en produit la version compressée.
5. **Rendu du Save the date et de la séquence de date** : en attente de la confirmation du comité (samedi 2 janvier 2027, 16 h). La vidéo se termine sur cette date : son rendu final attend donc aussi.

Images clés corrigées : `communication/out/semaine-2/images-cles-v2/` (0360, 0490, 0620, 0715, 0790, 0860, 0930, 1000).

**Arrêt ici pour ta validation** : aucun rendu final n’a été fait.

## Rendu final (21/11/2026)

Date et heure confirmées par le comité : samedi 2 janvier 2027, à partir de 16 h (`CONTENUS-CLUB.md` mis à jour). Lieu toujours « dévoilé bientôt ».

| Fichier | Poids | Caractéristiques |
|---|---|---|
| `out/Presentation-Vertical/Presentation-Vertical-HQ.mp4` | 5,0 Mo | H.264, 1080 × 1920, 30 i/s, 1 418 images, 47,27 s, BT.709 plage standard, sans son |
| `out/Presentation-Vertical/Presentation-Vertical-WhatsApp.mp4` | 2,8 Mo | idem, compressée ; sert aussi aux statuts WhatsApp (60 s au plus) |
| `out/semaine-2/final/SaveTheDate-Vertical-0000.png`, `-Carre-0000.png`, `-Portrait-0000.png` | — | PNG 1080 × 1920, 1080 × 1080, 1080 × 1350 |

Copie de l’ensemble : `out/semaine-2/final/`. `PresentationPlans-Vertical` (aperçu des emplacements) n’est pas exporté ; dès qu’un plan est déposé dans `assets/plans/`, relancer `pnpm export Presentation-Vertical`.

**Défaut trouvé au contrôle et corrigé dans le kit** : le bandeau des sous-titres apparaissait et disparaissait en 5 images avec une courbe raide ; un bandeau plein « sautait » ainsi à sa première et à sa dernière image (pics isolés à 9,4 s, 14,8 s et à chaque fin de séquence). `<SousTitres>` fond maintenant sur 8 images, avec la courbe de fondu symétrique. Vidéo réexportée.

**Contrôle** (`pnpm controle`, sur les deux versions) :

- Fluidité : les 1 418 images comparées chacune à la suivante, aucun saut ni clignotement isolé. Les seuls pics sont les trois passages de fond OKLCH (images 174 – 176, 677 – 679, 1 148 – 1 150), voulus et brefs comme dans la démo validée ; plus un écart négligeable (0,8) à la sortie du slogan.
- Couleurs : zones comparées au rendu PNG direct (fond indigo du logo, papier, fond des activités, slogan, image finale) : 3/255 d’écart au plus.
- Logo : l’image 140 (logo complet) est identique au pixel près à l’image de contrôle du fichier officiel `logo-vertical-inverse.svg` (0 pixel différent avant encodage).
- Zones de sécurité et temps de lecture : conformes (voir les séquences).
- Non vérifié : la lecture sur un vrai téléphone et la recompression par WhatsApp.


## Mise à jour du 21/11/2026 (date et lieu définitifs)

Le comité a confirmé le lancement : **samedi 16 janvier 2027, à partir de 16 h, au Foyer des jeunes de Yeumbeul Nord**. `contenus.ts` est la seule source : la séquence 7 de la présentation et les trois Save the date affichent « 16 janvier 2027 » (« 16 » en accent) et le nom du lieu à la place de « Lieu dévoilé bientôt ». Les mentions du 2 janvier plus haut sont historiques. Rendu final à refaire (vidéo muette, version sonorisée avec le mixage validé, trois Save the date).

# Semaine 3 — Les cinq activités : storyboard de la série (version 1.1, rendue)

Une publication par activité, **même structure pour les cinq** : une vidéo verticale d’environ 12 s et un visuel portrait. Chaque activité a son motif en tuiles, construit avec le kit, et son numéro « 1/5 » à « 5/5 ». Textes tirés de `docs/CONTENUS-CLUB.md` §5 (sources citées dans `contenus.ts`). Aucune date ni aucun lieu : la série n’en a pas besoin.

| # | Activité | Fond | Motif en tuiles | Vidéo | Visuel |
|---|---|---|---|---|---|
| 1/5 | Les Rendez-vous lecture | ivoire | **Une pile de livres** : LIVRE, cinq tuiles indigo empilées et légèrement décalées, le V en terracotta ; elles se posent de bas en haut. | `S3Lecture-Vertical`, 12,0 s | `S3Lecture-Portrait` |
| 2/5 | Les Tournois de Scrabble | indigo | **Un chevalet** : la réglette terracotta apparaît, puis TOURNOI, sept tuiles ivoire debout dessus. | `S3Scrabble-Vertical`, 13,2 s | `S3Scrabble-Portrait` |
| 3/5 | Les Débats d’idées et l’Invité de l’Agora | ivoire | **Des mots croisés** : DEBAT à la verticale (indigo) croise INVITE à l’horizontale (terracotta) sur le T (terracotta clair). | `S3Debats-Vertical`, 12,5 s | `S3Debats-Portrait` |
| 4/5 | Les Génies du soir | indigo | **QUIZ** : quatre grandes tuiles jetées sur la table ; Q et Z, les lettres les plus chères (8 et 10 points), en terracotta. | `S3Genies-Vertical`, 12,0 s | `S3Genies-Portrait` |
| 5/5 | L’Agora Ciné | indigo | **Une pellicule** : la bande perforée glisse en place, puis CINE, une tuile dans chaque image. | `S3Cine-Vertical`, 12,0 s | `S3Cine-Portrait` |

Le fond alterne d’une publication à l’autre, pour le rythme du fil Instagram ; les Génies du soir et l’Agora Ciné, deux rendez-vous du soir, sont sur l’indigo.

## Structure commune de la vidéo (vertical 1080 × 1920, 30 i/s, sans son)

Un seul fond par vidéo, donc aucun changement de fond. Langage de transition : les tuiles se posent, les textes entrent et sortent par fondu (0,4 s).

| Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal |
|---|---|---|---|
| 0,2 – 2,0 s | Le motif se construit au centre du haut de l’image (centré à 600 px) : tuiles posées une à une, avec leur matière. | — (les lettres des tuiles) | pose des tuiles |
| 1,0 – 2,2 s | Sous le motif, centrés : le numéro « 3/5 » (terracotta), puis le nom de l’activité sur deux lignes, Young Serif 100 px. | « 3/5 · Les Débats d’idées » | titre ligne par ligne |
| 2,2 s – fin des phrases | Deux phrases, l’une après l’autre, dans le bandeau des sous-titres posé juste sous le titre (1 330 px). Chacune reste au moins 2,5 s, et le temps de la lire deux fois. | voir le tableau ci-dessous | fondu des sous-titres |
| fin des phrases – fin | Les phrases sortent ; la signature (logo horizontal officiel, 400 px) apparaît par fondu à leur place. Motif et titre restent : la dernière image, qui sert de vignette, montre l’activité et le club. Tenue 2 s au moins. | le logo | fondu |

Deux tailles de texte par écran : le titre (100 px) et les sous-titres (44 px).

| Activité | Phrase 1 | Phrase 2 |
|---|---|---|
| 1/5 Lecture | Des rencontres autour d’un livre, d’une nouvelle, d’un poème ou d’un discours. | Chacun partage son interprétation et son appréciation. |
| 2/5 Scrabble | D’abord des séances d’initiation, pour qui n’a jamais eu l’occasion de jouer. | Ensuite, des compétitions avec un classement mensuel et des records à battre. |
| 3/5 Débats | Un sujet d’actualité ou de société, et chacun défend ses idées. | L’Invité de l’Agora : une personnalité, sur place ou en visioconférence. |
| 4/5 Génies | Quiz de culture générale, devinettes et jeux de l’esprit. | Concours d’éloquence et de mémorisation. |
| 5/5 Ciné | Tous les trois mois, un film, un documentaire ou une conférence. | Suivi d’un débat sur l’interprétation du thème. |

Emplacements pour plans filmés : aucun dans cette série (les trois plans facultatifs de la semaine 2 pourront servir plus tard).

## Structure commune du visuel portrait (1080 × 1350)

Le motif posé en haut (centré à 330 px), puis, alignés à gauche à 96 px : le numéro (terracotta) et le nom en Young Serif 84 px, les deux phrases en un paragraphe (Work Sans 33 px), la signature en bas à gauche. Deux tailles de texte.

## Comité de pilotage : non réalisé

`docs/CONTENUS-CLUB.md` donne les quatre noms du comité, mais n’indique nulle part l’accord des membres pour apparaître dans la communication (ni rôles ni photos fournis). Le carrousel n’est donc pas fait. Il le sera dès que l’accord des quatre membres sera noté dans `CONTENUS-CLUB.md` (avec, si possible, leurs rôles et leurs photos dans `communication/assets/comite/`).

## Images clés

Dans `communication/out/semaine-3/images-cles/` : pour chaque vidéo, la construction du motif (0024), le titre (0070), la première phrase (0130), la seconde phrase et la dernière image ; pour chaque activité, le visuel portrait.

## Autocritique

Corrigé pendant la mise au point :

1. **Fin de vidéo trop vide** : le titre sortait et seul le logo restait, petit, au milieu de l’image. Le titre reste maintenant, la signature prend la place des phrases : la dernière image (la vignette) est complète.
2. **Visuel Scrabble** : le texte de quatre lignes touchait la signature. Titre et texte remontés de 50 px, texte en 33 px.

Ce qui me semble au niveau : une série reconnaissable au premier coup d’œil (même gabarit, même numérotation), un motif qui dit l’activité sans icône (une pile de livres, un chevalet, une grille, un quiz, une pellicule), deux tailles de texte, des phrases fidèles à `CONTENUS-CLUB.md`.

À juger, honnêtement :

- **Motif des Débats** : la grille DEBAT × INVITE reprend l’idée des mots croisés de la semaine 2 (IDEE × SENS). C’est cohérent, mais moins neuf que les autres motifs.
- **Pellicule de l’Agora Ciné** : la bande est un ivoire très transparent sur l’indigo ; elle se lit comme une pellicule sur l’image clé, à vérifier sur téléphone.
- **Phrases raccourcies** : extraits fidèles, mais « films historiques ou qui stimulent l’intelligence », « compétitions individuelles ou par équipes » et « les gagnants sont récompensés » ne sont pas repris.
- **Bas des vidéos** : entre la signature (1 360 – 1 510 px) et la zone de sécurité (1 620 px), de l’espace libre, assumé.
- Fluidité et rendu encodé non contrôlés : pas de rendu final avant ta validation.

**Arrêt ici pour ta validation** : aucun rendu final n’a été fait.

## Retouches du porteur et rendu final (22/11/2026)

Série validée, avec deux retouches :

1. **Pellicule de l’Agora Ciné** plus visible : bande en ivoire à 26 % (au lieu de 12 %), images à 42 % de sombre ; elle se lit en plein jour sans dépasser les tuiles ivoire pleines.
2. **Scrabble, visuel portrait** : texte complet de §5 B (« compétitions individuelles ou par équipes », « Les gagnants sont récompensés »), titre et texte remontés de 45 px pour laisser respirer la signature. Même ajout dans `LEGENDES.md`. Les vidéos restent telles quelles.

| Fichier | Poids | Durée |
|---|---|---|
| `out/S3Lecture-Vertical/S3Lecture-Vertical-HQ.mp4` | 0,9 Mo | 12,0 s |
| `out/S3Scrabble-Vertical/S3Scrabble-Vertical-HQ.mp4` | 0,6 Mo | 13,2 s |
| `out/S3Debats-Vertical/S3Debats-Vertical-HQ.mp4` | 1,0 Mo | 12,5 s |
| `out/S3Genies-Vertical/S3Genies-Vertical-HQ.mp4` | 0,5 Mo | 12,0 s |
| `out/S3Cine-Vertical/S3Cine-Vertical-HQ.mp4` | 0,5 Mo | 12,0 s |
| `out/semaine-3/final/S3*-Portrait-0000.png` | — | cinq visuels 1080 × 1350 |

Versions muettes H.264, 1080 × 1920, 30 i/s, BT.709 plage standard. Copies dans `out/semaine-3/final/`.

**Contrôle** (`pnpm controle`, versions HQ) : aucun saut ni clignotement sur les cinq vidéos (écart moyen d’une image à l’autre : 3,5 au plus, aucune image isolée) ; couleurs du fond et de la dernière image comparées au rendu PNG direct : 3/255 d’écart au plus. Non vérifié : lecture sur un vrai téléphone.

**Versions sonorisées WhatsApp : non faites.** Les sons demandés (page-tourne, sac-tuiles, brouhaha-groupe, ding-verre, projecteur, la musique et l’impact) ne sont pas dans le projet (`communication/assets/` ne contient que `plans/` et `comite/`, vides) ni ailleurs sur le poste, et aucune chaîne de mixage n’existe encore dans `communication/` : les semaines 1 et 2 n’ont pas été sonorisées ici.

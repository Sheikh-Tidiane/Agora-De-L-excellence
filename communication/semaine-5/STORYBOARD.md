# Semaine 5 — Jeux et engagement : storyboard (version 1, rendue)

Trois pièces de jeu, plus l’annonce du texte lu au lancement (section 4). Contenus vérifiés le 22/11/2026, sources dans `contenus.ts` et `LEGENDES.md`. Aucune date ni aucun lieu : ces publications n’en ont pas besoin.

| Pièce | Compositions | Format | Durée |
|---|---|---|---|
| 1. Trois défis Scrabble | `S5Defi1-Vertical` à `S5Defi3-Vertical` | vertical 1080 × 1920 | 15,0 s |
| 1 bis. Leurs réponses | `S5Reponse1-Vertical` à `S5Reponse3-Vertical` | vertical | 13,0 s |
| 2. Mini-quiz (carrousel) | `S5Quiz1-Portrait` à `S5Quiz7-Portrait` | portrait 1080 × 1350 | 7 diapositives |
| 3. Le mot de la semaine | `S5Mot1-Portrait` à `S5Mot3-Portrait`, `S5Mot1-Vertical` à `S5Mot3-Vertical` | portrait + vertical (statut) | visuels fixes |

## 1. Défis Scrabble

| Défi | Tirage (dans l’ordre) | Meilleur mot | Points |
|---|---|---|---|
| 1/3 | E L C E L X E | **EXCELLE** (il excelle) | E1 X10 C3 E1 L1 L1 E1 = **18** |
| 2/3 | N U A J L O R | **JOURNAL** | J8 O1 U1 R1 N1 A1 L1 = **14** |
| 3/3 | U X E Q I L E | **LEXIQUE** | L1 E1 X10 I1 Q8 U1 E1 = **23** |

Difficulté croissante : EXCELLE fait écho au nom du club, LEXIQUE réunit le Q et le X.

**Pourquoi « le meilleur mot » est sûr** : chaque mot emploie les sept tuiles, et toutes les lettres valent au moins 1 point ; un mot plus court vaut donc forcément moins. Aucun des trois n’a d’anagramme valide à l’ODS : pas d’ex æquo possible. Les tirages respectent le sac français (un seul J, Q et X). `contenus.ts` vérifie au chargement que chaque tirage donne bien le mot et que le total est juste (`valeurMot` du kit).

Règle du jeu affichée : on compte **la valeur des tuiles, sans plateau** (pas de case de couleur). La réponse précise qu’en partie, poser les sept tuiles rapporte en plus la prime de 50 points.

### Le défi (15 s, fond indigo des Tournois de Scrabble)

| Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal |
|---|---|---|---|
| 0,2 – 1,3 s | Surtitre, puis titre en deux lignes, centrés en haut (300 – 560 px). | « Défi Scrabble · 3/3 » · « Quel est le meilleur mot ? » | titre ligne par ligne |
| 1,3 – 3,7 s | La réglette terracotta apparaît, les sept tuiles ivoire tombent dessus une à une, dans l’ordre du tirage (820 px). | les lettres des tuiles | pose des tuiles |
| 3,3 s | Sous la réglette, la règle. | « Les 7 tuiles · leur valeur seule, sans plateau » | fondu |
| 4,4 – 9,4 s | Compte à rebours : une grande tuile terracotta par seconde, 5, 4, 3, 2, 1 ; chacune tombe, tient, se soulève et s’efface. | les chiffres | pose de tuile, chaque seconde |
| 9,4 – 12 s | La règle sort ; à la place du compte à rebours, l’appel entre mot par mot, puis la promesse de la réponse. | « Réponds en commentaire » · « La réponse dans la prochaine vidéo » | texte mot par mot |
| 12,2 – 15 s | La signature (logo horizontal officiel) apparaît par fondu. Le tirage reste : la dernière image (vignette) montre le défi. | le logo | fondu |

### La réponse (13 s, fond papier)

| Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal |
|---|---|---|---|
| 0,2 – 1 s | Surtitre et titre. | « Défi Scrabble · 3/3 · la réponse » · « Le meilleur mot » | titre |
| 1 – 3 s | Le même tirage se pose, en tuiles indigo, sur la réglette. | les lettres | pose des tuiles |
| 3,2 – 5,3 s | Les tuiles se soulèvent une à une et vont à leur place dans le mot (celle en vol passe au-dessus des autres). | LEXIQUE | déplacement des tuiles |
| 6,2 – 8,5 s | On compte : chaque tuile, de gauche à droite, fait un petit saut et ajoute sa valeur au compteur. | « 1 point » … « 23 points » | sauts et compteur |
| 9 s | La précision sur la prime. | « Sans case de couleur. En partie, poser les 7 tuiles rapporte en plus 50 points de prime. » | fondu |
| 10 – 13 s | Signature. Tenue 2 s au moins. | le logo | fondu |

Deux tailles de texte par écran dans les deux vidéos : Young Serif 96 px et Work Sans 34 px. Langage de transition : les tuiles se posent, les textes entrent et sortent par fondu. Aucun emplacement pour plan filmé.

## 2. Mini-quiz (carrousel portrait, 7 diapositives)

1. **Couverture**, sur l’indigo des Génies du soir, avec leur motif QUIZ (semaine 3) : « Les Génies du soir · mini-quiz », « Cinq questions de littérature sénégalaise et africaine », « Note tes réponses, puis glisse jusqu’à la dernière image. »
2. à 6. **Une question par diapositive**, sur le papier : « Question 1/5 », la question en Young Serif, trois réponses possibles avec des tuiles A, B, C (sans valeur, toutes indigo : aucune n’est mise en avant).
7. **Les réponses**, sur l’indigo : « Combien en as-tu ? », la tuile de la bonne lettre et la réponse développée.

| # | Question | Réponses proposées | Bonne réponse |
|---|---|---|---|
| 1 | Qui a écrit « Une si longue lettre » (1979) ? | Aminata Sow Fall · Mariama Bâ · Ken Bugul | B · Mariama Bâ, prix Noma 1980 |
| 2 | Qui est l’auteur de « L’Aventure ambiguë » (1961) ? | Birago Diop · Ousmane Sembène · Cheikh Hamidou Kane | C · Cheikh Hamidou Kane |
| 3 | Qui fut le premier Africain à siéger à l’Académie française (élu en 1983) ? | Léopold Sédar Senghor · Aimé Césaire · Amadou Hampâté Bâ | A · Senghor, élu le 2 juin 1983 |
| 4 | Quel écrivain sénégalais a reçu le prix Goncourt en 2021 ? | Boubacar Boris Diop · David Diop · Mohamed Mbougar Sarr | C · Mohamed Mbougar Sarr |
| 5 | Premier écrivain africain lauréat du prix Nobel de littérature (1986) ? | Chinua Achebe · Wole Soyinka · Ngũgĩ wa Thiong’o | B · Wole Soyinka |

Bonnes réponses réparties sur A, B et C. Deux tailles de texte par diapositive (Young Serif 64 px pour la question, Work Sans 36 px pour le reste ; 84 px pour le titre de la couverture).

## 3. Le mot de la semaine

Modèle sur le papier, en portrait (fil) et en vertical (statut WhatsApp) : surtitre « Le mot de la semaine · n° 1 », le mot en tuiles (sans accents, la première en terracotta), le mot écrit avec ses accents (Young Serif 104 px), sa nature en italique, la définition, un exemple rédigé pour le club, la signature. Pour un nouveau mot : l’ajouter à `motsDeLaSemaine` dans `contenus.ts`, avec ses sources ; les deux visuels se créent seuls.

| N° | Mot | Nature | Définition (reformulée d’après Larousse et CNRTL) |
|---|---|---|---|
| 1 | Sérendipité | nom féminin | Le fait de découvrir par hasard, en cherchant autre chose, et d’avoir l’esprit d’en saisir la valeur. |
| 2 | Psittacisme | nom masculin | Le fait de répéter des mots ou des formules sans les comprendre, comme un perroquet. |
| 3 | Palimpseste | nom masculin | Parchemin dont on a effacé le premier texte pour en écrire un autre. Au figuré : ce qui garde la trace de ce qui l’a précédé. |

Les trois sont aussi valides au Scrabble (ODS, d’après 1mot.net).

## 4. Annonce du texte lu au lancement (ajoutée le 22/11/2026, rendue)

Texte choisi par le porteur de projet, **à confirmer par le comité** (`docs/CONTENUS-CLUB.md` §8) : « Les Mamelles », conte de Birago Diop, dans « Les Contes d’Amadou Koumba » (Fasquelle, 1947). Le conte raconte l’origine des deux collines de Dakar (https://fr.wikipedia.org/wiki/Les_Contes_d%27Amadou_Koumba). Birago Diop (1906-1989) : texte protégé par le droit d’auteur, donc **aucune citation**, seulement le titre, l’auteur, le recueil et une accroche écrite pour le club.

| Composition | Format | Durée |
|---|---|---|
| `S5TexteLancement-Vertical` | vertical 1080 × 1920 | 16,0 s |
| `S5TexteLancement-Portrait` | portrait 1080 × 1350 | visuel fixe |

**Motif : les deux collines.** Deux dômes de places sans lettre, couleur latérite (la grande en terracotta, trois rangées ; la petite en terracotta clair, deux rangées). Chaque rangée est un arc, chaque place suit la courbe : les gradins du logo, retournés en collines. Pas de phare ni de monument : seules les deux collines sont dessinées.

### La vidéo (16 s, fond indigo)

| Temps | Ce qu’on voit | Texte à l’écran | Mouvement principal |
|---|---|---|---|
| 0,2 s | Surtitre en haut à gauche (300 px). | « Le conte du lancement » | fondu |
| 0,5 – 3 s | Les places se posent une à une, arc après arc, de gauche à droite : les deux collines se dessinent (base à 880 px). | — | pose des tuiles |
| 3,1 – 5,6 s | Première phrase de l’accroche, mot par mot, sous les collines (960 px). | « Dakar a deux collines. » | texte mot par mot |
| 5,9 – 8,9 s | Seconde phrase, « conte » en terracotta clair. | « Un conte dit d’où elles viennent. » | texte mot par mot |
| 9,1 s | Le titre entre. | « Les Mamelles » | titre |
| 9,9 s | L’auteur et le recueil. | « Un conte de Birago Diop » · « « Les Contes d’Amadou Koumba », 1947 » | fondu |
| 11,5 s | La date, l’heure et le lieu, en étiquettes. | « Samedi 16 janvier 2027 · 16 h » · « Foyer des jeunes de Yeumbeul Nord » | fondu |
| 13 – 16 s | Signature (logo horizontal officiel, 360 px, 1 420 px). Tout reste : la dernière image sert de vignette. | le logo | fondu |

Deux tailles de texte : Young Serif 96 px (accroche, titre) et Work Sans 34 px (surtitre, auteur, recueil, date, lieu). Un seul fond, aucun changement de fond. Aucun emplacement pour plan filmé (un plan des collines filmé par le club pourrait remplacer le motif plus tard).

### Le visuel portrait

Surtitre, collines (base à 460 px), titre (Young Serif 96 px), l’accroche en une phrase, l’auteur et le recueil, la date et le lieu, la signature en bas à gauche. Deux tailles de texte.

### Autocritique

- **Première version refaite** : les collines étaient des rangées de tuiles droites empilées en escalier, qui se lisaient comme un mur de briques. Refaites en arcs, places tournées selon la courbe : elles se lisent comme des collines et rappellent les gradins du logo.
- **Collines qui se touchaient** : écartées, en restant dans la marge de 80 px des côtés.
- Lisibilité vérifiée sur la dernière image réduite à 375 px de large (`out/semaine-5/lancement-telephone.png`).
- **À trancher** : le choix du texte est « à confirmer par le comité ». Les règles de la communication demandent de ne rien afficher d’« à confirmer » comme acquis : je conseille de ne publier cette annonce qu’après la confirmation du comité. Si le comité préfère « Souffles », seuls le titre, le mot « conte » (qui deviendrait « poème »), le recueil, l’année et l’accroche sont à changer, dans `contenus.ts`.

Images clés : `out/semaine-5/lancement/` (0040 construction, 0130 et 0230 accroche, 0300 titre, 0479 dernière image, portrait). Planche : `out/semaine-5/planche-lancement.png`.

**Rendu final** (validé par le porteur sans retouche) : `out/S5TexteLancement-Vertical/S5TexteLancement-Vertical-HQ.mp4` (0,9 Mo) et `-WhatsApp.mp4` (0,7 Mo), 16,0 s, 480 images ; visuel `out/semaine-5/final/S5TexteLancement-Portrait-0000.png`. Copies dans `out/semaine-5/final/`.

**Contrôle** (`pnpm controle`, HQ et WhatsApp) : aucun saut ni clignotement (écart moyen d’une image à l’autre : 1,5 au plus) ; couleurs de la dernière image comparées au rendu PNG direct : 2 à 5/255 d’écart. Non vérifié : lecture sur un vrai téléphone. Rappel : à publier après la confirmation du texte par le comité.

## Kit

La réglette du chevalet servait déjà en semaine 3 : elle devient `<Reglette>` dans le kit (avec `placeSurReglette()`). Le motif Scrabble de la semaine 3 l’utilise ; son visuel portrait, rendu à nouveau, est identique au pixel près au fichier livré.

## Images clés

Dans `communication/out/semaine-5/cles/` : pour chaque défi, le tirage (0110), le compte à rebours (0250) et la dernière image (0440) ; pour chaque réponse, le tirage (0060), le rangement en vol (0120) et la dernière image (0380) ; les sept diapositives du quiz ; les trois mots en portrait et en vertical. Planches réduites : `out/semaine-5/planche-*.png`.

## Autocritique

Corrigé pendant la mise au point :

1. **Comptage des points** : la tuile comptée passait de l’indigo à la terracotta et traversait un violet (le chemin le plus court entre ces deux teintes passe par le magenta). Remplacé par un petit saut de la tuile, sans changement de couleur.
2. **Rangement** : une tuile en vol passait sous une tuile posée. La tuile en vol passe maintenant au-dessus.
3. **« 1 points »** : accordé au singulier.
4. **Quiz** : la tuile B était en terracotta sur chaque question, ce qui se lisait comme un indice (B est la bonne réponse des questions 1 et 5). Toutes les tuiles sont indigo. Le titre de la couverture débordait sur la phrase : recoupé en quatre lignes.
5. **Deux tailles de texte** : les surtitres du quiz et des mots formaient une troisième taille ; ils sont à la taille du texte.
6. **Mot de la semaine, vertical** : le bloc était collé en haut avec un grand vide en bas ; il est descendu.

Ce qui me semble au niveau : les défis se lisent sans son et se jouent vraiment (tirage, règle, compte à rebours, appel) ; la réponse montre le mot se former puis se compter, ce qui rend le calcul vérifiable par chacun ; le quiz et le mot de la semaine sont des gabarits réutilisables, dans l’identité.

À juger, honnêtement :

- **Compte à rebours de 5 s** : court pour trouver LEXIQUE. C’est ce que demande le prompt ; la pause du lecteur fait le reste.
- **« La réponse dans la prochaine vidéo »** : vrai seulement si la réponse est publiée ensuite (le lendemain, voir `LEGENDES.md`).
- **Chiffres du compteur** : Young Serif dessine des chiffres elzéviriens (le 1 est petit). Cohérent avec la police du logo, mais moins « tableau de score ».
- **Bas des vidéos** : de l’espace libre entre la signature (vers 1 560 px) et la zone de sécurité (1 620 px), assumé.
- Fluidité et rendu encodé non contrôlés : pas de rendu final avant ta validation.

**Arrêt ici pour ta validation** (méthode §6) : aucun rendu final n’a été fait.

## Rendu final (22/11/2026)

Validé par le porteur sans retouche. Le texte lu au lancement reste en attente (section 4).

| Fichier | Poids | Durée |
|---|---|---|
| `out/S5Defi1-Vertical/` à `out/S5Defi3-Vertical/` : `-HQ.mp4` et `-WhatsApp.mp4` | 0,8 Mo et 0,6 Mo | 15,0 s |
| `out/S5Reponse1-Vertical/` à `out/S5Reponse3-Vertical/` : `-HQ.mp4` et `-WhatsApp.mp4` | 1,1 Mo et 0,7 Mo | 13,0 s |
| `out/semaine-5/final/S5Quiz1-Portrait-0000.png` à `S5Quiz7-…` | — | 7 diapositives 1080 × 1350 |
| `out/semaine-5/final/S5Mot1-…` à `S5Mot3-…`, `-Portrait` et `-Vertical` | — | 6 visuels |

Vidéos muettes H.264, 1080 × 1920, 30 i/s, BT.709 plage standard. Copies de toutes les vidéos dans `out/semaine-5/final/`.

**Contrôle** (`pnpm controle`, les 12 fichiers) : aucun saut ni clignotement (écart moyen d’une image à l’autre : 2,6 au plus). Couleurs de la dernière image comparées au rendu PNG direct (`out/semaine-5/reference/`), défi 3 et réponse 3, HQ et WhatsApp : 1 à 4/255 d’écart sur les fonds, les tuiles et le texte ; 6 à 8 sur une zone à cheval entre une tuile ivoire et le fond indigo, où l’encodage lisse toujours un peu les bords (invisible à l’œil). Non vérifié : lecture sur un vrai téléphone.

## Annonce du conte : surtitre et version sonorisée (22/11/2026)

Retours du porteur : surtitre « Le conte du lancement » (au lieu de « Le texte du lancement ») dans la vidéo, le visuel et `LEGENDES.md` ; il vient maintenant d’une seule source, `texteLancement.surtitre` dans `contenus.ts`. Et la version WhatsApp doit avoir du son (un statut WhatsApp ne permet pas d’ajouter une musique, contrairement à Instagram et TikTok) : c’est une décision du porteur, qui fait exception à « aucune musique intégrée » pour cette version seulement. La version HQ reste muette.

**Chaîne de son** (nouvelle, réutilisable) : `pnpm sonoriser <Id> <bande.mjs>`, après `pnpm export <Id>`. Tous les sons sont synthétisés dans le projet (`scripts/son/synthese.mjs`) : rien n’est téléchargé, aucune question de droits.

| Élément | Comment | Calage |
|---|---|---|
| Poses des tuiles | Un choc de bois bref (deux résonances, un petit corps grave) par place, placé à gauche ou à droite selon sa position, plus le petit rebond à peine audible | à l’image exacte du contact de chacune des 50 places (0,87 – 2,50 s), lue dans `geometrieCollines.ts`, la même source que la vidéo |
| Musique douce, couleur de conte | Cordes pincées façon kora (Karplus-Strong), fa majeur, arpèges lents à 80 à la noire, en ostinato ; basse pincée ; bourdon fa-do très doux ; réverbération légère | une mesure de 3 s par accord : fa, si bémol, fa, do (sur le titre), fa (résolution, puis accord final égrené sous le logo) ; montée lente sur 2,2 s pour laisser d’abord entendre les tuiles, fondu de sortie de 1,6 s |
| Impact du titre | Grave feutré (64 Hz qui descend, souffle sourd), sans attaque dure ; il tient lieu de basse sur sa mesure | 9,2 s, à l’entrée de « Les Mamelles » |
| Impact du logo | Même grave, plus bas (56 Hz), et une petite cloche douce | 13,2 s, à l’apparition du logo |

**Mixage** : équilibre réglé sur la mesure de chaque piste (les crêtes des tuiles et des impacts arrivent sous le plafond, la musique porte le volume), normalisation en plusieurs passes avec un limiteur à anticipation (3,7 dB au plus, sur des attaques brèves), plafond à −2 dBTP avant l’encodage AAC (qui fait remonter le pic d’environ 0,5 dB).

Corrigé pendant la mise au point : un bogue de la corde pincée (deux cases de sa boucle n’étaient jamais mises à jour : les notes aiguës ne s’éteignaient pas et s’accumulaient) ; l’impact du titre et la basse de la même mesure s’additionnaient (+4,9 dB) : la basse de cette mesure est retirée.

**Rendu et contrôle**

| Fichier | Poids | Contenu |
|---|---|---|
| `out/S5TexteLancement-Vertical/S5TexteLancement-Vertical-HQ.mp4` | 0,9 Mo | muet, 16,0 s |
| `out/S5TexteLancement-Vertical/S5TexteLancement-Vertical-WhatsApp.mp4` | 1,0 Mo | image + son AAC 48 kHz stéréo 160 kb/s, 16,0 s |
| `out/S5TexteLancement-Vertical/S5TexteLancement-Vertical-bande-son.wav` | 4,6 Mo | la bande seule, WAV 24 bits |
| `out/semaine-5/final/S5TexteLancement-Portrait-0000.png` | — | visuel portrait |

Copies dans `out/semaine-5/final/`.

- Volume du fichier WhatsApp final, après encodage : **−14,1 LUFS intégrés, pic vrai −1,9 dBTP** (filtre loudnorm de ffmpeg), confirmé par une seconde mesure indépendante (filtre ebur128 d’un autre ffmpeg : −14,1 LUFS, crête −1,9 dB).
- Synchronisation : la crête de chaque choc tombe à 2,2 ms en moyenne de l’image de contact de sa tuile (11 ms au pire, un tiers d’image).
- Image : fluidité sans saut ni clignotement sur les deux versions ; couleurs de la dernière image à 2 – 3/255 du rendu direct ; l’image de la version WhatsApp est recopiée telle quelle (pas de second encodage).
- **Non vérifié : l’écoute.** Je ne peux pas écouter : la bande est contrôlée par la mesure, pas à l’oreille. À écouter sur un téléphone avant de publier, en particulier l’équilibre entre les tuiles et la musique.
- Rappel : le texte est encore « à confirmer par le comité » (`CONTENUS-CLUB.md`) ; publier après leur accord.

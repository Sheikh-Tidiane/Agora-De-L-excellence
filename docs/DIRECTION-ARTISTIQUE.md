# Direction artistique — « La page et le gradin »

> Référence pour toutes les pages. Toute nouvelle page se vérifie contre ce document (CLAUDE.md §7.5).

## 1. Le concept

Le logo montre un théâtre antique vu du dessus : des gradins faits de tuiles de lettres, et sur la scène la tuile A1. L'identité du site prolonge cette image avec deux matières seulement.

- **La page** : l'ivoire d'un beau papier, une grande serif chaleureuse, des colonnes de lecture, des marges généreuses. C'est la maison d'édition.
- **Le gradin** : des tuiles posées en arc, des rangées, une scène où l'on met quelque chose en avant (un livre, une rencontre, un classement). C'est l'agora et le Scrabble.

Chaque écran est une page sur laquelle on a posé quelques tuiles. Jamais l'inverse : la tuile ponctue, elle ne tapisse pas.

Le ton est celui d'un club qui reçoit : on tutoie la littérature, on vouvoie le lecteur. Phrases courtes, concrètes, ancrées à Dakar. Pas de superlatifs.

## 2. Palette

Issue du logo, sans ajout décoratif. Ratios de contraste calculés (WCAG 2.1).

| Token              | Valeur    | Usage                                                               | Contraste vérifié                                        |
| ------------------ | --------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| `indigo`           | `#1F2A55` | Titres, texte courant, sections sombres, boutons principaux         | 12,6:1 sur ivoire ; 13,8:1 sur blanc ; 11,2:1 sur sable  |
| `terracotta`       | `#C2562E` | Tuiles, filets, gros titres d'accent (≥ 24 px), éléments graphiques | 4,1:1 sur ivoire : **jamais pour du petit texte**        |
| `terracotta-fonce` | `#A9471F` | Liens, surtitres, bouton d'action (texte blanc)                     | 5,3:1 sur ivoire ; 5,8:1 avec du blanc ; 4,7:1 sur sable |
| `terracotta-clair` | `#E08A5F` | Accent sur indigo, survols                                          | 5,2:1 sur indigo                                         |
| `ivoire`           | `#F7F4ED` | Fond de page                                                        | —                                                        |
| `sable`            | `#EDE7D9` | Fond de section alterné, pistes de carrousel, skeletons             | —                                                        |
| `trait`            | `#E4DDCC` | Filets et séparateurs (décoratifs, pas porteurs d'information)      | —                                                        |
| `blanc`            | `#FFFFFF` | Cartes, champs, face des tuiles claires                             | —                                                        |
| `gris`             | `#5E6478` | Texte secondaire                                                    | 5,4:1 sur ivoire ; 5,9:1 sur blanc ; 4,8:1 sur sable     |

Couleurs fonctionnelles, dans la même famille chaude et sourde :

| Token    | Texte                            | Fond associé | Contraste texte/fond     |
| -------- | -------------------------------- | ------------ | ------------------------ |
| `succes` | `#2F6B4F` (vert de bissap séché) | `#E4EDE4`    | 5,3:1 (5,7:1 sur ivoire) |
| `alerte` | `#85540F` (brun de cola)         | `#F3E7D0`    | 5,2:1 (5,8:1 sur ivoire) |
| `erreur` | `#9B1C31` (rouge lie)            | `#F6E1DF`    | 6,4:1 (7,3:1 sur ivoire) |

Règles : fonds ivoire dominants ; une ou deux sections indigo par page pour le contraste ; la terracotta ne couvre jamais plus qu'un bouton ou une tuile. Pas d'or, pas de dégradé. L'erreur est un rouge lie nettement plus froid que la terracotta, pour ne jamais être confondue avec l'accent.

## 3. Typographie

Deux familles, trois fichiers de police au total.

- **Young Serif 400** : titres. Une seule graisse : la hiérarchie se fait par la taille et l'interlignage serré.
- **Work Sans 400 / 600 / 700** (fichier variable) : interface et texte courant.

| Rôle           | Mobile | Desktop   | Interligne | Notes                                                        |
| -------------- | ------ | --------- | ---------- | ------------------------------------------------------------ |
| Affiche (hero) | 44 px  | 88–104 px | 0,98       | Young Serif, approche −0,02 em                               |
| Titre 1        | 34 px  | 60 px     | 1,05       | Young Serif                                                  |
| Titre 2        | 26 px  | 40 px     | 1,1        | Young Serif                                                  |
| Titre 3        | 20 px  | 24 px     | 1,2        | Young Serif                                                  |
| Chapô          | 18 px  | 21 px     | 1,5        | Work Sans 400, 60 caractères max                             |
| Courant        | 16 px  | 17 px     | 1,6        | Work Sans 400, 60–75 caractères                              |
| Petit          | 14 px  | 14 px     | 1,45       | Work Sans 400                                                |
| Surtitre       | 12 px  | 13 px     | 1,2        | Work Sans 700, capitales, approche 0,16 em, terracotta foncé |

Le surtitre reprend « DE L’EXCELLENCE » du logo. Un par section au maximum. Typographie française : apostrophe ’, guillemets « », espaces insécables avant ; : ? !.

## 4. Composition

- **Grille** : 4 colonnes à 375 px (marges 20 px), 8 à 768 px, 12 à 1440 px (largeur utile 1240 px, marges 48 px minimum).
- **Asymétrie maîtrisée** : les titres s'alignent à gauche et occupent 7 colonnes sur 12 ; le contrepoids (couverture, hémicycle, fiche) part à droite et peut sortir du cadre. Rien n'est centré par défaut.
- **L'hémicycle** : des arcs de tuiles générés (jamais le logo copié), toujours plus grands que leur conteneur et rognés par un bord. Ils servent de scène : ce qui est posé au centre est ce que la section met en avant.
- **La tuile** : carré aux coins doux (rayon 14 % du côté), lettre en Young Serif, valeur en indice en bas à droite en Work Sans gras. Elle sert d'initiale (lettrine de section), de numéro, de rang au classement, d'indicateur de chargement. Les valeurs sont celles du Scrabble francophone.
- **Les couvertures** : toujours « posées », légèrement en avant de la page par une ombre courte et nette, jamais flottantes. En série, elles s'alignent par le pied comme sur une étagère.
- **Filets plutôt que boîtes** : les listes (événements, actualités) sont séparées par un filet `trait` de 1 px. Les cartes à bordure sont l'exception.
- **Rythme vertical** : 72 px entre sections sur mobile, 144 px sur desktop. Un blanc généreux avant chaque titre, un blanc serré après.
- **Formes** : rayons 4 px (couvertures), 10 px (boutons, champs), 16 px (feuilles et panneaux). Aucune pilule, sauf les étiquettes.
- **Ombres** : deux seulement. `posee` (couvertures et tuiles : 0 1px 0 + 0 8px 16px −8px, indigo à 25 %) et `feuille` (bottom sheet). Rien d'autre ne porte d'ombre.

## 5. Animations

Sobres, courtes, uniquement `transform` et `opacity`.

- **Apparition au défilement** : montée de 16 px et fondu, 500 ms, courbe `cubic-bezier(0.2, 0.7, 0.2, 1)`, une seule fois. Les tuiles d'un arc arrivent en cascade (30 ms d'écart), comme un public qui s'installe.
- **Pression** : les boutons et les tuiles s'enfoncent de 1 à 2 px (120 ms). Survol desktop : les couvertures se soulèvent de 4 px.
- **Transitions d'état** : 200 ms. Menu plein écran et bottom sheet : 320 ms.
- **Chargement** : skeletons couleur sable à pulsation lente ; pour les attentes longues, trois tuiles qui se retournent.
- `prefers-reduced-motion` : tout mouvement est supprimé, les contenus sont visibles d'emblée.
- Le logo lui-même n'est jamais animé.

## 6. Ce qui rend l'identité reconnaissable

1. L'arc de tuiles rogné par le bord de l'écran.
2. La tuile-initiale avec sa valeur en indice, à la place des icônes.
3. Le couple Young Serif en grand corps / petites capitales terracotta.
4. L'indigo et la latérite sur ivoire, sans aucune autre teinte.
5. Les couvertures typographiques alignées par le pied.

## 7. Comment elle évite les pièges du §7.3

| Piège                                          | Réponse                                                                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero centré, titre + sous-titre + deux boutons | Titre calé à gauche en très grand corps ; l'hémicycle monte du bas de l'écran avec le livre du mois sur la scène ; une seule action principale, plus un lien texte |
| Dashboard « kit shadcn »                       | Les composants shadcn sont réhabillés (rayons, hauteurs, couleurs, focus) ; l'admin garde la serif pour les titres, les filets et la tuile pour les chiffres clés  |
| Dégradés, néon, glassmorphism, ombres lourdes  | Aplats uniquement ; deux ombres courtes ; aucune transparence floutée                                                                                              |
| Bordures partout, grilles de cartes identiques | Filets horizontaux, étagère de couvertures, listes éditoriales ; chaque section a sa propre composition                                                            |
| Icônes décoratives                             | Les tuiles-initiales et les arcs remplacent les pictogrammes ; Lucide est réservé aux actions d'interface (menu, fermer, flèche)                                   |
| Textes de remplissage                          | Textes rédigés pour le club : lieux, jours, activités réelles du cahier des charges. Aucune statistique ni témoignage inventés                                     |
| shadcn par défaut                              | Tokens propres ; aucune classe `rounded-md`/`shadow-sm` d'origine conservée                                                                                        |

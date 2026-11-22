/**
 * Semaine 5 : jeux et engagement. Chaque mot, tirage, définition et réponse est vérifié ;
 * les sources sont notées ici et dans LEGENDES.md (vérification du 22/11/2026).
 * Les tuiles s’écrivent sans accent, comme au Scrabble.
 */
import { valeurMot } from "../src/kit";

// ─── 1. Défis Scrabble ────────────────────────────────────────────────────────

export type Defi = {
  numero: number;
  /** Les 7 tuiles, dans l’ordre du tirage (mélangées). */
  tirage: string;
  /** Le meilleur mot : il emploie les 7 tuiles, donc aucun mot plus court ne peut valoir plus. */
  mot: string;
  /** Valeur des tuiles, sans case de couleur (contrôlée contre valeurMot au chargement). */
  points: number;
};

/**
 * Pourquoi « le meilleur mot » est sûr : chaque mot emploie les 7 tuiles du tirage, et
 * toutes les lettres valent au moins 1 point ; un mot plus court vaut donc forcément moins.
 * Aucun des trois n’a d’anagramme valide (1mot.net, qui suit l’ODS), donc pas d’ex æquo.
 * Sources : https://1mot.net/excelle, https://1mot.net/journal, https://1mot.net/lexique ;
 * valeurs et nombre de lettres du sac : https://fr.wikipedia.org/wiki/Lettres_du_Scrabble ;
 * prime de 50 points : https://fr.wikipedia.org/wiki/Scrabble.
 */
export const defis: Defi[] = [
  // E1 X10 C3 E1 L1 L1 E1 = 18. Forme du verbe exceller (il excelle) : l’excellence, en un mot.
  { numero: 1, tirage: "ELCELXE", mot: "EXCELLE", points: 18 },
  // J8 O1 U1 R1 N1 A1 L1 = 14.
  { numero: 2, tirage: "NUAJLOR", mot: "JOURNAL", points: 14 },
  // L1 E1 X10 I1 Q8 U1 E1 = 23. Le défi le plus difficile : Q et X dans le même tirage.
  { numero: 3, tirage: "UXEQILE", mot: "LEXIQUE", points: 23 },
];

for (const d of defis) {
  const trie = (m: string) => [...m].sort().join("");
  if (trie(d.tirage) !== trie(d.mot) || d.tirage.length !== 7) throw new Error(`Défi ${d.numero} : le tirage ne donne pas ${d.mot}`);
  if (valeurMot(d.mot) !== d.points) throw new Error(`Défi ${d.numero} : ${d.mot} vaut ${valeurMot(d.mot)}, pas ${d.points}`);
}

/** Pour chaque tuile du tirage, sa place dans le mot (les lettres en double gardent leur ordre). */
export const placesDansLeMot = (d: Defi): number[] => {
  const prises = new Set<number>();
  return [...d.tirage].map((l) => {
    const j = [...d.mot].findIndex((m, k) => m === l && !prises.has(k));
    prises.add(j);
    return j;
  });
};

// ─── 2. Mini-quiz ─────────────────────────────────────────────────────────────

export type Question = {
  /** Question, coupée en lignes. */
  lignes: string[];
  choix: [string, string, string];
  /** Index de la bonne réponse dans `choix`. */
  bonne: 0 | 1 | 2;
  /** Réponse développée, pour la dernière diapositive. */
  reponse: string;
  source: string;
};

export const quiz: Question[] = [
  {
    lignes: ["Qui a écrit", "« Une si longue", "lettre » (1979) ?"],
    choix: ["Aminata Sow Fall", "Mariama Bâ", "Ken Bugul"],
    bonne: 1,
    reponse: "Mariama Bâ, prix Noma 1980.",
    source: "https://fr.wikipedia.org/wiki/Une_si_longue_lettre",
  },
  {
    lignes: ["Qui est l’auteur de", "« L’Aventure ambiguë »", "(1961) ?"],
    choix: ["Birago Diop", "Ousmane Sembène", "Cheikh Hamidou Kane"],
    bonne: 2,
    reponse: "Cheikh Hamidou Kane.",
    source: "https://fr.wikipedia.org/wiki/L%27Aventure_ambigu%C3%AB",
  },
  {
    lignes: ["Qui fut le premier Africain", "à siéger à l’Académie", "française (élu en 1983) ?"],
    choix: ["Léopold Sédar Senghor", "Aimé Césaire", "Amadou Hampâté Bâ"],
    bonne: 0,
    reponse: "Léopold Sédar Senghor, élu le 2 juin 1983.",
    source: "https://www.academie-francaise.fr/les-immortels/leopold-sedar-senghor",
  },
  {
    lignes: ["Quel écrivain sénégalais", "a reçu le prix Goncourt", "en 2021 ?"],
    choix: ["Boubacar Boris Diop", "David Diop", "Mohamed Mbougar Sarr"],
    bonne: 2,
    reponse: "Mohamed Mbougar Sarr, pour « La plus secrète mémoire des hommes ».",
    source: "https://fr.wikipedia.org/wiki/Mohamed_Mbougar_Sarr",
  },
  {
    lignes: ["Premier écrivain africain", "lauréat du prix Nobel", "de littérature (1986) ?"],
    choix: ["Chinua Achebe", "Wole Soyinka", "Ngũgĩ wa Thiong’o"],
    bonne: 1,
    reponse: "Wole Soyinka, écrivain nigérian.",
    source: "https://en.wikipedia.org/wiki/Wole_Soyinka",
  },
];

// ─── 3. Le mot de la semaine ──────────────────────────────────────────────────

export type MotDeLaSemaine = {
  numero: number;
  /** Le mot, avec ses accents (titre) ; les tuiles les retirent d’elles-mêmes. */
  mot: string;
  nature: string;
  definition: string;
  /** Exemple rédigé pour le club. */
  exemple: string;
  sources: string[];
};

export const motsDeLaSemaine: MotDeLaSemaine[] = [
  {
    numero: 1,
    mot: "Sérendipité",
    nature: "nom féminin",
    // Larousse : aptitude à faire une découverte grâce au hasard ; CNRTL : découverte par hasard et sagacité en cherchant autre chose.
    definition: "Le fait de découvrir par hasard, en cherchant autre chose, et d’avoir l’esprit d’en saisir la valeur.",
    exemple: "Je cherchais un dictionnaire, j’ai trouvé un recueil de contes qui m’a passionné : quelle sérendipité !",
    sources: [
      "https://www.larousse.fr/dictionnaires/francais/s%c3%a9rendipit%c3%a9/186748",
      "https://www.cnrtl.fr/definition/s%C3%A9rendipit%C3%A9",
    ],
  },
  {
    numero: 2,
    mot: "Psittacisme",
    nature: "nom masculin",
    // Larousse : reprise automatique de formules sans en comprendre le sens ; CNRTL (TLFi) : répéter comme un perroquet.
    definition: "Le fait de répéter des mots ou des formules sans les comprendre, comme un perroquet.",
    exemple: "Réciter sa leçon sans la comprendre, c’est du psittacisme : au club, on l’explique avec ses propres mots.",
    sources: ["https://www.larousse.fr/dictionnaires/francais/psittacisme", "https://www.cnrtl.fr/definition/psittacisme"],
  },
  {
    numero: 3,
    mot: "Palimpseste",
    nature: "nom masculin",
    // Larousse : parchemin dont le premier texte, gratté ou lavé, a été remplacé ; CNRTL (TLFi) : au figuré, ce qui laisse voir des traces antérieures.
    definition: "Parchemin dont on a effacé le premier texte pour en écrire un autre. Au figuré : ce qui garde la trace de ce qui l’a précédé.",
    exemple: "Cette vieille ville est un palimpseste : chaque époque y a écrit par-dessus la précédente.",
    sources: ["https://www.larousse.fr/dictionnaires/francais/palimpseste", "https://www.cnrtl.fr/definition/palimpseste"],
  },
];

// ─── 4. Le texte du lancement ─────────────────────────────────────────────────

/**
 * docs/CONTENUS-CLUB.md §8 : « Les Mamelles », conte de Birago Diop (choix du porteur de projet,
 * à confirmer par le comité). Texte protégé par le droit d’auteur (Birago Diop, 1906-1989) :
 * on annonce le titre, l’auteur et le recueil, sans jamais citer le conte.
 * Source : https://fr.wikipedia.org/wiki/Les_Contes_d%27Amadou_Koumba (Fasquelle, 1947 ;
 * le conte raconte l’origine des deux collines de Dakar).
 */
export const texteLancement = {
  /** Surtitre des deux pièces (« Le poème du lancement » si le comité retient « Souffles »). */
  surtitre: "Le conte du lancement",
  titre: "Les Mamelles",
  auteur: "Birago Diop",
  recueil: "Les Contes d’Amadou Koumba",
  annee: 1947,
  /** Accroche écrite pour le club (deux phrases, coupées en lignes) : elle ne cite pas le conte. */
  accroche: [
    ["Dakar a", "deux collines."],
    ["Un conte dit", "d’où elles", "viennent."],
  ],
} as const;

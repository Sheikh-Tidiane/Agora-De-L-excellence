import { DUREE_PASSAGE_FOND, chronologieRevelation, dureeEntreeTexte, durees, tempsLecture } from "../src/kit";
import { activites, dimensions, rythme, slogan } from "./contenus";

/**
 * Minutage de la vidéo de présentation (vertical 1080 × 1920, 30 i/s).
 * Tout se calcule à partir des temps de lecture : changer un texte recale la suite.
 */
export const W = 1080;
export const H = 1920;

/** Sortie d’un texte ou d’un motif : 0,4 s. */
export const SORTIE = durees.transitionCourte;
/** Petit silence visuel entre deux blocs, une fois le précédent sorti. */
const RESPIRATION = 4;

// 1. Révélation du logo (indigo).
export const logo = (() => {
  const debut = 8;
  const c = chronologieRevelation(debut, true);
  const sortie = c.fin + 30; // logo complet tenu 1 s
  return { debut, fin: c.fin, sortie };
})();

// 2. « L’Agora de l’Excellence, c’est… » (ivoire).
export const passage1 = logo.sortie + SORTIE + 2;
export const cest = (() => {
  const lignes = ["L’Agora", "de l’Excellence,", "c’est…"];
  const debut = passage1 + DUREE_PASSAGE_FOND + 3;
  const sortie = debut + dureeEntreeTexte(lignes) + tempsLecture(lignes.join(" "));
  return { lignes, debut, sortie };
})();

// 3. Les trois dimensions (ivoire), une séquence chacune.
const ENTREE_MOTIF = 14; // le titre et la phrase entrent pendant que les tuiles se posent
export const sequencesDimensions = (() => {
  let t = cest.sortie + SORTIE + RESPIRATION;
  return dimensions.map((d) => {
    const debut = t;
    const lecture = Math.max(tempsLecture(d.phrase), tempsLecture(d.nom) + 15);
    const sortie = debut + ENTREE_MOTIF + 20 + lecture;
    t = sortie + SORTIE + RESPIRATION;
    return { ...d, debut, sousTitre: debut + ENTREE_MOTIF, sortie };
  });
})();

// 4. Les cinq activités (indigo), environ 2,3 s chacune.
export const passage2 = sequencesDimensions[2]!.sortie + SORTIE + 2;
export const DUREE_ACTIVITE = 70;
export const sequencesActivites = activites.map((a, i) => {
  const debut = passage2 + DUREE_PASSAGE_FOND + 4 + i * DUREE_ACTIVITE;
  return { ...a, numero: i + 1, debut, sortie: debut + DUREE_ACTIVITE - SORTIE };
});

// 5. « Une rencontre tous les quinze jours. » (indigo).
export const quinzaine = (() => {
  const debut = sequencesActivites[4]!.sortie + SORTIE + RESPIRATION;
  const sortie = debut + dureeEntreeTexte(rythme) + tempsLecture(rythme.join(" "));
  return { lignes: rythme, debut, sortie };
})();

// 6. Le slogan (ivoire), puis le lancement.
export const passage3 = quinzaine.sortie + SORTIE + 2;
export const sequenceSlogan = (() => {
  const debut = passage3 + DUREE_PASSAGE_FOND + 4;
  const sortie = debut + dureeEntreeTexte(slogan, "ligne") + tempsLecture(slogan.join(" "));
  return { lignes: slogan, debut, sortie };
})();
export const sequenceLancement = (() => {
  const debut = sequenceSlogan.sortie + SORTIE + RESPIRATION;
  return { debut, logo: debut + 40, fin: debut + 125 };
})();

export const DUREE_PRESENTATION = sequenceLancement.fin;

/** Fonds successifs : chaque passage se fait une fois textes et tuiles sortis. */
export const passages = [
  { debut: passage1, vers: "ivoire" as const },
  { debut: passage2, vers: "indigo" as const },
  { debut: passage3, vers: "ivoire" as const },
];

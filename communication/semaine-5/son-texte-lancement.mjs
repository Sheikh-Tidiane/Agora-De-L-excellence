// Bande son de l’annonce du conte du lancement (S5TexteLancement-Vertical, 16 s).
// Tout est synthétisé ici (scripts/son/synthese.mjs) : aucun son téléchargé.
//
// - Poses des tuiles : un choc de bois à l’image exacte du contact de chaque place des
//   deux collines (même géométrie et même minutage que la vidéo), placé à gauche ou à
//   droite selon sa position, avec le petit rebond.
// - Musique douce, couleur de conte : cordes pincées façon kora (Karplus-Strong), en fa
//   majeur, arpèges lents (80 à la noire), sur un bourdon grave ; une mesure toutes les 3 s.
// - Deux impacts discrets : à l’entrée du titre « Les Mamelles » et à celle du logo
//   (avec une petite cloche pour la signature).
import { VOL_PLACE, minutageTexteLancement as t, placesCollines } from "./geometrieCollines.ts";
import {
  ajouter,
  bourdon,
  chocDeTuile,
  cloche,
  cordePincee,
  dB,
  fondus,
  hasard,
  impactFeutre,
  nouvelleBande,
  poser,
  reverberation,
} from "../scripts/son/synthese.mjs";

const FPS = 30;
export const DUREE = t.fin / FPS;
const W = 1080;

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

/** Repères (en secondes), pour le storyboard et le contrôle. */
export const reperes = () => {
  const places = placesCollines(880, 1);
  return {
    places: places.length,
    premierContact: (t.collines + VOL_PLACE) / FPS,
    dernierContact: (t.collines + places.length - 1 + VOL_PLACE) / FPS,
    titre: (t.titre + 2) / FPS,
    logo: (t.signature + 4) / FPS,
  };
};

export const tuiles = () => {
  const b = nouvelleBande(DUREE);
  const alea = hasard(16012027);
  placesCollines(880, 1).forEach((p, i) => {
    const contact = (t.collines + i + VOL_PLACE) / FPS;
    const pan = ((p.x - W / 2) / (W / 2)) * 0.7;
    const clair = p.variante === "terracottaClair" ? 1.08 : 1;
    const force = 0.75 + 0.25 * alea();
    poser(b, chocDeTuile(1000 + i, { clair }), contact, { gain: force, pan });
    // Le rebond court et amorti du kit (6 images après le contact) : un choc à peine audible.
    poser(b, chocDeTuile(5000 + i, { clair: clair * 1.1 }), contact + 6 / FPS, { gain: force * 0.12, pan });
  });
  reverberation(b, { melange: 0.08, taille: 0.6 });
  return b;
};

export const musique = () => {
  const b = nouvelleBande(DUREE);
  const alea = hasard(1947);
  const croche = 60 / 80 / 2; // 0,375 s
  const debut = 0.3;
  // Accords (quatre cordes chacun, du grave à l’aigu) et basse, une mesure de 3 s par accord.
  const mesures = [
    { cordes: [65, 69, 72, 77], basse: 41 }, // fa
    { cordes: [65, 70, 74, 77], basse: 46 }, // si bémol
    { cordes: [65, 69, 72, 77], basse: 41 }, // fa
    { cordes: [64, 67, 72, 76], basse: 48, sansBasse: true }, // do (le titre arrive)
    { cordes: [65, 69, 72, 77], basse: 41 }, // fa : résolution, puis le logo
  ];
  // Motif d’arpège, à la manière d’un ostinato de kora : il monte, redescend, se répond.
  const motif = [0, 2, 1, 3, 2, 1, 3, 1];
  mesures.forEach((m, n) => {
    const t0 = debut + n * 8 * croche;
    const derniere = n === mesures.length - 1;
    motif.forEach((idx, k) => {
      if (derniere && k >= 4) return; // la dernière mesure s’arrête à mi-chemin, sur l’accord tenu
      const ecart = alea() * 0.008; // jeu humain : quelques millisecondes
      const nuance = (k % 2 === 0 ? 0.3 : 0.22) * (0.9 + 0.1 * alea());
      poser(b, cordePincee(midi(m.cordes[idx]), 2.4, 300 + n * 10 + k, { brillance: 0.5 }), t0 + k * croche + ecart, {
        gain: nuance,
        pan: (idx - 1.5) * 0.25,
      });
    });
    // Mesure du titre : l’impact grave tient lieu de basse (les deux graves s’additionnaient).
    if (!m.sansBasse) poser(b, cordePincee(midi(m.basse), 3.2, 900 + n, { brillance: 0.35, amorti: 0.998 }), t0, { gain: 0.22 });
  });
  // Accord final tenu, égrené (de l’aigu au grave en 60 ms), au cœur de la signature.
  const final = debut + 4 * 8 * croche + 4 * croche;
  [77, 72, 69, 65].forEach((note, k) => {
    poser(b, cordePincee(midi(note), 3.5, 700 + k, { brillance: 0.45, amorti: 0.998 }), final + k * 0.02, { gain: 0.24, pan: (1.5 - k) * 0.25 });
  });
  // Bourdon : fa et do graves, très doux, sur toute la durée.
  poser(b, bourdon(midi(41), DUREE - 0.3, { attaque: 2, relache: 2.5 }), 0.3, { gain: 0.05 });
  poser(b, bourdon(midi(48), DUREE - 0.3, { attaque: 2.5, relache: 2.5 }), 0.3, { gain: 0.03 });
  reverberation(b, { melange: 0.24 });
  // Montée lente : la pluie de tuiles s’entend d’abord, la musique du conte arrive dessous.
  fondus(b, 2.2, 1.6);
  return b;
};

export const impacts = () => {
  const b = nouvelleBande(DUREE);
  const r = reperes();
  poser(b, impactFeutre(7, { frequence: 64 }), r.titre, { gain: 0.8 });
  poser(b, impactFeutre(8, { frequence: 56, duree: 1.8 }), r.logo, { gain: 0.6 });
  poser(b, cloche(midi(89), 2.2), r.logo + 0.02, { gain: 0.09, pan: 0.15 });
  return b;
};

/**
 * Bande son complète, avant normalisation. Équilibre réglé sur les mesures de chaque piste :
 * la musique porte le volume perçu ; les chocs de tuiles (très pointus, 19 dB entre crête et
 * moyenne) et les impacts graves (forte crête, peu comptés en LUFS) sont dosés pour que leurs
 * crêtes arrivent juste sous le plafond, sans que le limiteur ait à les écraser.
 */
export const bande = () => {
  const b = nouvelleBande(DUREE);
  ajouter(b, tuiles(), dB(-18));
  ajouter(b, musique(), dB(-7));
  ajouter(b, impacts(), dB(-19));
  return b;
};

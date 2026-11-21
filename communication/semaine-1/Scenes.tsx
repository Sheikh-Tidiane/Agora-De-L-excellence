import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import {
  DUREE_PASSAGE_FOND,
  Emplacement,
  FondIndigo,
  PageDeLivre,
  Tuile,
  courbes,
  couleurs,
  interpolerOklch,
  valeurLettre,
  type TextePage,
} from "../src/kit";
import { H, TAILLE_TUILE, VOL_CHUTE, W, tuilesEparses } from "./minutage";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/**
 * Scène 1 : sur la table indigo, des tuiles tombent une à une et se posent au hasard,
 * avec du poids. `posees` : toutes déjà posées (retour sur la table, scène 3).
 */
export const TuilesSurLaTable: React.FC<{ posees?: boolean }> = ({ posees = false }) => (
  <FondIndigo>
    {tuilesEparses.map((t, i) => (
      <div key={i} style={{ position: "absolute", left: t.x, top: t.y }}>
        <Tuile
          lettre={t.lettre}
          valeur={valeurLettre(t.lettre)}
          taille={TAILLE_TUILE}
          variante="ivoire"
          rotationFinale={t.rotation}
          debut={posees ? undefined : t.chute}
          vol={VOL_CHUTE}
          depart={{ x: t.derive, y: -TAILLE_TUILE * 2.4, rotation: t.derive > 0 ? 10 : -10 }}
        />
      </div>
    ))}
  </FondIndigo>
);

/**
 * Le plateau, en version 100 % animée : un plateau sobre (une grille de cases,
 * sans les cases colorées d’un plateau du commerce) sur lequel des tuiles se posent.
 * Plan 1 : « LIRE ». Plan 2 : « SAVOIR » croise « LIRE » sur le I.
 */
const TUILE_PLATEAU = 148;
const PAS = 165;
const CASE = 156;

type Pose = { lettre: string; col: number; ligne: number; ordre: number };
const LIRE: Pose[] = [..."LIRE"].map((lettre, i) => ({ lettre, col: i - 1, ligne: 0, ordre: i }));
// SAVOIR à la verticale, le I (5e lettre) partagé avec LIRE.
const SAVOIR: Pose[] = [..."SAVOIR"]
  .map((lettre, i) => ({ lettre, col: 0, ligne: i - 4, ordre: i < 4 ? i : i - 1 }))
  .filter((p) => p.ligne !== 0);

export const Plateau: React.FC<{ plan: 1 | 2 }> = ({ plan }) => {
  // Origine (la case du I) : plan 1, LIRE au centre ; plan 2, la croix entière au centre.
  // Caméra fixe : une dérive de moins d’un pixel par image faisait sauter le plateau et les
  // lettres d’un pixel une image sur deux (contrôle de la vidéo encodée).
  const ox = W / 2 - 0.5 * PAS;
  const oy = plan === 1 ? 930 : 930 + 1.5 * PAS;

  const cases: React.ReactNode[] = [];
  for (let c = -5; c <= 6; c++) {
    for (let l = -8; l <= 8; l++) {
      const x = ox + c * PAS;
      const y = oy + l * PAS;
      if (x < -PAS || x > W + PAS || y < -PAS || y > H + PAS) continue;
      cases.push(
        <div
          key={`${c}/${l}`}
          style={{
            position: "absolute",
            left: x - CASE / 2,
            top: y - CASE / 2,
            width: CASE,
            height: CASE,
            borderRadius: CASE * 0.08,
            backgroundColor: "rgba(10, 14, 32, 0.22)",
            boxShadow: "inset 0 2px 0 rgba(10, 14, 32, 0.25), inset 0 -1px 0 rgba(247, 244, 237, 0.05)",
          }}
        />,
      );
    }
  }

  const tuile = (p: Pose, debut: number | undefined, k: string) => (
    <div key={k} style={{ position: "absolute", left: ox + p.col * PAS, top: oy + p.ligne * PAS }}>
      <Tuile
        lettre={p.lettre}
        taille={TUILE_PLATEAU}
        variante="ivoire"
        debut={debut}
        depart={{ x: (p.ordre % 2 === 0 ? -1 : 1) * 40, y: -TUILE_PLATEAU * 1.6, rotation: p.ordre % 2 === 0 ? -8 : 8 }}
      />
    </div>
  );

  return (
    <FondIndigo>
      {cases}
      {plan === 1
        ? LIRE.map((p) => tuile(p, 6 + p.ordre * 5, `l${p.ordre}`))
        : [...LIRE.map((p) => tuile(p, undefined, `l${p.ordre}`)), ...SAVOIR.map((p) => tuile(p, 4 + p.ordre * 5, `s${p.ordre}`))]}
    </FondIndigo>
  );
};

/** Le plan filmé (version avec emplacement). Deux extraits du même plan. */
export const PlanFilme: React.FC<{ extrait: 1 | 2 }> = ({ extrait }) => (
  <FondIndigo>
    <Emplacement
      libelle="mains qui posent des tuiles sur un plateau"
      fichier="tuiles-plateau.mp4"
      debutDansLePlan={extrait === 1 ? 0 : 75}
      surFondSombre
    />
  </FondIndigo>
);

/**
 * Texte des pages : les objectifs du club, mot pour mot (docs/CONTENUS-CLUB.md §3).
 * Les deux premiers sur la page qui se tourne ; le troisième, seul, sur la page découverte.
 */
const OBJECTIFS: [TextePage, TextePage] = [
  {
    titre: "Objectifs",
    paragraphes: [
      "Créer un lieu de rencontres, d’échanges, de culture, de réflexion et de convivialité.",
      "Inculquer aux jeunes le goût de la lecture et l’amour du savoir, à travers la lecture et les jeux de l’esprit tels que le Scrabble.",
    ],
  },
  { titre: "Objectifs", paragraphes: ["Cultiver l’excellence."], ornement: true },
];

/** Le livre ouvert sur la table : la page se tourne et découvre la dernière ligne des objectifs. */
export const PageQuiSeTourne: React.FC = () => {
  const frame = useCurrentFrame();
  const t = tempsPage;
  const progression = interpolate(frame, [t.tour, t.tour + t.dureeTour], [0, 1], { ...borne, easing: courbes.deplacement });
  // Le papier apparaît et disparaît par un passage de couleur en OKLCH (indigo ↔ ivoire, par
  // les bleus, deux images intermédiaires), comme le passage de fond validé : jamais par
  // transparence. Le texte entre après l’apparition et sort avant la disparition.
  const entree = courbes.fondu(Math.min(1, Math.max(0, (frame - t.apparition) / DUREE_PASSAGE_FOND)));
  const sortie = courbes.fondu(Math.min(1, Math.max(0, (frame - t.disparition) / DUREE_PASSAGE_FOND)));
  const presence = Math.min(entree, 1 - sortie);
  const papier = interpolerOklch(couleurs.ivoire, couleurs.indigo, 1 - presence, { sens: "croissant", avanceTeinte: 0.1 });
  const opaciteTexte = Math.min(
    interpolate(frame, [t.texte, t.texte + 6], [0, 1], { ...borne, easing: courbes.entree }),
    interpolate(frame, [t.sortieTexte, t.sortieTexte + 6], [1, 0], { ...borne, easing: courbes.sortie }),
  );
  // Caméra fixe (voir Plateau) : le texte de la page reste net et immobile pendant le tour.
  return (
    <FondIndigo>
      {presence > 0 ? (
        <div style={{ position: "absolute", inset: 0 }}>
          <PageDeLivre
            dos={150}
            haut={330}
            largeur={850}
            hauteur={1260}
            progression={progression}
            textes={OBJECTIFS}
            papier={papier}
            presence={presence}
            opaciteTexte={opaciteTexte}
            cadre={{ largeur: W, hauteur: H }}
          />
        </div>
      ) : null}
    </FondIndigo>
  );
};

/** Repères du plan de la page, en images relatives au début du plan (60 images, voir minutage.ts). */
export const tempsPage = {
  /** Le fondu d’entrée (0,4 s, indigo sur indigo) est fini : le papier apparaît. */
  apparition: 12,
  texte: 15,
  tour: 17,
  dureeTour: 24,
  /** Le texte sort, puis le papier se fond dans la table, avant le fondu vers le plateau. */
  sortieTexte: 41,
  disparition: 47,
} as const;

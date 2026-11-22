import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Tuile, courbes, couleurs, durees, type VarianteTuile } from "../src/kit";

/**
 * Un motif par activité, tout en tuiles du kit. `debut` absent : le motif est posé
 * (visuel fixe) ; sinon les tuiles se posent une à une à partir de cette image.
 * Chaque motif est centré sur (cx, cy) et tient dans un carré d’environ 640 px.
 */
export type MotifProps = { debut?: number; cx: number; cy: number; echelle?: number };

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type Pose = { lettre: string; x: number; y: number; variante: VarianteTuile; rotation?: number };

const Poses: React.FC<{ poses: Pose[]; debut?: number; taille: number; pas?: number; chute?: number }> = ({
  poses,
  debut,
  taille,
  pas = 5,
  chute = 2.2,
}) => (
  <>
    {poses.map((p, i) => (
      <div key={i} style={{ position: "absolute", left: p.x, top: p.y }}>
        <Tuile
          lettre={p.lettre}
          taille={taille}
          variante={p.variante}
          rotationFinale={p.rotation ?? 0}
          debut={debut === undefined ? undefined : debut + i * pas}
          depart={{ x: (i % 2 === 0 ? -1 : 1) * taille * 0.25, y: -taille * chute, rotation: i % 2 === 0 ? -8 : 8 }}
        />
      </div>
    ))}
  </>
);

/** Apparition d’un élément graphique (barre, pellicule) : fondu d’entrée, sans déformation. */
const useApparition = (debut: number | undefined, duree: number = durees.transition) => {
  const frame = useCurrentFrame();
  return debut === undefined ? 1 : interpolate(frame, [debut, debut + duree], [0, 1], { ...borne, easing: courbes.entree });
};

/** 1. Rendez-vous lecture : une pile de livres. LIVRE, cinq tuiles empilées, posées de bas en haut. */
export const MotifLecture: React.FC<MotifProps> = ({ debut, cx, cy, echelle = 1 }) => {
  const taille = 116 * echelle;
  const decalages = [-16, 12, -6, 14, -10];
  const rotations = [-4, 3, -2, 4, -3];
  const lettres = [..."LIVRE"];
  // Le E est en bas : il se pose le premier, la pile monte jusqu’au L.
  const poses: Pose[] = lettres
    .map((lettre, i) => ({
      lettre,
      x: cx + decalages[i]! * echelle,
      y: cy + (i - 2) * taille * 1.02,
      variante: (i === 2 ? "terracotta" : "indigo") as VarianteTuile,
      rotation: rotations[i],
    }))
    .reverse();
  return <Poses poses={poses} debut={debut} taille={taille} pas={6} chute={1.6} />;
};

/** 2. Tournois de Scrabble : un chevalet. TOURNOI, sept tuiles debout sur la réglette. */
export const MotifScrabble: React.FC<MotifProps> = ({ debut, cx, cy, echelle = 1 }) => {
  const taille = 104 * echelle;
  const pas = taille * 1.08;
  const lettres = [..."TOURNOI"];
  const largeur = lettres.length * pas + 56 * echelle;
  const barre = useApparition(debut);
  return (
    <>
      {/* La réglette : une barre terracotta, en léger relief, sous les tuiles. */}
      <div
        style={{
          position: "absolute",
          left: cx - largeur / 2,
          top: cy + taille * 0.42,
          width: largeur,
          height: 34 * echelle,
          borderRadius: 8 * echelle,
          backgroundColor: couleurs.terracotta,
          boxShadow: `inset 0 ${3 * echelle}px 0 rgba(255,255,255,0.18), 0 ${10 * echelle}px ${18 * echelle}px -8px rgba(10,14,32,0.5)`,
          opacity: barre,
        }}
      />
      <Poses
        debut={debut === undefined ? undefined : debut + 8}
        taille={taille}
        pas={4}
        poses={lettres.map((lettre, i) => ({ lettre, x: cx + (i - (lettres.length - 1) / 2) * pas, y: cy, variante: "ivoire" }))}
      />
    </>
  );
};

/** 3. Débats d’idées : une grille de mots croisés. DEBAT (vertical) croise INVITE (horizontal) sur le T. */
export const MotifDebats: React.FC<MotifProps> = ({ debut, cx, cy, echelle = 1 }) => {
  const taille = 100 * echelle;
  const p = taille * 1.1;
  const xT = cx + 1.5 * p;
  const yT = cy + 2 * p;
  const debat: Pose[] = [..."DEBA"].map((lettre, i) => ({ lettre, x: xT, y: yT + (i - 4) * p, variante: "indigo" }));
  const invite: Pose[] = [..."INVITE"].map((lettre, i) => ({
    lettre,
    x: xT + (i - 4) * p,
    y: yT,
    variante: i === 4 ? "terracottaClair" : "terracotta",
  }));
  return <Poses poses={[...debat, ...invite]} debut={debut} taille={taille} pas={4} />;
};

/** 4. Génies du soir : QUIZ, quatre grandes tuiles ; Q et Z, les lettres les plus chères (8 et 10), en terracotta. */
export const MotifGenies: React.FC<MotifProps> = ({ debut, cx, cy, echelle = 1 }) => {
  const taille = 150 * echelle;
  const p = taille * 1.12;
  const rotations = [-6, 3, -3, 7];
  const hauteurs = [-14, 10, -6, 12];
  const poses: Pose[] = [..."QUIZ"].map((lettre, i) => ({
    lettre,
    x: cx + (i - 1.5) * p,
    y: cy + hauteurs[i]! * echelle,
    variante: lettre === "Q" || lettre === "Z" ? "terracotta" : "ivoire",
    rotation: rotations[i],
  }));
  return <Poses poses={poses} debut={debut} taille={taille} pas={7} />;
};

/** 5. L’Agora Ciné : une pellicule. Quatre images, une tuile dans chacune : CINE. */
export const MotifCine: React.FC<MotifProps> = ({ debut, cx, cy, echelle = 1 }) => {
  const frame = useCurrentFrame();
  const taille = 112 * echelle;
  const cadre = 170 * echelle;
  const n = 4;
  const largeur = n * cadre + 40 * echelle;
  const hauteur = cadre + 96 * echelle;
  const entree = debut === undefined ? 1 : interpolate(frame, [debut, debut + durees.transitionLongue], [0, 1], { ...borne, easing: courbes.entree });
  const perforations = (y: number) =>
    Array.from({ length: 9 }, (_, i) => (
      <div
        key={`${y}-${i}`}
        style={{
          position: "absolute",
          left: 22 * echelle + i * ((largeur - 44 * echelle) / 8.6),
          top: y,
          width: 30 * echelle,
          height: 22 * echelle,
          borderRadius: 5 * echelle,
          backgroundColor: couleurs.indigo,
        }}
      />
    ));
  return (
    <>
      {/* La bande glisse en place (déplacement horizontal), puis les tuiles se posent dans les images. */}
      <div
        style={{
          position: "absolute",
          left: cx - largeur / 2,
          top: cy - hauteur / 2,
          width: largeur,
          height: hauteur,
          borderRadius: 10 * echelle,
          // Ivoire à 26 % (contre 12 % d’abord) : la bande se lit en plein jour sur un téléphone,
          // tout en restant plus sombre que les tuiles ivoire pleines qu’elle porte.
          backgroundColor: "rgba(247, 244, 237, 0.26)",
          opacity: entree,
          transform: `translateX(${(1 - entree) * -60}px)`,
        }}
      >
        {perforations(14 * echelle)}
        {perforations(hauteur - 36 * echelle)}
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 20 * echelle + i * cadre + 8 * echelle,
              top: 48 * echelle,
              width: cadre - 16 * echelle,
              height: cadre,
              borderRadius: 6 * echelle,
              backgroundColor: "rgba(10, 14, 32, 0.42)",
            }}
          />
        ))}
      </div>
      <Poses
        debut={debut === undefined ? undefined : debut + 16}
        taille={taille}
        pas={6}
        poses={[..."CINE"].map((lettre, i) => ({
          lettre,
          x: cx - largeur / 2 + 20 * echelle + i * cadre + cadre / 2,
          y: cy - hauteur / 2 + 48 * echelle + cadre / 2,
          variante: "ivoire",
        }))}
      />
    </>
  );
};

export const motifs = {
  Lecture: MotifLecture,
  Scrabble: MotifScrabble,
  Debats: MotifDebats,
  Genies: MotifGenies,
  Cine: MotifCine,
} as const;

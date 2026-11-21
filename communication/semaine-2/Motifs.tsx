import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Tuile, courbes, durees, type VarianteTuile } from "../src/kit";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Un groupe d’éléments qui sort d’un bloc : fondu et légère montée (0,4 s, courbe de sortie). */
export const Sortie: React.FC<{ a: number; children: React.ReactNode }> = ({ a, children }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [a, a + durees.transitionCourte], [0, 1], { ...borne, easing: courbes.sortie });
  if (p >= 1) return null;
  return <div style={{ position: "absolute", inset: 0, opacity: 1 - p, transform: `translateY(${-28 * p}px)` }}>{children}</div>;
};

type Pose = { lettre: string; x: number; y: number; variante: VarianteTuile; rotation?: number };

/** Des tuiles posées une à une (décalage `pas` images), chacune avec sa matière. */
const Poses: React.FC<{ poses: Pose[]; debut: number; taille: number; pas?: number }> = ({ poses, debut, taille, pas = 4 }) => (
  <>
    {poses.map((p, i) => (
      <div key={i} style={{ position: "absolute", left: p.x, top: p.y }}>
        <Tuile
          lettre={p.lettre}
          taille={taille}
          variante={p.variante}
          rotationFinale={p.rotation ?? 0}
          debut={debut + i * pas}
          depart={{ x: (i % 2 === 0 ? -1 : 1) * taille * 0.3, y: -taille * 2.2, rotation: i % 2 === 0 ? -8 : 8 }}
        />
      </div>
    ))}
  </>
);

/**
 * Dimension culturelle : une étagère. SAVOIR, en tuiles indigo, posé comme des livres
 * rangés sur un rayon (un filet terracotta sous la rangée).
 */
export const MotifCulturel: React.FC<{ debut: number; cx: number; cy: number }> = ({ debut, cx, cy }) => {
  const frame = useCurrentFrame();
  const taille = 128;
  const pasX = taille * 1.08;
  const mot = [..."SAVOIR"];
  const rayon = interpolate(frame, [debut + 18, debut + 18 + durees.transitionLongue], [0, 1], { ...borne, easing: courbes.entree });
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: cx - (mot.length * pasX) / 2 - 24,
          top: cy + taille / 2 + 18,
          width: mot.length * pasX + 48,
          height: 6,
          borderRadius: 3,
          backgroundColor: "#C2562E",
          transformOrigin: "left center",
          transform: `scaleX(${rayon})`,
        }}
      />
      <Poses
        debut={debut}
        taille={taille}
        poses={mot.map((lettre, i) => ({ lettre, x: cx + (i - (mot.length - 1) / 2) * pasX, y: cy, variante: "indigo" }))}
      />
    </>
  );
};

/** Dimension intellectuelle : une grille de mots croisés, IDEE croise SENS sur le E. */
export const MotifIntellectuel: React.FC<{ debut: number; cx: number; cy: number }> = ({ debut, cx, cy }) => {
  const taille = 118;
  const pas = taille * 1.1;
  // IDEE à l’horizontale (tuiles sans accent), SENS à la verticale : ils se croisent sur le
  // E final d’IDEE, 2e lettre de SENS.
  const xCroix = cx + 1.5 * pas;
  const yCroix = cy - 0.5 * pas;
  const idee: Pose[] = [..."IDEE"].map((lettre, i) => ({ lettre, x: xCroix + (i - 3) * pas, y: yCroix, variante: i === 3 ? "terracotta" : "indigo" }));
  const sens: Pose[] = [..."SENS"]
    .map((lettre, i) => ({ lettre, x: xCroix, y: yCroix + (i - 1) * pas, variante: "indigo" as VarianteTuile }))
    .filter((_, i) => i !== 1);
  return <Poses debut={debut} taille={taille} poses={[...idee, ...sens]} />;
};

/** Dimension sociale : une ronde. ENSEMBLE, huit tuiles en cercle, comme des personnes réunies. */
export const MotifSocial: React.FC<{ debut: number; cx: number; cy: number }> = ({ debut, cx, cy }) => {
  const taille = 112;
  const r = 250;
  const poses: Pose[] = [..."ENSEMBLE"].map((lettre, i) => {
    const a = ((-90 + i * 45) * Math.PI) / 180;
    return { lettre, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), variante: "terracottaClair" };
  });
  return <Poses debut={debut} taille={taille} poses={poses} pas={3} />;
};

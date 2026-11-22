import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { interpolerOklch } from "./couleur";
import { courbes, couleurs } from "./tokens";

/**
 * Grain de papier : un bruit fixe (graine constante, donc aucun scintillement
 * d’une image à l’autre), très discret, en SVG.
 */
const grain = (opacite: number, graine: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='420'>` +
      `<filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' seed='${graine}' stitchTiles='stitch'/>` +
      `<feColorMatrix values='0 0 0 0 0.12  0 0 0 0 0.10  0 0 0 0 0.08  0 0 0 ${opacite} 0'/></filter>` +
      `<rect width='100%' height='100%' filter='url(#g)'/></svg>`,
  )}")`;

/** Texture et lumière du papier (sans la couleur de fond). */
const MatierePapier: React.FC<{ opacite?: number }> = ({ opacite = 1 }) => (
  <AbsoluteFill
    style={{
      opacity: opacite,
      backgroundImage: [
        grain(0.11, 7),
        // Lumière à peine perceptible : 3 % d’écart entre le coin éclairé et le coin opposé.
        "linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%, rgba(31,42,85,0.035) 100%)",
      ].join(", "),
    }}
  />
);

/** Grain et lumière de l’indigo (sans la couleur de fond). */
const MatiereIndigo: React.FC<{ opacite?: number }> = ({ opacite = 1 }) => (
  <AbsoluteFill
    style={{
      opacity: opacite,
      backgroundImage: [
        grain(0.05, 11),
        "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0) 50%, rgba(10,14,32,0.12) 100%)",
      ].join(", "),
    }}
  />
);

/**
 * Fond ivoire avec une texture de papier très discrète et une lumière qui vient
 * d’en haut à gauche (même direction que les ombres des tuiles).
 */
export const FondPapier: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: couleurs.ivoire }}>
    <MatierePapier />
    {children}
  </AbsoluteFill>
);

/** Fond indigo, plat, avec la même lumière discrète d’en haut à gauche. */
export const FondIndigo: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: couleurs.indigo }}>
    <MatiereIndigo />
    {children}
  </AbsoluteFill>
);

/** Durée du passage de fond, en images : 2 images intermédiaires seulement. */
export const DUREE_PASSAGE_FOND = 3;

export type PassageDeFondProps = {
  /** Image où le fond commence à changer (encore entièrement ivoire). */
  debut: number;
  /** Durée en images (3 par défaut : une image ivoire, deux intermédiaires, puis l’indigo). */
  duree?: number;
  /**
   * « indigo » (par défaut) : du papier vers l’indigo. « ivoire » : le chemin inverse,
   * exactement les mêmes couleurs parcourues à rebours (indigo, bleu ardoise,
   * gris-bleu clair, papier).
   */
  vers?: "indigo" | "ivoire";
  /** Décor du fond de départ (motifs) : il part avec lui. */
  children?: React.ReactNode;
};

/**
 * Passage du papier ivoire à l’indigo. La couleur est interpolée en OKLCH, la teinte
 * tournant par les bleus et s’installant dès le début du passage, quand la couleur
 * est encore presque blanche : les teintes intermédiaires restent bleutées, jamais
 * le gris-mauve d’un mélange RVB. Le passage est court : deux images intermédiaires.
 * Les textures des deux fonds se croisent avec la même progression.
 */
export const PassageDeFond: React.FC<PassageDeFondProps> = ({ debut, duree = DUREE_PASSAGE_FOND, vers = "indigo", children }) => {
  const frame = useCurrentFrame();
  const avance = courbes.fondu(Math.min(1, Math.max(0, (frame - debut) / duree)));
  // p : part de l’indigo dans le fond (0 papier, 1 indigo), quel que soit le sens.
  const p = vers === "indigo" ? avance : 1 - avance;
  const fond = interpolerOklch(couleurs.ivoire, couleurs.indigo, p, { sens: "croissant", avanceTeinte: 0.1 });
  return (
    <AbsoluteFill style={{ backgroundColor: fond }}>
      {p < 1 ? <MatierePapier opacite={1 - p} /> : null}
      {p > 0 ? <MatiereIndigo opacite={p} /> : null}
      {avance < 1 ? <AbsoluteFill style={{ opacity: 1 - avance }}>{children}</AbsoluteFill> : null}
    </AbsoluteFill>
  );
};

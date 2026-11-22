import React from "react";
import { Img } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import logoVerticalInverse from "../../public/logos/logo-vertical-inverse.svg";
import { ArcDeGradins, FondIndigo, FondPapier, PageDeLivre, couleurs, formats, hauteurLogoVertical, polices } from "../src/kit";

/**
 * Les trois visuels fixes de la semaine 1, en carré (1080 × 1080) et en portrait
 * (1080 × 1350). Voir semaine-1/STORYBOARD.md, section « Visuels fixes ».
 */
export type FormatVisuel = "carre" | "portrait";
type Props = { format: FormatVisuel };

const LOGO_H = { largeur: 496, hauteur: 180 };
const MARGE = 96; // un peu plus que la zone de sécurité (80 px)

/** Logo horizontal officiel, posé en bas à gauche, intact. */
const Signature: React.FC<{ inverse?: boolean; hauteurCadre: number; largeur?: number }> = ({ inverse = false, hauteurCadre, largeur = 300 }) => {
  const hauteur = (LOGO_H.hauteur * largeur) / LOGO_H.largeur;
  return (
    <Img
      src={inverse ? logoHorizontalInverse : logoHorizontal}
      style={{ position: "absolute", left: MARGE - largeur * 0.06, top: hauteurCadre - MARGE - hauteur * 0.85, width: largeur, height: hauteur }}
    />
  );
};

/** 1. Le logo seul, avec une grande respiration. */
export const VisuelLogo: React.FC<Props> = ({ format }) => {
  const { largeur: W, hauteur: H } = formats[format];
  const l = format === "carre" ? 560 : 600;
  const h = hauteurLogoVertical(l);
  // Centre optique : légèrement au-dessus du centre géométrique.
  const cy = H / 2 - H * 0.02;
  return (
    <FondIndigo>
      <Img src={logoVerticalInverse} style={{ position: "absolute", left: (W - l) / 2, top: cy - h / 2, width: l, height: h }} />
    </FondIndigo>
  );
};

/** 2. Le slogan, en grande typographie. */
export const VisuelSlogan: React.FC<Props> = ({ format }) => {
  const { largeur: W, hauteur: H } = formats[format];
  const taille = 104;
  const haut = format === "carre" ? 150 : 250;
  const lignes: React.ReactNode[] = [
    "Le savoir",
    <>
      comme <span style={{ color: couleurs.terracotta }}>flamme,</span>
    </>,
    "l’excellence",
    "comme ambition",
  ];
  return (
    <FondPapier>
      <ArcDeGradins
        centre={{ x: W - 40, y: H + 150 }}
        rayon={format === "carre" ? 330 : 380}
        rangs={3}
        place={64}
        ouverture={70}
        couleur="rgba(31, 42, 85, 0.06)"
      />
      <div
        style={{
          position: "absolute",
          left: MARGE,
          top: haut,
          fontFamily: polices.titre,
          fontSize: taille,
          lineHeight: 1.08,
          color: couleurs.indigo,
          letterSpacing: "-0.005em",
        }}
      >
        {lignes.map((l, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {l}
          </div>
        ))}
      </div>
      <Signature hauteurCadre={H} />
    </FondPapier>
  );
};

/** 3. La question d’engagement, avec le livre ouvert du teaser. */
export const VisuelQuestion: React.FC<Props> = ({ format }) => {
  const { largeur: W, hauteur: H } = formats[format];
  const taille = format === "carre" ? 96 : 104;
  const haut = format === "carre" ? 120 : 170;
  const lignes: React.ReactNode[] = [
    "Quel est",
    <>
      le dernier <span style={{ color: couleurs.terracottaClair }}>livre</span>
    </>,
    "qui vous a",
    "marqué ?",
  ];
  const page = format === "carre" ? { dos: 640, haut: 650, largeur: 520, hauteur: 760 } : { dos: 600, haut: 700, largeur: 560, hauteur: 800 };
  return (
    <FondIndigo>
      <PageDeLivre {...page} progression={0.3} graines={[21, 34]} lettrine="A" pageGauche={false} cadre={{ largeur: W, hauteur: H }} />
      <div style={{ position: "absolute", left: MARGE, top: haut, fontFamily: polices.titre, fontSize: taille, lineHeight: 1.08, color: couleurs.ivoire }}>
        {lignes.map((l, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            {l}
          </div>
        ))}
        <div
          style={{
            marginTop: taille * 0.5,
            fontFamily: polices.texte,
            fontWeight: 700,
            fontSize: 28,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: couleurs.terracottaClair,
          }}
        >
          Dites-le-nous en commentaire
        </div>
      </div>
      <Signature inverse hauteurCadre={H} />
    </FondIndigo>
  );
};

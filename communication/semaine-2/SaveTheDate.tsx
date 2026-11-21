import React from "react";
import { Img } from "remotion";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import { ArcDeGradins, FondIndigo, couleurs, formats, polices } from "../src/kit";
import { lancement } from "./contenus";

export type FormatSaveTheDate = "vertical" | "carre" | "portrait";

/**
 * « Save the date » du lancement : la date en très grand, l’heure et le lieu en étiquettes,
 * la signature en bas. Deux tailles de texte : la date (Young Serif) et les étiquettes
 * (Work Sans gras, capitales espacées). Le lieu n’est pas confirmé : « Lieu dévoilé bientôt ».
 */
const mise = {
  vertical: { taille: 176, haut: 470, marge: 96, logo: 360, arcY: 2080, arcR: 520 },
  portrait: { taille: 150, haut: 190, marge: 96, logo: 320, arcY: 1500, arcR: 400 },
  carre: { taille: 128, haut: 130, marge: 96, logo: 300, arcY: 1230, arcR: 360 },
} as const;

const etiquette: React.CSSProperties = {
  fontFamily: polices.texte,
  fontWeight: 700,
  fontSize: 34,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

export const SaveTheDate: React.FC<{ format: FormatSaveTheDate }> = ({ format }) => {
  const { largeur: W, hauteur: H, securite } = formats[format];
  const m = mise[format];
  const hauteurLogo = (m.logo * 180) / 496;
  return (
    <FondIndigo>
      {/* Les gradins, en très faible contraste, montent du bas de l’image vers la date. */}
      <ArcDeGradins centre={{ x: W * 0.72, y: m.arcY }} rayon={m.arcR} rangs={4} place={64} ouverture={80} couleur="rgba(247, 244, 237, 0.06)" />

      <div style={{ position: "absolute", left: m.marge, top: m.haut, right: m.marge }}>
        <div style={{ ...etiquette, color: couleurs.terracottaClair }}>Réservez la date · {lancement.surtitre}</div>
        <div style={{ marginTop: m.taille * 0.28, fontFamily: polices.titre, fontSize: m.taille, lineHeight: 1.02, color: couleurs.ivoire }}>
          <div>{lancement.jour}</div>
          <div>
            <span style={{ color: couleurs.terracottaClair }}>2</span> janvier
          </div>
          <div>2027</div>
        </div>
        <div style={{ ...etiquette, marginTop: m.taille * 0.36, color: couleurs.ivoire, lineHeight: 1.8 }}>
          {lancement.heure}
          <br />
          <span style={{ color: "rgba(247, 244, 237, 0.72)" }}>{lancement.lieu}</span>
        </div>
      </div>

      <Img
        src={logoHorizontalInverse}
        style={{ position: "absolute", left: m.marge - m.logo * 0.06, top: H - securite.bas - hauteurLogo * 0.85 - (format === "vertical" ? 0 : 16), width: m.logo, height: hauteurLogo }}
      />
    </FondIndigo>
  );
};

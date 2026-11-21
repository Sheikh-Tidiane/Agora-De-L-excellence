import React from "react";
import { AbsoluteFill } from "remotion";
import { Emplacement, FondPapier, Hemicycle, SousTitres, Tuile, couleurs, polices, type VarianteTuile } from "../src/kit";

/**
 * Planche de contrôle du kit (image fixe, portrait) : usage interne, jamais publiée.
 * Elle montre les pièces au repos pour juger leur matière et leurs proportions.
 */
const Etiquette: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: "absolute",
      fontFamily: polices.texte,
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      color: couleurs.terracottaFonce,
      ...style,
    }}
  >
    {children}
  </div>
);

const VARIANTES: [string, VarianteTuile][] = [
  ["L", "ivoire"],
  ["A", "indigo"],
  ["G", "terracotta"],
  ["O", "terracottaClair"],
];

export const PlancheKit: React.FC = () => (
  <FondPapier>
    <Etiquette style={{ left: 80, top: 70 }}>Planche du kit · usage interne</Etiquette>

    <Etiquette style={{ left: 80, top: 150, color: couleurs.gris }}>Tuiles</Etiquette>
    {VARIANTES.map(([lettre, variante], i) => (
      <div key={lettre} style={{ position: "absolute", left: 80 + 70 + i * 165, top: 280 }}>
        <Tuile lettre={lettre} taille={140} variante={variante} />
      </div>
    ))}

    <Etiquette style={{ left: 80, top: 420, color: couleurs.gris }}>Hémicycle au repos</Etiquette>
    <div style={{ position: "absolute", left: 80, top: 460 }}>
      <Hemicycle taille={380} auRepos />
    </div>

    <Etiquette style={{ left: 560, top: 420, color: couleurs.gris }}>Emplacement</Etiquette>
    <div style={{ position: "absolute", left: 560, top: 470, width: 440, height: 380, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: "scale(0.62)", transformOrigin: "top left", width: 710, height: 613 }}>
        <Emplacement libelle="mains qui posent des tuiles sur un plateau" fichier="tuiles-plateau.mp4" />
      </AbsoluteFill>
    </div>

    <Etiquette style={{ left: 80, top: 960, color: couleurs.gris }}>Sous-titres</Etiquette>
    <SousTitres format="portrait" cues={[{ debut: -1, fin: 10, texte: "Une rencontre tous les quinze jours." }]} />
  </FondPapier>
);

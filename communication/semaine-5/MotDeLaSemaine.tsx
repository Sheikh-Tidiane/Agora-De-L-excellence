import React from "react";
import { Img } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import { FondPapier, Tuile, couleurs, formats, polices, type NomFormat } from "../src/kit";
import { motsDeLaSemaine } from "./contenus";

const W = 1080;
/** Deux tailles de texte : le mot (Young Serif 104) et le reste (Work Sans 36). */
const GRAND = 104;
const PETIT = 36;

/**
 * Modèle « Le mot de la semaine », sur le papier : le mot en tuiles (sans accents),
 * puis le mot écrit (avec ses accents), sa nature, sa définition et un exemple.
 * Portrait pour le fil, vertical pour le statut WhatsApp. Pour un nouveau mot :
 * l’ajouter dans `motsDeLaSemaine` (contenus.ts), avec ses sources.
 */
export const MotDeLaSemaine: React.FC<{ numero: number; format: Extract<NomFormat, "portrait" | "vertical"> }> = ({ numero, format }) => {
  const m = motsDeLaSemaine[numero - 1]!;
  const { hauteur: H, securite } = formats[format];
  const vertical = format === "vertical";
  const marge = 96;
  const haut = vertical ? securite.haut + 170 : 110;
  const lettres = [...m.mot.toUpperCase()];
  const taille = Math.min(88, (W - 2 * marge) / (lettres.length * 1.08));
  const pas = taille * 1.08;
  const yTuiles = haut + 110 + taille / 2;
  const yMot = yTuiles + taille / 2 + (vertical ? 120 : 70);
  const largeurLogo = 260;
  const hauteurLogo = (largeurLogo * 180) / 496;
  const texte: React.CSSProperties = { fontFamily: polices.texte, fontWeight: 500, fontSize: PETIT, lineHeight: 1.42 };
  return (
    <FondPapier>
      <div
        style={{
          position: "absolute",
          left: marge,
          top: haut,
          fontFamily: polices.texte,
          fontWeight: 700,
          fontSize: PETIT,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: couleurs.terracottaFonce,
        }}
      >
        Le mot de la semaine · n° {m.numero}
      </div>
      {lettres.map((l, i) => (
        <div key={i} style={{ position: "absolute", left: marge + taille / 2 + i * pas, top: yTuiles + (i % 2 ? 4 : -4) }}>
          <Tuile lettre={l} taille={taille} variante={i === 0 ? "terracotta" : "indigo"} rotationFinale={[-2, 1.5, -1, 2, -1.5][i % 5]} />
        </div>
      ))}
      <div style={{ position: "absolute", left: marge, right: marge, top: yMot, fontFamily: polices.titre, fontSize: GRAND, lineHeight: 1.05, color: couleurs.indigo }}>
        {m.mot}
      </div>
      <div style={{ position: "absolute", left: marge, right: marge, top: yMot + GRAND * 1.25, ...texte, color: couleurs.terracottaFonce, fontStyle: "italic" }}>
        {m.nature}
      </div>
      <div style={{ position: "absolute", left: marge, right: marge + 20, top: yMot + GRAND * 1.25 + 80, ...texte, color: couleurs.indigo }}>
        {m.definition}
      </div>
      <div
        style={{
          position: "absolute",
          left: marge,
          right: marge + 20,
          top: yMot + GRAND * 1.25 + (vertical ? 340 : 300),
          ...texte,
          color: couleurs.gris,
          borderLeft: `4px solid ${couleurs.terracotta}`,
          paddingLeft: 28,
        }}
      >
        « {m.exemple} »
      </div>
      <Img
        src={logoHorizontal}
        style={{ position: "absolute", left: marge - largeurLogo * 0.06, top: H - securite.bas - hauteurLogo * (vertical ? 1.1 : 0.85), width: largeurLogo, height: hauteurLogo }}
      />
    </FondPapier>
  );
};

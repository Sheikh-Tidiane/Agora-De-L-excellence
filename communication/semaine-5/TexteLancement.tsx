import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import { FondIndigo, TexteCinetique, Tuile, courbes, couleurs, durees, formats, polices } from "../src/kit";
import { lancement } from "../semaine-2/contenus";
import { texteLancement } from "./contenus";
import { TAILLE_PLACE, VOL_PLACE, minutageTexteLancement, placesCollines } from "./geometrieCollines";

export { minutageTexteLancement };

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = 1080;
/** Deux tailles de texte : Young Serif 96 (accroche, titre) et Work Sans 34 (tout le reste). */
const GRAND = 96;
const PETIT = 34;

const Collines: React.FC<{ base: number; echelle?: number; debut?: number }> = ({ base, echelle = 1, debut }) => (
  <>
    {placesCollines(base, echelle).map((p, i) => (
      <div key={i} style={{ position: "absolute", left: p.x, top: p.y }}>
        <Tuile
          taille={TAILLE_PLACE * echelle}
          ratio={9 / 11}
          variante={p.variante}
          rotationFinale={p.rotation}
          debut={debut === undefined ? undefined : debut + i}
          vol={VOL_PLACE}
          depart={{ x: 0, y: -80 * echelle, rotation: i % 2 ? 7 : -7 }}
        />
      </div>
    ))}
  </>
);

const etiquette: React.CSSProperties = {
  fontFamily: polices.texte,
  fontWeight: 700,
  fontSize: PETIT,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};
const ligne: React.CSSProperties = { fontFamily: polices.texte, fontWeight: 500, fontSize: PETIT, lineHeight: 1.45 };

const useEntree = (debut: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [debut, debut + durees.transition], [0, 1], { ...borne, easing: courbes.entree });
};

const Entree: React.FC<{ debut: number; style: React.CSSProperties; children: React.ReactNode }> = ({ debut, style, children }) => {
  const p = useEntree(debut);
  return <div style={{ position: "absolute", ...style, opacity: p, transform: `translateY(${(1 - p) * 12}px)` }}>{children}</div>;
};

/**
 * Annonce du texte lu au lancement (vertical, 16 s), sur l’indigo : les deux collines se
 * construisent, l’accroche (deux phrases écrites pour le club, sans citer le conte), puis
 * le titre, l’auteur, le recueil, la date, le lieu et la signature. La dernière image est
 * complète (vignette).
 */
export const AnnonceTexteLancement: React.FC = () => {
  const t = minutageTexteLancement;
  const x = 96;
  const blanc80 = "rgba(247, 244, 237, 0.8)";
  return (
    <AbsoluteFill>
      <FondIndigo />
      <Entree debut={t.surtitre} style={{ left: x, top: 300, ...etiquette, color: couleurs.terracottaClair }}>
        {texteLancement.surtitre}
      </Entree>
      <Collines base={880} debut={t.collines} />
      <div style={{ position: "absolute", left: x, right: 60, top: 960 }}>
        <TexteCinetique lignes={[...texteLancement.accroche[0]]} debut={t.accroche1} sortie={t.sortie1} taille={GRAND} interligne={1.04} couleur={couleurs.ivoire} />
      </div>
      <div style={{ position: "absolute", left: x, right: 60, top: 960 }}>
        <TexteCinetique lignes={[...texteLancement.accroche[1]]} debut={t.accroche2} sortie={t.sortie2} taille={GRAND} interligne={1.04} couleur={couleurs.ivoire} accent={{ mots: ["conte"], couleur: couleurs.terracottaClair }} />
      </div>
      <div style={{ position: "absolute", left: x, right: 60, top: 960 }}>
        <TexteCinetique lignes={[texteLancement.titre]} mode="ligne" debut={t.titre} reste taille={GRAND} couleur={couleurs.ivoire} />
      </div>
      <Entree debut={t.auteur} style={{ left: x, right: x, top: 1090, ...ligne, color: blanc80 }}>
        Un conte de <span style={{ color: couleurs.ivoire, fontWeight: 600 }}>{texteLancement.auteur}</span>
        <br />« {texteLancement.recueil} », {texteLancement.annee}
      </Entree>
      <Entree debut={t.date} style={{ left: x, right: x, top: 1230, ...etiquette, lineHeight: 1.7, color: couleurs.ivoire }}>
        {lancement.jour} {lancement.date} · {lancement.heure.replace("À partir de ", "")}
        <br />
        <span style={{ color: couleurs.terracottaClair }}>{lancement.lieu}</span>
      </Entree>
      <Signature debut={t.signature} />
    </AbsoluteFill>
  );
};

const Signature: React.FC<{ debut: number }> = ({ debut }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [debut, debut + durees.transitionLongue], [0, 1], { ...borne, easing: courbes.fondu });
  const largeur = 360;
  if (o <= 0) return null;
  return <Img src={logoHorizontalInverse} style={{ position: "absolute", left: 96 - largeur * 0.06, top: 1420, width: largeur, height: (largeur * 180) / 496, opacity: o }} />;
};

/** Visuel portrait (1080 × 1350) : les collines, le titre, l’accroche, l’auteur et le recueil, la date et le lieu. */
export const VisuelTexteLancement: React.FC = () => {
  const { hauteur: H, securite } = formats.portrait;
  const x = 96;
  const largeurLogo = 280;
  const hauteurLogo = (largeurLogo * 180) / 496;
  return (
    <FondIndigo>
      <div style={{ position: "absolute", left: x, top: 110, ...etiquette, color: couleurs.terracottaClair }}>{texteLancement.surtitre}</div>
      <Collines base={460} echelle={0.86} />
      <div style={{ position: "absolute", left: x, right: x, top: 520, fontFamily: polices.titre, fontSize: GRAND, lineHeight: 1.04, color: couleurs.ivoire }}>
        {texteLancement.titre}
      </div>
      <div style={{ position: "absolute", left: x, right: x + 40, top: 650, ...ligne, color: couleurs.ivoire }}>
        {texteLancement.accroche.map((l) => l.join(" ")).join(" ")}
      </div>
      <div style={{ position: "absolute", left: x, right: x, top: 770, ...ligne, color: "rgba(247, 244, 237, 0.8)" }}>
        Un conte de <span style={{ color: couleurs.ivoire, fontWeight: 600 }}>{texteLancement.auteur}</span>
        <br />« {texteLancement.recueil} », {texteLancement.annee}
      </div>
      <div style={{ position: "absolute", left: x, right: x, top: 920, ...etiquette, lineHeight: 1.7, color: couleurs.ivoire }}>
        {lancement.jour} {lancement.date} · {lancement.heure.replace("À partir de ", "")}
        <br />
        <span style={{ color: couleurs.terracottaClair }}>{lancement.lieu}</span>
      </div>
      <Img
        src={logoHorizontalInverse}
        style={{ position: "absolute", left: x - largeurLogo * 0.06, top: H - securite.bas - hauteurLogo * 0.85, width: largeurLogo, height: hauteurLogo }}
      />
    </FondIndigo>
  );
};

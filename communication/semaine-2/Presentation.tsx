import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import {
  Emplacement,
  FondIndigo,
  PassageDeFond,
  RangeeDeTuiles,
  RevelationLogo,
  SousTitres,
  TexteCinetique,
  courbes,
  couleurs,
  durees,
  hauteurLogoVertical,
  planDisponible,
  polices,
  type SousTitre,
} from "../src/kit";
import { lancement } from "./contenus";
import {
  H,
  SORTIE,
  W,
  cest,
  logo,
  passages,
  quinzaine,
  sequenceLancement,
  sequenceSlogan,
  sequencesActivites,
  sequencesDimensions,
} from "./minutage";
import { MotifCulturel, MotifIntellectuel, MotifSocial, Sortie } from "./Motifs";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const sec = (f: number) => f / 30;

export type PresentationProps = {
  /** Vrai : montre les trois emplacements de plans filmés (« Plan à filmer »), pour la validation. */
  apercuPlans?: boolean;
};

/** Les fonds successifs : indigo, puis ivoire, indigo, ivoire, par le passage OKLCH du kit. */
const Fond: React.FC = () => {
  const frame = useCurrentFrame();
  const courant = [...passages].reverse().find((p) => frame >= p.debut);
  if (!courant) return <FondIndigo />;
  return <PassageDeFond debut={courant.debut} vers={courant.vers} />;
};

/** 1. La révélation du logo : les gradins se remplissent, la tuile A1 se pose, le logo officiel prend le relais. */
const LARGEUR_LOGO = 1064;
const Revelation: React.FC = () => {
  const frame = useCurrentFrame();
  const opacite = interpolate(frame, [logo.sortie, logo.sortie + SORTIE], [1, 0], { ...borne, easing: courbes.sortie });
  if (opacite <= 0) return null;
  return (
    <div style={{ position: "absolute", left: (W - LARGEUR_LOGO) / 2, top: 900 - hauteurLogoVertical(LARGEUR_LOGO) / 2, opacity: opacite }}>
      <RevelationLogo largeur={LARGEUR_LOGO} debut={logo.debut} inverse />
    </div>
  );
};

const Etiquette: React.FC<{ children: React.ReactNode; couleur: string; style?: React.CSSProperties }> = ({ children, couleur, style }) => (
  <div
    style={{
      position: "absolute",
      left: 80,
      right: 80,
      textAlign: "center",
      fontFamily: polices.texte,
      fontWeight: 700,
      fontSize: 36,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      color: couleur,
      ...style,
    }}
  >
    {children}
  </div>
);

/** 3. Une dimension : son motif de tuiles, son nom en grand, sa phrase en sous-titre. */
const Dimension: React.FC<{ index: number }> = ({ index }) => {
  const frame = useCurrentFrame();
  const d = sequencesDimensions[index]!;
  if (frame < d.debut - 1 || frame > d.sortie + SORTIE) return null;
  const Motif = [MotifCulturel, MotifIntellectuel, MotifSocial][index]!;
  return (
    <Sortie a={d.sortie}>
      <Motif debut={d.debut} cx={W / 2} cy={640} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 1010 }}>
        <TexteCinetique lignes={[d.nom]} debut={d.debut + 8} reste taille={150} alignement="center" couleur={couleurs.indigo} />
      </div>
    </Sortie>
  );
};

/** 4. Une activité : son nom officiel, un mot en tuiles, une ligne d’explication en sous-titre. */
const Activite: React.FC<{ index: number; apercuPlans: boolean }> = ({ index, apercuPlans }) => {
  const frame = useCurrentFrame();
  const a = sequencesActivites[index]!;
  if (frame < a.debut - 1 || frame > a.sortie + SORTIE) return null;
  const n = [...a.tuiles].length;
  const taille = Math.min(124, 900 / (n * 1.1));
  const plan = a.plan && (apercuPlans || planDisponible(a.plan.fichier)) ? a.plan : null;
  const voile = interpolate(frame, [a.debut, a.debut + durees.transition], [0, 1], { ...borne, easing: courbes.fondu });
  return (
    <>
      {plan ? (
        // Plan filmé facultatif, sous un voile indigo qui garde le texte lisible.
        <AbsoluteFill style={{ opacity: voile }}>
          <Sortie a={a.sortie}>
            <Emplacement libelle={plan.libelle} fichier={plan.fichier} surFondSombre />
            <AbsoluteFill style={{ backgroundColor: "rgba(31, 42, 85, 0.72)" }} />
          </Sortie>
        </AbsoluteFill>
      ) : null}
      <Sortie a={a.sortie}>
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            top: 620,
            textAlign: "center",
            fontFamily: polices.titre,
            fontSize: 72,
            lineHeight: 1.08,
            color: couleurs.ivoire,
            opacity: voile,
          }}
        >
          <span style={{ color: couleurs.terracottaClair }}>{a.numero}/5</span>
          <br />
          {a.nom}
        </div>
        <div style={{ position: "absolute", left: W / 2, top: 930 }}>
          <RangeeDeTuiles mot={a.tuiles} taille={taille} debut={a.debut + 4} intervalle={2} variante="ivoire" />
        </div>
      </Sortie>
    </>
  );
};

/** 6. Le lancement : la date en grand, l’heure et le lieu, puis la signature. */
const Lancement: React.FC = () => {
  const frame = useCurrentFrame();
  const l = sequenceLancement;
  if (frame < l.debut) return null;
  const entree = (d: number) => interpolate(frame, [d, d + durees.entreeTexte], [0, 1], { ...borne, easing: courbes.entree });
  const largeurLogo = 380;
  return (
    <>
      <Etiquette couleur={couleurs.terracottaFonce} style={{ top: 560, opacity: entree(l.debut) }}>
        {lancement.surtitre}
      </Etiquette>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640 }}>
        <TexteCinetique lignes={[lancement.jour, lancement.date]} debut={l.debut + 6} mode="ligne" reste taille={124} interligne={1.05} alignement="center" couleur={couleurs.indigo} accent={{ mots: ["2"], couleur: couleurs.terracotta }} />
      </div>
      <Etiquette couleur={couleurs.indigo} style={{ top: 960, opacity: entree(l.debut + 24), lineHeight: 1.7 }}>
        {lancement.heure}
        <br />
        <span style={{ color: couleurs.gris }}>{lancement.lieu}</span>
      </Etiquette>
      <Img
        src={logoHorizontal}
        style={{ position: "absolute", left: (W - largeurLogo) / 2, top: 1260, width: largeurLogo, height: (largeurLogo * 180) / 496, opacity: entree(l.logo) }}
      />
    </>
  );
};

const sousTitres: SousTitre[] = [
  ...sequencesDimensions.map((d) => ({ debut: sec(d.sousTitre), fin: sec(d.sortie + 6), texte: d.phrase })),
];
const sousTitresSombres: SousTitre[] = sequencesActivites.map((a) => ({ debut: sec(a.debut + 8), fin: sec(a.sortie + 6), texte: a.ligne }));

export const Presentation: React.FC<PresentationProps> = ({ apercuPlans = false }) => (
  <AbsoluteFill style={{ width: W, height: H }}>
    <Fond />
    <Revelation />

    <div style={{ position: "absolute", left: 0, right: 0, top: 700 }}>
      <TexteCinetique lignes={cest.lignes} debut={cest.debut} sortie={cest.sortie} taille={108} interligne={1.08} alignement="center" couleur={couleurs.indigo} accent={{ mots: ["c’est…"], couleur: couleurs.terracotta }} />
    </div>

    {[0, 1, 2].map((i) => (
      <Dimension key={i} index={i} />
    ))}
    {/* La phrase sous le titre de la dimension, pas en bas de l’écran. */}
    <SousTitres cues={sousTitres} haut={1215} />

    {[0, 1, 2, 3, 4].map((i) => (
      <Activite key={i} index={i} apercuPlans={apercuPlans} />
    ))}
    {/* L’explication juste sous la rangée de tuiles. */}
    <SousTitres cues={sousTitresSombres} surFondSombre haut={1045} />

    <div style={{ position: "absolute", left: 0, right: 0, top: 700 }}>
      <TexteCinetique lignes={quinzaine.lignes} debut={quinzaine.debut} sortie={quinzaine.sortie} taille={112} interligne={1.08} alignement="center" couleur={couleurs.ivoire} accent={{ mots: ["quinze", "jours."], couleur: couleurs.terracottaClair }} />
    </div>

    <div style={{ position: "absolute", left: 96, top: 620 }}>
      <TexteCinetique lignes={sequenceSlogan.lignes} debut={sequenceSlogan.debut} sortie={sequenceSlogan.sortie} mode="ligne" taille={104} interligne={1.08} couleur={couleurs.indigo} accent={{ mots: ["flamme,"], couleur: couleurs.terracotta }} />
    </div>

    <Lancement />
  </AbsoluteFill>
);

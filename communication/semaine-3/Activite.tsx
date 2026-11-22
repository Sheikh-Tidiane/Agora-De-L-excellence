import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import { FondIndigo, FondPapier, SousTitres, TexteCinetique, courbes, couleurs, durees, formats, polices, tempsLecture } from "../src/kit";
import { serie, type ActiviteSerie } from "./contenus";
import { motifs } from "./Motifs";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = 1080;

/**
 * Gabarit commun aux cinq vidéos (vertical, environ 12 s), sans changement de fond :
 * 1. le motif se construit en tuiles ;
 * 2. le numéro et le nom de l’activité entrent ligne par ligne ;
 * 3. deux phrases de CONTENUS-CLUB.md, l’une après l’autre, en sous-titre sous le titre ;
 * 4. les phrases sortent, la signature (logo horizontal officiel) prend leur place ; motif et
 *    titre restent : la dernière image, qui sert de vignette, montre l’activité et le club.
 */
export const minutageActivite = (a: ActiviteSerie) => {
  const motif = 6;
  const titre = 30;
  const phrase1 = 66;
  const phrase2 = phrase1 + Math.max(tempsLecture(a.lignes[0]), 75) + 6;
  const finPhrases = phrase2 + Math.max(tempsLecture(a.lignes[1]), 75) + 6;
  const signature = finPhrases + durees.transitionCourte;
  const fin = Math.max(signature + 66, 360);
  return { motif, titre, phrase1, phrase2, finPhrases, signature, fin };
};

export const Activite: React.FC<{ numero: number }> = ({ numero }) => {
  const frame = useCurrentFrame();
  const a = serie[numero - 1]!;
  const t = minutageActivite(a);
  const sombre = a.fond === "indigo";
  const Fond = sombre ? FondIndigo : FondPapier;
  const Motif = motifs[a.slug];
  const encre = sombre ? couleurs.ivoire : couleurs.indigo;
  const accent = sombre ? couleurs.terracottaClair : couleurs.terracotta;
  const signature = interpolate(frame, [t.signature + 6, t.signature + 6 + durees.transitionLongue], [0, 1], { ...borne, easing: courbes.fondu });
  const largeurLogo = 400;
  const cues = [
    { debut: t.phrase1 / 30, fin: (t.phrase2 - 6) / 30, texte: a.lignes[0] },
    { debut: t.phrase2 / 30, fin: t.finPhrases / 30, texte: a.lignes[1] },
  ];
  return (
    <AbsoluteFill style={{ width: W, height: formats.vertical.hauteur }}>
      <Fond />
      <Motif debut={t.motif} cx={W / 2} cy={600} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 960 }}>
        <TexteCinetique
          lignes={[`${a.numero}/5`, ...a.titre]}
          mode="ligne"
          debut={t.titre}
          reste
          taille={100}
          interligne={1.04}
          alignement="center"
          couleur={encre}
          accent={{ mots: [`${a.numero}/5`], couleur: accent }}
        />
      </div>
      <SousTitres cues={cues} surFondSombre={sombre} haut={1330} />
      {signature > 0 ? (
        <Img
          src={sombre ? logoHorizontalInverse : logoHorizontal}
          style={{ position: "absolute", left: (W - largeurLogo) / 2, top: 1360, width: largeurLogo, height: (largeurLogo * 180) / 496, opacity: signature }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

/** Visuel fixe portrait (1080 × 1350), même structure : motif, numéro et nom, les deux phrases, la signature. */
export const VisuelActivite: React.FC<{ numero: number }> = ({ numero }) => {
  const a = serie[numero - 1]!;
  const sombre = a.fond === "indigo";
  const Fond = sombre ? FondIndigo : FondPapier;
  const Motif = motifs[a.slug];
  const encre = sombre ? couleurs.ivoire : couleurs.indigo;
  const accent = sombre ? couleurs.terracottaClair : couleurs.terracotta;
  const { hauteur: H, securite } = formats.portrait;
  const largeurLogo = 280;
  // Texte plus long (Scrabble, version complète) : titre et texte remontent pour laisser respirer la signature.
  const remonte = a.textePortrait ? 45 : 0;
  const hauteurLogo = (largeurLogo * 180) / 496;
  return (
    <Fond>
      <Motif cx={W / 2} cy={330} echelle={0.8} />
      <div style={{ position: "absolute", left: 96, right: 96, top: 630 - remonte, fontFamily: polices.titre, fontSize: 84, lineHeight: 1.04, color: encre }}>
        <div style={{ color: accent }}>{a.numero}/5</div>
        {a.titre.map((l) => (
          <div key={l}>{l}</div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 96, right: 120, top: 945 - remonte, fontFamily: polices.texte, fontWeight: 500, fontSize: 33, lineHeight: 1.4, color: sombre ? "rgba(247, 244, 237, 0.86)" : couleurs.gris }}>
        {a.textePortrait ?? `${a.lignes[0]} ${a.lignes[1]}`}
      </div>
      <Img
        src={sombre ? logoHorizontalInverse : logoHorizontal}
        style={{ position: "absolute", left: 96 - largeurLogo * 0.06, top: H - securite.bas - hauteurLogo * 0.85, width: largeurLogo, height: hauteurLogo }}
      />
    </Fond>
  );
};

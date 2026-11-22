import React from "react";
import { Img } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import { FondIndigo, FondPapier, Tuile, couleurs, formats, polices } from "../src/kit";
import { MotifGenies } from "../semaine-3/Motifs";
import { quiz } from "./contenus";

const W = 1080;
const { hauteur: H, securite } = formats.portrait;
const MARGE = 96;
/** Deux tailles de texte par diapositive : la question (Young Serif 64) et le reste (Work Sans 36). */
const GRAND = 64;
const PETIT = 36;
const LETTRES = ["A", "B", "C"] as const;

const Surtitre: React.FC<{ texte: string; couleur: string; top?: number }> = ({ texte, couleur, top = 120 }) => (
  <div
    style={{
      position: "absolute",
      left: MARGE,
      right: MARGE,
      top,
      fontFamily: polices.texte,
      fontWeight: 700,
      fontSize: PETIT,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: couleur,
    }}
  >
    {texte}
  </div>
);

const Signature: React.FC<{ inverse: boolean }> = ({ inverse }) => {
  const largeur = 260;
  const hauteur = (largeur * 180) / 496;
  return (
    <Img
      src={inverse ? logoHorizontalInverse : logoHorizontal}
      style={{ position: "absolute", left: MARGE - largeur * 0.06, top: H - securite.bas - hauteur * 0.85, width: largeur, height: hauteur }}
    />
  );
};

/** Diapositive 1 : la couverture, sur l’indigo des Génies du soir, avec le motif QUIZ de la semaine 3. */
const Couverture: React.FC = () => (
  <FondIndigo>
    <MotifGenies cx={W / 2} cy={330} echelle={0.85} />
    <Surtitre texte="Les Génies du soir · mini-quiz" couleur={couleurs.terracottaClair} top={580} />
    <div style={{ position: "absolute", left: MARGE, right: MARGE, top: 640, fontFamily: polices.titre, fontSize: 84, lineHeight: 1.06, color: couleurs.ivoire }}>
      Cinq questions
      <br />
      de littérature
      <br />
      <span style={{ color: couleurs.terracottaClair }}>
        sénégalaise
        <br />
        et africaine
      </span>
    </div>
    <div style={{ position: "absolute", left: MARGE, right: MARGE, top: 1030, fontFamily: polices.texte, fontWeight: 500, fontSize: PETIT, lineHeight: 1.4, color: "rgba(247, 244, 237, 0.86)" }}>
      Note tes réponses, puis glisse jusqu’à la dernière image.
    </div>
    <Signature inverse />
  </FondIndigo>
);

/** Diapositives 2 à 6 : une question, trois réponses possibles en tuiles A, B, C. */
const DiapoQuestion: React.FC<{ index: number }> = ({ index }) => {
  const q = quiz[index]!;
  return (
    <FondPapier>
      <Surtitre texte={`Question ${index + 1}/5`} couleur={couleurs.terracottaFonce} />
      <div style={{ position: "absolute", left: MARGE, right: MARGE, top: 200, fontFamily: polices.titre, fontSize: GRAND, lineHeight: 1.12, color: couleurs.indigo }}>
        {q.lignes.map((l) => (
          <div key={l} style={{ whiteSpace: "nowrap" }}>
            {l}
          </div>
        ))}
      </div>
      {q.choix.map((c, i) => {
        const y = 690 + i * 165;
        return (
          <React.Fragment key={c}>
            <div style={{ position: "absolute", left: MARGE + 48, top: y }}>
              <Tuile lettre={LETTRES[i]} valeur={null} taille={96} variante="indigo" rotationFinale={[-3, 2, -2][i]} />
            </div>
            <div
              style={{
                position: "absolute",
                left: MARGE + 130,
                right: MARGE,
                top: y - PETIT * 0.7,
                fontFamily: polices.texte,
                fontWeight: 500,
                fontSize: PETIT,
                color: couleurs.indigo,
              }}
            >
              {c}
            </div>
          </React.Fragment>
        );
      })}
      <Signature inverse={false} />
    </FondPapier>
  );
};

/** Diapositive 7 : les réponses, sur l’indigo. */
const DiapoReponses: React.FC = () => (
  <FondIndigo>
    <Surtitre texte="Les réponses" couleur={couleurs.terracottaClair} />
    <div style={{ position: "absolute", left: MARGE, right: MARGE, top: 190, fontFamily: polices.titre, fontSize: GRAND, lineHeight: 1.1, color: couleurs.ivoire }}>
      Combien en as-tu ?
    </div>
    {quiz.map((q, i) => {
      const y = 330 + i * 152;
      return (
        <React.Fragment key={i}>
          <div style={{ position: "absolute", left: MARGE + 34, top: y + 34 }}>
            <Tuile lettre={LETTRES[q.bonne]} valeur={null} taille={68} variante="ivoire" />
          </div>
          <div style={{ position: "absolute", left: MARGE + 96, right: MARGE - 10, top: y, fontFamily: polices.texte, fontWeight: 500, fontSize: PETIT, lineHeight: 1.3, color: couleurs.ivoire }}>
            <span style={{ color: couleurs.terracottaClair, fontWeight: 700 }}>{i + 1}.</span> {q.reponse}
          </div>
        </React.Fragment>
      );
    })}
    <Signature inverse />
  </FondIndigo>
);

export const NOMBRE_DIAPOS_QUIZ = quiz.length + 2;

/** Une diapositive du carrousel portrait (1080 × 1350), de 1 à 7. */
export const DiapoQuiz: React.FC<{ diapo: number }> = ({ diapo }) => {
  if (diapo === 1) return <Couverture />;
  if (diapo === NOMBRE_DIAPOS_QUIZ) return <DiapoReponses />;
  return <DiapoQuestion index={diapo - 2} />;
};

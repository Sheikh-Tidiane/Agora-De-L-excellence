import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import symbole from "../../public/logos/symbole.svg";
import {
  PassageDeFond,
  RevelationLogo,
  TexteCinetique,
  TuileEnMigration,
  courbes,
  couleurs,
  durees,
  geometrieRevelation,
  type EtatTuile,
} from "../src/kit";
import {
  LARGEUR_LOGO,
  LOGO_X,
  LOGO_Y,
  PLACES_LETTRES,
  TAILLE_TUILE,
  W,
  Y_RANGEE,
  finale as f,
  tuilesEparses,
  xRangee,
} from "./minutage";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const MOT = "AGORA";
const geo = geometrieRevelation(LARGEUR_LOGO);

/** Ramène un angle dans ]-180, 180] : une place tourne au plus court. */
const auPlusCourt = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Scène 3 : les tuiles éparses se rangent et écrivent « AGORA ». */
const Rangement: React.FC = () => (
  <>
    {/* Dessinées à rebours : la tuile déjà en vol passe au-dessus de celle qui se soulève à peine. */}
    {tuilesEparses.map((t, i) => ({ t, i })).reverse().map(({ t, i }) => (
      <TuileEnMigration
        key={i}
        depuis={{ x: t.x, y: t.y, taille: TAILLE_TUILE, rotation: t.rotation, variante: "ivoire", lettre: t.lettre }}
        vers={{ x: xRangee(i), y: Y_RANGEE, taille: TAILLE_TUILE, rotation: 0, variante: "ivoire", lettre: t.lettre }}
        debut={f.rangement + i * f.decalageRangement}
        duree={f.dureeRangement}
        levee={0.3}
      />
    ))}
  </>
);

/** Scène 4 : les lettres rejoignent l’hémicycle (dans le repère du logo). */
const VersLesGradins: React.FC<{ matiere: number }> = ({ matiere }) => {
  const frame = useCurrentFrame();
  if (frame < f.migration) return null;
  return (
    <>
      {/* Le premier A, plus soulevé, passe au-dessus des autres : il est dessiné en dernier. */}
      {[1, 2, 3, 4, 0].map((i) => {
        const depuis: EtatTuile = { x: xRangee(i) - LOGO_X, y: Y_RANGEE - LOGO_Y, taille: TAILLE_TUILE, variante: "ivoire", lettre: MOT[i] };
        const vers: EtatTuile =
          i === 0
            ? { x: geo.a1.x, y: geo.a1.y, taille: geo.a1.cote, arrondi: geo.a1.arrondi, variante: "ivoire", lettre: "A", valeur: 1 }
            : (() => {
                const p = geo.interieur[PLACES_LETTRES[i - 1]];
                return { x: p.x, y: p.y, taille: p.largeur, ratio: p.hauteur / p.largeur, rotation: auPlusCourt(p.rotation), arrondi: p.arrondi, variante: "terracottaClair" };
              })();
        return (
          <TuileEnMigration
            key={i}
            depuis={depuis}
            vers={vers}
            debut={f.migration + i * f.decalageMigration}
            duree={f.dureeMigration}
            levee={i === 0 ? 0.55 : 0.4}
            matiere={matiere}
          />
        );
      })}
    </>
  );
};

/** Carton final, sur le papier : le symbole, puis « Bientôt / à Dakar. » */
const TAILLE_TEXTE = 168;
const COTE_SYMBOLE = 190;
const HAUT_BLOC = 596;

const CartonFinal: React.FC = () => {
  const frame = useCurrentFrame();
  if (frame < f.symbole) return null;
  const opacite = interpolate(frame, [f.symbole, f.symbole + durees.transition], [0, 1], { ...borne, easing: courbes.fondu });
  return (
    <>
      <Img
        src={symbole}
        style={{ position: "absolute", left: (W - COTE_SYMBOLE) / 2, top: HAUT_BLOC, width: COTE_SYMBOLE, height: COTE_SYMBOLE, opacity: opacite }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: HAUT_BLOC + COTE_SYMBOLE + 70 }}>
        <TexteCinetique
          lignes={["Bientôt", "à Dakar."]}
          mode="mot"
          debut={f.texte}
          reste
          taille={TAILLE_TEXTE}
          interligne={1.04}
          alignement="center"
          couleur={couleurs.indigo}
          accent={{ mots: ["Dakar."], couleur: couleurs.terracotta }}
        />
      </div>
    </>
  );
};

/** Scènes 3 à 5, en un seul plan continu. Images relatives au début du plan. */
export const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const opaciteLogo = interpolate(frame, [f.sortieLogo, f.sortieLogo + durees.transitionCourte], [1, 0], {
    ...borne,
    easing: courbes.sortie,
  });
  return (
    <AbsoluteFill>
      <PassageDeFond debut={f.passage} vers="ivoire" />
      {frame < f.migration ? <Rangement /> : null}
      {opaciteLogo > 0 ? (
        <div style={{ position: "absolute", left: LOGO_X, top: LOGO_Y, opacity: opaciteLogo }}>
          <RevelationLogo
            largeur={LARGEUR_LOGO}
            debut={f.gradins}
            inverse
            avecA1={false}
            exclusInterieur={PLACES_LETTRES}
            calque={({ matiere }) => <VersLesGradins matiere={matiere} />}
          />
        </div>
      ) : null}
      <CartonFinal />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import {
  ArcDeGradins,
  PassageDeFond,
  RangeeDeTuiles,
  RevelationLogo,
  TexteCinetique,
  TuileEnMigration,
  chronologieRevelation,
  couleurs,
  dureeRangee,
  dureeTexteCinetique,
  durees,
  geometrieRevelation,
  hauteurLogoVertical,
  type EtatTuile,
} from "../src/kit";

/**
 * Démonstration du kit (vertical, 10 s), en un seul plan continu. Voir demo-kit/STORYBOARD.md.
 *
 * 1. « AGORA » s’écrit tuile par tuile sur le papier ; les trois dimensions du club apparaissent.
 * 2. Le texte s’efface, le fond passe à l’indigo, et les tuiles rejoignent l’hémicycle :
 *    le premier A (valeur 1) devient la tuile A1 au centre, les quatre autres lettres
 *    deviennent des places du rang intérieur.
 * 3. Les autres places remplissent les gradins, puis le logo officiel apparaît par fondu.
 */
export const DUREE_DEMO = 300;

const W = 1080;
const MOT = "AGORA";
const DIMENSIONS = ["Culturelle.", "Intellectuelle.", "Sociale."];

// Composition : un bloc centré sur l’axe vertical, son centre optique un peu au-dessus du milieu.
const TAILLE_TUILE = 164;
const ESPACEMENT = 0.1;
const Y_TUILES = 660; // centre de la rangée
const Y_TEXTE = 830; // haut du bloc de texte
const TAILLE_TEXTE = 128;

// Logo final : 1 064 px de large (+40 % par rapport à la première version), centré à 900 px.
const LARGEUR_LOGO = 1064;
const LOGO_X = (W - LARGEUR_LOGO) / 2;
const LOGO_Y = 900 - hauteurLogoVertical(LARGEUR_LOGO) / 2;
/** Cadre du logo final, pour l’image de contrôle `ReferenceLogo`. */
export const CADRE_LOGO_DEMO = { x: LOGO_X, y: LOGO_Y, largeur: LARGEUR_LOGO, hauteur: hauteurLogoVertical(LARGEUR_LOGO) };

// Minutage, en images.
const DEBUT_TEXTE = dureeRangee(MOT) - 4;
const SORTIE_TEXTE = DEBUT_TEXTE + dureeTexteCinetique(DIMENSIONS, "ligne");
const MIGRATION = SORTIE_TEXTE + 3; // les tuiles se soulèvent quand le texte s’efface
const DECALAGE_MIGRATION = 3;
const DUREE_MIGRATION = 26;
// Le fond change une fois le texte sorti ET les lettres des tuiles en vol entièrement effacées.
const FIN_EFFACEMENT_LETTRES = SORTIE_TEXTE + durees.transitionCourte + 1;
const PASSAGE_INDIGO = FIN_EFFACEMENT_LETTRES + 2;
const DEBUT_GRADINS = MIGRATION + DUREE_MIGRATION + 4 * DECALAGE_MIGRATION - 2;

/** Places du rang intérieur prises par G, O, R et le dernier A (de gauche à droite). */
const PLACES_LETTRES = [1, 3, 5, 7];

export const repereDemo = {
  rangeePosee: dureeRangee(MOT),
  texteEntre: DEBUT_TEXTE + 40,
  sortieTexte: SORTIE_TEXTE,
  migration: MIGRATION,
  ...chronologieRevelation(DEBUT_GRADINS, false),
};

/** Ramène un angle dans ]-180, 180] : une place tourne au plus court. */
const auPlusCourt = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

const geo = geometrieRevelation(LARGEUR_LOGO);
const pas = TAILLE_TUILE * (1 + ESPACEMENT);

/** Position de départ de la lettre n° i de la rangée, dans le repère du logo. */
const departLettre = (i: number, lettre: string): EtatTuile => ({
  x: W / 2 + (i - (MOT.length - 1) / 2) * pas - LOGO_X,
  y: Y_TUILES - LOGO_Y,
  taille: TAILLE_TUILE,
  variante: "ivoire",
  lettre,
});

const ArriveeLettres: React.FC<{ matiere: number }> = ({ matiere }) => {
  const frame = useCurrentFrame();
  if (frame < MIGRATION) return null;
  return (
    <>
      {/* Le premier A, plus soulevé, passe au-dessus des autres : il est dessiné en dernier. */}
      {[1, 2, 3, 4, 0].map((i) => {
        const lettre = MOT[i];
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
            depuis={departLettre(i, lettre)}
            vers={vers}
            debut={MIGRATION + i * DECALAGE_MIGRATION}
            duree={DUREE_MIGRATION}
            levee={i === 0 ? 0.55 : 0.4}
            matiere={matiere}
            effacementLettre={{ debut: MIGRATION, fin: FIN_EFFACEMENT_LETTRES }}
          />
        );
      })}
    </>
  );
};

export const DemoKit: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* Papier → indigo en OKLCH, par les bleus, deux images intermédiaires seulement. */}
      <PassageDeFond debut={PASSAGE_INDIGO}>
        {/* Gradins en très faible contraste au pied de l’image : ils équilibrent le bloc et annoncent l’hémicycle. */}
        <ArcDeGradins centre={{ x: W / 2, y: 2250 }} rayon={420} rangs={3} place={70} ouverture={50} couleur="rgba(31, 42, 85, 0.06)" />
      </PassageDeFond>

      {frame < MIGRATION ? (
        <div style={{ position: "absolute", left: W / 2, top: Y_TUILES }}>
          <RangeeDeTuiles mot={MOT} taille={TAILLE_TUILE} espacement={ESPACEMENT} debut={0} />
        </div>
      ) : null}

      <div style={{ position: "absolute", left: 0, right: 0, top: Y_TEXTE }}>
        <TexteCinetique
          lignes={DIMENSIONS}
          mode="ligne"
          debut={DEBUT_TEXTE}
          sortie={SORTIE_TEXTE}
          taille={TAILLE_TEXTE}
          interligne={1.06}
          alignement="center"
          couleur={couleurs.indigo}
          accent={{ mots: ["Sociale."], couleur: couleurs.terracotta }}
        />
      </div>

      <div style={{ position: "absolute", left: LOGO_X, top: LOGO_Y }}>
        <RevelationLogo
          largeur={LARGEUR_LOGO}
          debut={DEBUT_GRADINS}
          inverse
          avecA1={false}
          exclusInterieur={PLACES_LETTRES}
          calque={({ matiere }) => <ArriveeLettres matiere={matiere} />}
        />
      </div>
    </AbsoluteFill>
  );
};

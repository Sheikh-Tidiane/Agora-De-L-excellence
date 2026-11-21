import React from "react";
import { Img, interpolate, useCurrentFrame } from "remotion";
import logoVertical from "../../../public/logos/logo-vertical.svg";
import logoVerticalInverse from "../../../public/logos/logo-vertical-inverse.svg";
import symbole from "../../../public/logos/symbole.svg";
import symboleInverse from "../../../public/logos/symbole-inverse.svg";
import { Hemicycle, chronologieHemicycle, geometrieHemicycle } from "./Hemicycle";
import { courbes, durees } from "./tokens";

/**
 * Dans logo-vertical.svg (346 × 336), le symbole occupe un carré de 168 unités
 * dont le coin est en (89,1 ; 30) : c’est symbole.svg à l’échelle 1,4.
 */
const LOGO = { largeur: 346, hauteur: 336 };
const SYMBOLE = { x: 89.1, y: 30, cote: 168 };

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Hauteur du logo vertical pour une largeur donnée. */
export const hauteurLogoVertical = (largeur: number) => (LOGO.hauteur * largeur) / LOGO.largeur;

/**
 * Géométrie de l’hémicycle en px, dans le repère du logo vertical de largeur donnée
 * (origine : coin haut gauche du logo). Pour amener des tuiles sur les places exactes.
 */
export const geometrieRevelation = (largeur: number) => {
  const k = largeur / LOGO.largeur;
  const g = geometrieHemicycle(SYMBOLE.cote * k);
  const decale = <T extends { x: number; y: number }>(p: T): T => ({ ...p, x: p.x + SYMBOLE.x * k, y: p.y + SYMBOLE.y * k });
  return { interieur: g.interieur.map(decale), exterieur: g.exterieur.map(decale), a1: decale(g.a1) };
};

/** Repères temporels de la révélation (en images, à partir de `debut`). */
export const chronologieRevelation = (debut = 0, avecA1 = true) => {
  const h = chronologieHemicycle(debut, avecA1);
  const effacementMatiere = h.fin - 6; // la fin du rebond est imperceptible : la matière s’efface déjà
  const symbole = effacementMatiere + 4;
  const logotype = symbole + durees.transitionCourte;
  return {
    ...h,
    effacementMatiere,
    /** Le symbole officiel remplace les tuiles animées, par fondu. */
    symbole,
    /** Le logotype apparaît, par fondu, sous le symbole immobile. */
    logotype,
    fin: logotype + durees.transitionLongue,
  };
};

export type RevelationLogoProps = {
  /** Largeur du logo vertical, en px. Au moins 160 px (charte du logo). */
  largeur: number;
  debut?: number;
  /** Version pour fond indigo. */
  inverse?: boolean;
  /** Faux pour s’arrêter au symbole, sans logotype. */
  avecLogotype?: boolean;
  /** Faux si la tuile A1 est apportée par une autre animation (voir `calque`). */
  avecA1?: boolean;
  /** Places des gradins occupées par des tuiles venues d’ailleurs. */
  exclusInterieur?: number[];
  exclusExterieur?: number[];
  /**
   * Tuiles venues d’ailleurs, dessinées dans le repère du logo (voir `geometrieRevelation`).
   * Reçoit la matière courante, pour s’effacer en même temps que les gradins ;
   * disparaît quand le symbole officiel est entièrement visible.
   */
  calque?: (etat: { matiere: number }) => React.ReactNode;
};

/**
 * L’hémicycle animé, puis le passage au logo officiel intact : la matière des tuiles
 * s’efface, le symbole officiel prend le relais par fondu (géométrie identique, donc
 * aucun saut), puis le logotype apparaît par fondu. Le logo lui-même n’est jamais
 * déformé ni animé dans ses éléments : seule son opacité change. L’image finale est
 * le fichier officiel logo-vertical(-inverse).svg, rien d’autre.
 */
export const RevelationLogo: React.FC<RevelationLogoProps> = ({
  largeur,
  debut = 0,
  inverse = false,
  avecLogotype = true,
  avecA1 = true,
  exclusInterieur,
  exclusExterieur,
  calque,
}) => {
  const frame = useCurrentFrame();
  const t = chronologieRevelation(debut, avecA1);
  const k = largeur / LOGO.largeur;
  const hauteur = hauteurLogoVertical(largeur);

  const matiere = interpolate(frame, [t.effacementMatiere, t.effacementMatiere + durees.transitionCourte], [1, 0], {
    ...borne,
    easing: courbes.fondu,
  });
  const opaciteSymbole = interpolate(frame, [t.symbole, t.symbole + durees.transition], [0, 1], {
    ...borne,
    easing: courbes.fondu,
  });
  const opaciteLogotype = interpolate(frame, [t.logotype, t.logotype + durees.transitionLongue], [0, 1], {
    ...borne,
    easing: courbes.fondu,
  });

  const cadreSymbole: React.CSSProperties = {
    position: "absolute",
    left: SYMBOLE.x * k,
    top: SYMBOLE.y * k,
    width: SYMBOLE.cote * k,
    height: SYMBOLE.cote * k,
  };

  return (
    <div style={{ position: "relative", width: largeur, height: hauteur }}>
      {opaciteSymbole < 1 ? (
        <>
          <div style={cadreSymbole}>
            <Hemicycle
              taille={SYMBOLE.cote * k}
              debut={debut}
              inverse={inverse}
              matiere={matiere}
              avecA1={avecA1}
              exclusInterieur={exclusInterieur}
              exclusExterieur={exclusExterieur}
            />
          </div>
          {calque ? <div style={{ position: "absolute", inset: 0 }}>{calque({ matiere })}</div> : null}
        </>
      ) : null}
      <Img
        src={inverse ? symboleInverse : symbole}
        style={{ ...cadreSymbole, opacity: opaciteLogotype >= 1 ? 0 : opaciteSymbole }}
      />
      {avecLogotype ? (
        <Img
          src={inverse ? logoVerticalInverse : logoVertical}
          style={{ position: "absolute", inset: 0, width: largeur, height: hauteur, opacity: opaciteLogotype }}
        />
      ) : null}
    </div>
  );
};

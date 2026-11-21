import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { interpolerOklch } from "./couleur";
import { Tuile, teintes, type VarianteTuile } from "./Tuile";
import { courbes, durees } from "./tokens";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type EtatTuile = {
  /** Centre, en px, dans le repère du parent. */
  x: number;
  y: number;
  /** Largeur, en px. */
  taille: number;
  ratio?: number;
  rotation?: number;
  arrondi?: number;
  variante: VarianteTuile;
  /** Lettre visible dans cet état (absente : une place des gradins, sans lettre). */
  lettre?: string;
  valeur?: number | null;
};

export type TuileEnMigrationProps = {
  depuis: EtatTuile;
  vers: EtatTuile;
  /** Image où la tuile se soulève. */
  debut: number;
  /** Durée du trajet, en images (0,6 à 1 s). */
  duree?: number;
  /** Hauteur atteinte au milieu du trajet (0–1). */
  levee?: number;
  /** Matière (0–1), pour s’effacer avant le passage au logo plat. */
  matiere?: number;
  /**
   * Images (absolues) où la lettre commence et finit de s’effacer, quand la tuile
   * devient une place. Par défaut : pendant le premier tiers du vol. À régler pour
   * que la lettre ait entièrement disparu avant un changement de fond.
   */
  effacementLettre?: { debut: number; fin: number };
};

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * Une tuile déjà posée qui se soulève, voyage et se repose ailleurs, en changeant
 * de taille, d’orientation et, si besoin, d’aspect (une lettre ivoire qui devient
 * une place des gradins) : les deux aspects se fondent l’un dans l’autre pendant le vol.
 * Elle se repose avec le même rebond court et amorti que les autres tuiles.
 */
export const TuileEnMigration: React.FC<TuileEnMigrationProps> = ({
  depuis,
  vers,
  debut,
  duree = 24,
  levee = 0.45,
  matiere = 1,
  effacementLettre,
}) => {
  const frame = useCurrentFrame();
  const t = frame - debut;
  const p = courbes.deplacement(Math.min(1, Math.max(0, t / duree)));

  // Hauteur : soulevée au milieu du trajet, puis le rebond de la pose.
  let hauteur = t <= 0 ? 0 : t < duree ? levee * Math.sin(Math.PI * Math.min(1, t / duree)) : 0;
  const tau = t - duree;
  if (tau >= 0 && tau < 6) hauteur = 0.07 * Math.sin((Math.PI * tau) / 6);
  else if (tau >= 6 && tau < durees.rebondTuile) hauteur = 0.018 * Math.sin((Math.PI * (tau - 6)) / 4);

  const x = lerp(depuis.x, vers.x, p);
  const y = lerp(depuis.y, vers.y, p);
  const taille = lerp(depuis.taille, vers.taille, p);
  const ratio = lerp(depuis.ratio ?? 1, vers.ratio ?? 1, p);
  const rotation = lerp(depuis.rotation ?? 0, vers.rotation ?? 0, p);
  const arrondi = lerp(depuis.arrondi ?? 0.13, vers.arrondi ?? 0.13, p);

  const memeAspect = depuis.variante === vers.variante && depuis.lettre === vers.lettre;

  // Une lettre qui devient une place : une seule tuile, dont la lettre s’efface au
  // début du vol et dont la couleur passe d’une teinte à l’autre (pas de fondu entre
  // deux tuiles semi-transparentes, qui laisserait voir un fantôme de lettre).
  if (!memeAspect && depuis.lettre && !vers.lettre) {
    const e = effacementLettre ?? { debut, fin: debut + duree * 0.35 };
    // Fondu de sortie, mais qui atteint exactement 0 à `fin` : plus aucune trace de la lettre ensuite.
    const opaciteLettre = interpolate(frame, [e.debut, e.fin], [1, 0], { ...borne, easing: courbes.sortie });
    // Couleur de la tuile interpolée en OKLCH (ivoire → terracotta clair : reste dans les tons chauds).
    const fond = interpolerOklch(
      teintes[depuis.variante].fond,
      teintes[vers.variante].fond,
      courbes.fondu(Math.min(1, Math.max(0, (t - duree * 0.15) / (duree * 0.6)))),
    );
    return (
      <div style={{ position: "absolute", left: x, top: y }}>
        <Tuile
          lettre={depuis.lettre}
          valeur={depuis.valeur}
          taille={taille}
          ratio={ratio}
          arrondi={arrondi}
          variante={depuis.variante}
          fond={fond}
          opaciteLettre={opaciteLettre}
          rotationFinale={rotation}
          hauteur={hauteur}
          matiere={matiere}
        />
      </div>
    );
  }

  // Autres changements d’aspect : fondu au cœur du vol, quand la tuile est la plus haute.
  const melange = memeAspect
    ? 1
    : interpolate(t, [duree * 0.3, duree * 0.7], [0, 1], { ...borne, easing: courbes.fondu });

  const aspect = (e: EtatTuile, opacite: number) =>
    opacite <= 0 ? null : (
      <Tuile
        lettre={e.lettre}
        valeur={e.valeur}
        taille={taille}
        ratio={ratio}
        arrondi={arrondi}
        variante={e.variante}
        rotationFinale={rotation}
        hauteur={hauteur}
        opacite={opacite}
        matiere={matiere}
      />
    );

  return (
    <div style={{ position: "absolute", left: x, top: y }}>
      {memeAspect ? aspect(vers, 1) : (
        <>
          {aspect(depuis, 1 - melange)}
          {aspect(vers, melange)}
        </>
      )}
    </div>
  );
};

import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { courbes, couleurs, formats, polices, s, type NomFormat } from "./tokens";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type SousTitre = {
  /** Début et fin, en secondes. */
  debut: number;
  fin: number;
  texte: string;
};

export type SousTitresProps = {
  cues: SousTitre[];
  format?: NomFormat;
  /** Sur fond clair, le bandeau est indigo ; sur fond sombre, ivoire. */
  surFondSombre?: boolean;
  /**
   * Haut du bandeau, en px, pour le placer juste sous l’élément qu’il explique (dans la zone
   * de sécurité). Par défaut, il est posé au-dessus de la zone de sécurité du bas.
   */
  haut?: number;
};

/**
 * Sous-titres intégrés : Work Sans 500, 44 px en vertical (lisible sur un petit
 * téléphone), dans un bandeau plein (pas de transparence floutée), posé juste
 * au-dessus de la zone de sécurité du bas. Deux lignes au plus par sous-titre.
 */
export const SousTitres: React.FC<SousTitresProps> = ({ cues, format = "vertical", surFondSombre = false, haut }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const zone = formats[format].securite;
  const actif = cues.find((c) => frame >= s(c.debut) && frame < s(c.fin));
  if (!actif) return null;

  const a = s(actif.debut);
  const b = s(actif.fin);
  const opacite = Math.min(
    interpolate(frame, [a, a + 5], [0, 1], { ...borne, easing: courbes.entree }),
    interpolate(frame, [b - 5, b], [1, 0], { ...borne, easing: courbes.sortie }),
  );
  const taille = format === "paysage" ? 40 : 44;

  return (
    <div
      style={{
        position: "absolute",
        left: zone.cotes,
        right: zone.cotes,
        ...(haut === undefined ? { bottom: zone.bas + 24 } : { top: haut }),
        display: "flex",
        justifyContent: "center",
        opacity: opacite,
      }}
    >
      <div
        style={{
          maxWidth: width - zone.cotes * 2,
          padding: `${taille * 0.32}px ${taille * 0.55}px`,
          borderRadius: 10,
          backgroundColor: surFondSombre ? couleurs.ivoire : couleurs.indigo,
          color: surFondSombre ? couleurs.indigo : couleurs.ivoire,
          fontFamily: polices.texte,
          fontWeight: 500,
          fontSize: taille,
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {actif.texte}
      </div>
    </div>
  );
};

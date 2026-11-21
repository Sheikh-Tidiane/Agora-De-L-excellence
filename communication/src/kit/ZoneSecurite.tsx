import React from "react";
import { AbsoluteFill } from "remotion";
import { formats, type NomFormat } from "./tokens";

/**
 * Conteneur limité à la zone de sécurité du format : tout ce qui est important
 * (texte, logo, date) se place à l’intérieur.
 */
export const ZoneSecurite: React.FC<{
  format: NomFormat;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Affiche les limites (contrôle qualité uniquement, jamais dans un rendu final). */
  reperes?: boolean;
}> = ({ format, children, style, reperes = false }) => {
  const z = formats[format].securite;
  return (
    <AbsoluteFill
      style={{
        top: z.haut,
        bottom: z.bas,
        left: z.cotes,
        right: z.cotes,
        width: "auto",
        height: "auto",
        outline: reperes ? "2px dashed rgba(194, 86, 46, 0.8)" : undefined,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

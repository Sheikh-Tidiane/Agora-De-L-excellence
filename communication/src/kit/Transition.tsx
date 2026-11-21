import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { courbes, durees } from "./tokens";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type TypeTransition = "glissement" | "fondu";

export type TransitionProps = {
  /** Durée de la scène enveloppée, en images (repère de la <Sequence> parente). */
  duree: number;
  /**
   * « glissement » : la nouvelle scène monte et recouvre la précédente, qui recule
   * d’un quart vers le haut (léger effet de profondeur) ; « fondu » : la nouvelle
   * scène apparaît en fondu par-dessus la précédente.
   */
  type?: TypeTransition;
  /** Durée de chaque transition : 12 à 24 images (0,4 à 0,8 s). */
  longueur?: number;
  entree?: boolean;
  sortie?: boolean;
  children: React.ReactNode;
};

/**
 * Le langage de transition commun. La scène qui part ne devient jamais
 * transparente (pas de mélange boueux entre un fond ivoire et un fond indigo) :
 * c’est la scène qui arrive qui la recouvre. Une même vidéo n’emploie qu’un type.
 *
 * Pour enchaîner deux scènes, faire se chevaucher leurs <Sequence> de `longueur`
 * images ; la seconde doit être déclarée après la première (elle passe dessus).
 */
export const Transition: React.FC<TransitionProps> = ({
  duree,
  type = "glissement",
  longueur = durees.transition,
  entree = true,
  sortie = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { height } = useVideoConfig();

  const pEntree = entree
    ? interpolate(frame, [0, longueur], [0, 1], { ...borne, easing: courbes.deplacement })
    : 1;
  const pSortie = sortie
    ? interpolate(frame, [duree - longueur, duree], [0, 1], { ...borne, easing: courbes.deplacement })
    : 0;

  if (type === "fondu") {
    return <AbsoluteFill style={{ opacity: pEntree }}>{children}</AbsoluteFill>;
  }

  const y = (1 - pEntree) * height - pSortie * height * 0.25;
  return (
    <AbsoluteFill style={{ transform: `translateY(${y}px)`, overflow: "hidden" }}>
      {children}
    </AbsoluteFill>
  );
};

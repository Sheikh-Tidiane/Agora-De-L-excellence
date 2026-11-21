import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Transition } from "../src/kit";
import { Finale } from "./Finale";
import { DUREE_TEASER, FONDU, plans } from "./minutage";
import { PageQuiSeTourne, PlanFilme, Plateau, TuilesSurLaTable } from "./Scenes";

export { DUREE_TEASER };

export type TeaserProps = {
  /** « plan » : avec le plan filmé (emplacement) ; « animee » : 100 % animée, publiable tout de suite. */
  version: "plan" | "animee";
};

/**
 * Teaser de la semaine 1, « le mystère » (vertical, 19,3 s). Voir semaine-1/STORYBOARD.md.
 * Un seul langage de transition : le fondu de 0,4 s entre les plans du moment de lecture,
 * puis le passage par les tuiles (elles se rangent, rejoignent l’hémicycle) et le passage de fond.
 */
export const Teaser: React.FC<TeaserProps> = ({ version }) => {
  const plateau = (n: 1 | 2) =>
    version === "plan" ? <PlanFilme extrait={n} /> : <Plateau plan={n} />;
  const { chute, plateau1, page, plateau2, finale } = plans;
  return (
    <AbsoluteFill>
      <Sequence from={chute.debut} durationInFrames={chute.duree} name="1 · Les tuiles tombent">
        <TuilesSurLaTable />
      </Sequence>
      <Sequence from={plateau1.debut} durationInFrames={plateau1.duree} name="2a · Le plateau">
        <Transition duree={plateau1.duree} type="fondu" longueur={FONDU}>
          {plateau(1)}
        </Transition>
      </Sequence>
      <Sequence from={page.debut} durationInFrames={page.duree} name="2b · La page se tourne">
        <Transition duree={page.duree} type="fondu" longueur={FONDU}>
          <PageQuiSeTourne />
        </Transition>
      </Sequence>
      <Sequence from={plateau2.debut} durationInFrames={plateau2.duree} name="2c · Le plateau, encore">
        <Transition duree={plateau2.duree} type="fondu" longueur={FONDU}>
          {plateau(2)}
        </Transition>
      </Sequence>
      <Sequence from={finale.debut} name="3–5 · AGORA, l’hémicycle, Bientôt à Dakar">
        <Transition duree={DUREE_TEASER - finale.debut} type="fondu" longueur={FONDU}>
          <Finale />
        </Transition>
      </Sequence>
    </AbsoluteFill>
  );
};

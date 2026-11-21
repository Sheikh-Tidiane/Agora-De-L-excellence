import React from "react";
import { Composition, Folder, Still } from "remotion";
import { DUREE_DEMO, DemoKit } from "../demo-kit/DemoKit";
import { PlancheKit } from "../demo-kit/PlancheKit";
import { ReferenceLogo } from "../demo-kit/ReferenceLogo";
import { DUREE_TEASER, Teaser } from "../semaine-1/Teaser";
import { VisuelLogo, VisuelQuestion, VisuelSlogan } from "../semaine-1/Visuels";
import { DUREE_PRESENTATION } from "../semaine-2/minutage";
import { Presentation } from "../semaine-2/Presentation";
import { SaveTheDate } from "../semaine-2/SaveTheDate";
import { FPS, chargerPolices, formats } from "./kit";

chargerPolices();

const { vertical, portrait, carre } = formats;

const VISUELS = [
  ["S1Logo", VisuelLogo],
  ["S1Slogan", VisuelSlogan],
  ["S1Question", VisuelQuestion],
] as const;

/**
 * Registre des compositions. Convention de nommage : <Production>-<Format>,
 * par exemple « DemoKit-Vertical » ; le script d’export s’en sert.
 */
export const Root: React.FC = () => (
  <>
    <Folder name="Kit">
      <Composition
        id="DemoKit-Vertical"
        component={DemoKit}
        durationInFrames={DUREE_DEMO}
        fps={FPS}
        width={vertical.largeur}
        height={vertical.hauteur}
      />
      <Still id="PlancheKit-Portrait" component={PlancheKit} width={portrait.largeur} height={portrait.hauteur} />
      <Still id="ReferenceLogo-Vertical" component={ReferenceLogo} width={vertical.largeur} height={vertical.hauteur} />
    </Folder>
    <Folder name="Semaine-1">
      <Composition
        id="Teaser-Vertical"
        component={Teaser}
        defaultProps={{ version: "plan" as const }}
        durationInFrames={DUREE_TEASER}
        fps={FPS}
        width={vertical.largeur}
        height={vertical.hauteur}
      />
      <Composition
        id="TeaserAnime-Vertical"
        component={Teaser}
        defaultProps={{ version: "animee" as const }}
        durationInFrames={DUREE_TEASER}
        fps={FPS}
        width={vertical.largeur}
        height={vertical.hauteur}
      />
      {VISUELS.map(([nom, Visuel]) => (
        <React.Fragment key={nom}>
          <Still id={`${nom}-Carre`} component={Visuel} defaultProps={{ format: "carre" as const }} width={carre.largeur} height={carre.hauteur} />
          <Still id={`${nom}-Portrait`} component={Visuel} defaultProps={{ format: "portrait" as const }} width={portrait.largeur} height={portrait.hauteur} />
        </React.Fragment>
      ))}
    </Folder>
    <Folder name="Semaine-2">
      <Composition
        id="Presentation-Vertical"
        component={Presentation}
        defaultProps={{ apercuPlans: false }}
        durationInFrames={DUREE_PRESENTATION}
        fps={FPS}
        width={vertical.largeur}
        height={vertical.hauteur}
      />
      <Composition
        id="PresentationPlans-Vertical"
        component={Presentation}
        defaultProps={{ apercuPlans: true }}
        durationInFrames={DUREE_PRESENTATION}
        fps={FPS}
        width={vertical.largeur}
        height={vertical.hauteur}
      />
      <Still id="SaveTheDate-Vertical" component={SaveTheDate} defaultProps={{ format: "vertical" as const }} width={vertical.largeur} height={vertical.hauteur} />
      <Still id="SaveTheDate-Carre" component={SaveTheDate} defaultProps={{ format: "carre" as const }} width={carre.largeur} height={carre.hauteur} />
      <Still id="SaveTheDate-Portrait" component={SaveTheDate} defaultProps={{ format: "portrait" as const }} width={portrait.largeur} height={portrait.hauteur} />
    </Folder>
  </>
);

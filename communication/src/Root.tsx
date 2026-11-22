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
import { Activite, VisuelActivite, minutageActivite } from "../semaine-3/Activite";
import { serie } from "../semaine-3/contenus";
import { DefiScrabble, ReponseScrabble, minutageDefi, minutageReponse } from "../semaine-5/Defi";
import { DiapoQuiz, NOMBRE_DIAPOS_QUIZ } from "../semaine-5/Quiz";
import { MotDeLaSemaine } from "../semaine-5/MotDeLaSemaine";
import { AnnonceTexteLancement, VisuelTexteLancement, minutageTexteLancement } from "../semaine-5/TexteLancement";
import { defis, motsDeLaSemaine } from "../semaine-5/contenus";
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
    <Folder name="Semaine-3">
      {serie.map((a) => (
        <React.Fragment key={a.slug}>
          <Composition
            id={`S3${a.slug}-Vertical`}
            component={Activite}
            defaultProps={{ numero: a.numero }}
            durationInFrames={minutageActivite(a).fin}
            fps={FPS}
            width={vertical.largeur}
            height={vertical.hauteur}
          />
          <Still id={`S3${a.slug}-Portrait`} component={VisuelActivite} defaultProps={{ numero: a.numero }} width={portrait.largeur} height={portrait.hauteur} />
        </React.Fragment>
      ))}
    </Folder>
    <Folder name="Semaine-5">
      {defis.map((d) => (
        <React.Fragment key={d.numero}>
          <Composition id={`S5Defi${d.numero}-Vertical`} component={DefiScrabble} defaultProps={{ numero: d.numero }} durationInFrames={minutageDefi.fin} fps={FPS} width={vertical.largeur} height={vertical.hauteur} />
          <Composition id={`S5Reponse${d.numero}-Vertical`} component={ReponseScrabble} defaultProps={{ numero: d.numero }} durationInFrames={minutageReponse.fin} fps={FPS} width={vertical.largeur} height={vertical.hauteur} />
        </React.Fragment>
      ))}
      {Array.from({ length: NOMBRE_DIAPOS_QUIZ }, (_, i) => (
        <Still key={i} id={`S5Quiz${i + 1}-Portrait`} component={DiapoQuiz} defaultProps={{ diapo: i + 1 }} width={portrait.largeur} height={portrait.hauteur} />
      ))}
      {motsDeLaSemaine.map((m) => (
        <React.Fragment key={m.numero}>
          <Still id={`S5Mot${m.numero}-Portrait`} component={MotDeLaSemaine} defaultProps={{ numero: m.numero, format: "portrait" as const }} width={portrait.largeur} height={portrait.hauteur} />
          <Still id={`S5Mot${m.numero}-Vertical`} component={MotDeLaSemaine} defaultProps={{ numero: m.numero, format: "vertical" as const }} width={vertical.largeur} height={vertical.hauteur} />
        </React.Fragment>
      ))}
      <Composition id="S5TexteLancement-Vertical" component={AnnonceTexteLancement} durationInFrames={minutageTexteLancement.fin} fps={FPS} width={vertical.largeur} height={vertical.hauteur} />
      <Still id="S5TexteLancement-Portrait" component={VisuelTexteLancement} width={portrait.largeur} height={portrait.hauteur} />
    </Folder>
  </>
);

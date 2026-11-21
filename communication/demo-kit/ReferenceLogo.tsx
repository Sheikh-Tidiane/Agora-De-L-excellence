import React from "react";
import { Img } from "remotion";
import logoVerticalInverse from "../../public/logos/logo-vertical-inverse.svg";
import { FondIndigo } from "../src/kit";
import { CADRE_LOGO_DEMO } from "./DemoKit";

/**
 * Image de contrôle (jamais publiée) : le fond et le fichier officiel
 * logo-vertical-inverse.svg seuls, au cadrage de la fin de la démo.
 * La dernière image de la démo doit lui être identique au pixel près.
 */
export const ReferenceLogo: React.FC = () => (
  <FondIndigo>
    <Img
      src={logoVerticalInverse}
      style={{
        position: "absolute",
        left: CADRE_LOGO_DEMO.x,
        top: CADRE_LOGO_DEMO.y,
        width: CADRE_LOGO_DEMO.largeur,
        height: CADRE_LOGO_DEMO.hauteur,
      }}
    />
  </FondIndigo>
);

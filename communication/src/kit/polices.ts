import { loadFont } from "@remotion/fonts";
import { continueRender, delayRender } from "remotion";
// Polices chargées localement depuis les paquets Fontsource (licence SIL Open Font).
import youngSerif400 from "@fontsource/young-serif/files/young-serif-latin-400-normal.woff2";
import youngSerifExt400 from "@fontsource/young-serif/files/young-serif-latin-ext-400-normal.woff2";
import workSans400 from "@fontsource/work-sans/files/work-sans-latin-400-normal.woff2";
import workSans500 from "@fontsource/work-sans/files/work-sans-latin-500-normal.woff2";
import workSans600 from "@fontsource/work-sans/files/work-sans-latin-600-normal.woff2";
import workSans700 from "@fontsource/work-sans/files/work-sans-latin-700-normal.woff2";
import workSansExt400 from "@fontsource/work-sans/files/work-sans-latin-ext-400-normal.woff2";
import workSansExt600 from "@fontsource/work-sans/files/work-sans-latin-ext-600-normal.woff2";
import { polices } from "./tokens";

const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const fichiers = [
  { family: polices.titre, url: youngSerif400, weight: "400" },
  { family: polices.titre, url: youngSerifExt400, weight: "400", unicodeRange: LATIN_EXT },
  { family: polices.texte, url: workSans400, weight: "400" },
  { family: polices.texte, url: workSans500, weight: "500" },
  { family: polices.texte, url: workSans600, weight: "600" },
  { family: polices.texte, url: workSans700, weight: "700" },
  { family: polices.texte, url: workSansExt400, weight: "400", unicodeRange: LATIN_EXT },
  { family: polices.texte, url: workSansExt600, weight: "600", unicodeRange: LATIN_EXT },
];

let charge = false;

/** À appeler une fois, au chargement du projet : le rendu attend que les polices soient prêtes. */
export const chargerPolices = () => {
  if (charge) return;
  charge = true;
  const attente = delayRender("Chargement des polices de L’Agora");
  Promise.all(fichiers.map((f) => loadFont({ ...f, format: "woff2" })))
    .then(() => continueRender(attente))
    .catch((erreur) => {
      console.error(erreur);
      continueRender(attente);
    });
};

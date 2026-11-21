// Rend des images clés (PNG) d’une composition, pour le storyboard et la validation.
//
//   pnpm images-cles <IdComposition> <image> [<image>…] [--sortie <dossier>]
//   pnpm images-cles DemoKit-Vertical 20 60 110 --sortie out/demo-kit/images-cles
//
// Les images sont des numéros d’image (30 par seconde) ; « 3.5s » est aussi accepté.
import fs from "node:fs";
import path from "node:path";
import { renderStill, selectComposition } from "@remotion/renderer";
import { RACINE, lireArguments, preparer } from "./commun.mjs";

const { positionnels, options } = lireArguments(process.argv.slice(2));
const [id, ...images] = positionnels;
if (!id) {
  console.error("Usage : pnpm images-cles <IdComposition> <image>… [--sortie <dossier>]");
  process.exit(1);
}

const sortie = path.resolve(RACINE, options.sortie ?? path.join("out", id, "images-cles"));
fs.mkdirSync(sortie, { recursive: true });

const serveUrl = await preparer();
const composition = await selectComposition({ serveUrl, id });
const liste = images.length ? images : ["0"];

for (const brut of liste) {
  const frame = brut.endsWith("s") ? Math.round(parseFloat(brut) * composition.fps) : parseInt(brut, 10);
  const fichier = path.join(sortie, `${id}-${String(frame).padStart(4, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output: fichier, imageFormat: "png" });
  console.log(`✓ ${path.relative(RACINE, fichier)}`);
}

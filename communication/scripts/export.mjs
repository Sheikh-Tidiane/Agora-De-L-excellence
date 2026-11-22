// Export final d’une ou plusieurs vidéos : pour chacune, une version haute qualité
// et une version compressée pour WhatsApp (16 Mo au plus, texte net).
//
//   pnpm export <IdComposition> [<IdComposition>…]
//   pnpm export DemoKit-Vertical
//   pnpm export DemoKit-Vertical --essai   (1 seconde seulement, dans out/_essais/, pour vérifier la chaîne)
//
// Sorties : out/<Id>/<Id>-HQ.mp4 et out/<Id>/<Id>-WhatsApp.mp4 (MP4 H.264, 30 i/s, sans son).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { RACINE, lireArguments, preparer } from "./commun.mjs";

const LIMITE_WHATSAPP = 16 * 1024 * 1024; // octets
const MARGE = 0.9; // on vise 90 % de la limite

const { positionnels, options } = lireArguments(process.argv.slice(2));
if (!positionnels.length) {
  console.error("Usage : pnpm export <IdComposition> [<IdComposition>…]");
  process.exit(1);
}

const remotion = path.join(RACINE, "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion");
/** ffmpeg fourni par Remotion : aucune installation séparée. */
const ffmpeg = (args) => execFileSync(remotion, ["ffmpeg", ...args], { stdio: "inherit", shell: process.platform === "win32" });

const serveUrl = await preparer();

for (const id of positionnels) {
  const composition = await selectComposition({ serveUrl, id });
  const essai = Boolean(options.essai);
  const dossier = path.join(RACINE, "out", essai ? "_essais" : id);
  fs.mkdirSync(dossier, { recursive: true });
  const hq = path.join(dossier, `${id}-HQ.mp4`);
  const whatsapp = path.join(dossier, `${id}-WhatsApp.mp4`);

  console.log(`\n▶ ${id} — version haute qualité`);
  let dernier = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 16,
    x264Preset: "slow",
    pixelFormat: "yuv420p",
    // BT.709 en plage standard : ce que les applis et les téléphones attendent (sinon couleurs ternes ou décalées).
    colorSpace: "bt709",
    muted: true,
    frameRange: essai ? [0, composition.fps - 1] : undefined,
    outputLocation: hq,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 10);
      if (p !== dernier) {
        dernier = p;
        process.stdout.write(`${p * 10} % `);
      }
    },
  });

  // Qualité constante (CRF 20, texte net), avec un débit plafonné calculé pour tenir sous la limite
  // (et jamais au-delà de 8 Mb/s : aucun gain visible sur un téléphone).
  const secondes = essai ? 1 : composition.durationInFrames / composition.fps;
  const debit = Math.min(8000, Math.floor((LIMITE_WHATSAPP * 8 * MARGE) / secondes / 1000));
  console.log(`\n▶ ${id} — version WhatsApp (plafond ${debit} kb/s)`);
  ffmpeg([
    "-y", "-loglevel", "error", "-i", hq,
    "-c:v", "libx264", "-preset", "slow", "-tune", "animation",
    "-crf", "20", "-maxrate", `${debit}k`, "-bufsize", `${debit * 2}k`,
    "-pix_fmt", "yuv420p",
    "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
    "-movflags", "+faststart", "-an", whatsapp,
  ]);

  const taille = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(1);
  console.log(`✓ ${path.relative(RACINE, hq)} (${taille(hq)} Mo)`);
  console.log(`✓ ${path.relative(RACINE, whatsapp)} (${taille(whatsapp)} Mo)`);
  if (fs.statSync(whatsapp).size > LIMITE_WHATSAPP) console.warn("⚠ La version WhatsApp dépasse 16 Mo.");
}

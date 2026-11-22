// Sonorise la version WhatsApp d’une vidéo déjà exportée (pnpm export) :
//
//   pnpm sonoriser <IdComposition> <bande.mjs> [--lufs -14] [--pic -1]
//   pnpm sonoriser S5TexteLancement-Vertical semaine-5/son-texte-lancement.mjs
//
// 1. Construit la bande son du module (fonction `bande()`, sons synthétisés dans le projet).
// 2. La normalise à la cible (−14 LUFS intégrés par défaut) avec un limiteur à anticipation
//    qui garde le pic vrai sous le plafond (−1 dBTP par défaut, avec 1 dB de marge pour
//    l’encodage AAC) ; mesure par le filtre loudnorm de ffmpeg (EBU R128), plusieurs passes.
// 3. L’ajoute à out/<Id>/<Id>-WhatsApp.mp4 (image recopiée telle quelle, son AAC 48 kHz)
//    et garde la bande en WAV 24 bits : out/<Id>/<Id>-bande-son.wav.
// 4. Mesure le fichier final (après encodage) et échoue si la cible n’est pas tenue.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RACINE, lireArguments } from "./commun.mjs";
import { ecrireWav, gain, limiter } from "./son/synthese.mjs";

const { positionnels, options } = lireArguments(process.argv.slice(2));
const [id, module] = positionnels;
if (!id || !module) {
  console.error("Usage : pnpm sonoriser <IdComposition> <bande.mjs> [--lufs -14] [--pic -1]");
  process.exit(1);
}
const CIBLE = Number(options.lufs ?? -14);
const PIC = Number(options.pic ?? -1);
const MARGE_AAC = 1; // l’encodage AAC fait remonter le pic vrai d’environ 0,5 dB

const remotion = path.join(RACINE, "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion");
const ffmpeg = (args) => {
  const r = spawnSync(remotion, ["ffmpeg", ...args], { shell: process.platform === "win32", encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg a échoué :\n${r.stderr}`);
  return r.stderr;
};
const q = (p) => (process.platform === "win32" ? `"${p}"` : p);

/** Mesure EBU R128 (intégré en LUFS, pic vrai en dBTP) d’un fichier audio ou vidéo. */
const mesurer = (fichier) => {
  const sortie = ffmpeg(["-hide_banner", "-nostats", "-i", q(fichier), "-vn", "-af", `loudnorm=I=${CIBLE}:TP=${PIC}:print_format=json`, "-f", "null", "-"]);
  const json = JSON.parse(sortie.slice(sortie.lastIndexOf("{"), sortie.lastIndexOf("}") + 1));
  return { lufs: Number(json.input_i), pic: Number(json.input_tp) };
};

const dossier = path.join(RACINE, "out", id);
const video = path.join(dossier, `${id}-WhatsApp.mp4`);
if (!fs.existsSync(video)) {
  console.error(`Vidéo introuvable : ${path.relative(RACINE, video)} (lancer d’abord pnpm export ${id}).`);
  process.exit(1);
}
const wav = path.join(dossier, `${id}-bande-son.wav`);

const { bande } = await import(pathToFileURL(path.resolve(RACINE, module)).href);
const brute = bande();

// Normalisation : gain vers la cible, limiteur au plafond, nouvelle mesure ; on recommence
// en corrigeant le gain tant que l’écart dépasse 0,2 LU (le limiteur fait perdre un peu).
let gainDb = 0;
let mesure = null;
let reduit = 0;
for (let passe = 1; passe <= 6; passe++) {
  const essai = { taux: brute.taux, g: Float32Array.from(brute.g), d: Float32Array.from(brute.d) };
  gain(essai, 10 ** (gainDb / 20));
  reduit = limiter(essai, PIC - MARGE_AAC);
  await ecrireWav(essai, wav);
  mesure = mesurer(wav);
  console.log(`passe ${passe} : gain ${gainDb.toFixed(2)} dB, limiteur ${reduit.toFixed(1)} dB au plus → ${mesure.lufs.toFixed(1)} LUFS, pic vrai ${mesure.pic.toFixed(1)} dBTP`);
  if (Math.abs(mesure.lufs - CIBLE) <= 0.2) break;
  gainDb += CIBLE - mesure.lufs;
}

// Assemblage : l’image est recopiée sans réencodage ; le son est encodé en AAC 48 kHz.
const temp = path.join(dossier, `${id}-WhatsApp.son.tmp.mp4`);
ffmpeg([
  "-hide_banner", "-y", "-i", q(video), "-i", q(wav),
  "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
  "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
  "-shortest", "-movflags", "+faststart", q(temp),
]);
const final = mesurer(temp);
console.log(`\nFichier final (après encodage AAC) : ${final.lufs.toFixed(1)} LUFS, pic vrai ${final.pic.toFixed(1)} dBTP (cible ${CIBLE} LUFS, ≤ ${PIC} dBTP)`);
if (Math.abs(final.lufs - CIBLE) > 0.5 || final.pic > PIC) {
  fs.rmSync(temp);
  console.error("✗ Cible non tenue : la version WhatsApp n’est pas remplacée.");
  process.exit(1);
}
fs.renameSync(temp, video);
console.log(`✓ ${path.relative(RACINE, video)} (${(fs.statSync(video).size / 1024 / 1024).toFixed(1)} Mo), bande : ${path.relative(RACINE, wav)}`);

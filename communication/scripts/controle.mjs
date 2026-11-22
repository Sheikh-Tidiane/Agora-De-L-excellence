// Contrôle qualité d’une vidéo exportée :
//  - caractéristiques (codec, taille, cadence, plage de couleurs, poids) ;
//  - fluidité : écart moyen entre chaque image et la suivante, pour repérer un saut
//    ou un clignotement (une image isolée beaucoup plus différente que ses voisines) ;
//  - fidélité des couleurs : pixels échantillonnés comparés aux couleurs attendues.
//
//   pnpm controle <fichier.mp4> [--pixel x,y,image,#RRGGBB]…
//   pnpm controle out/DemoKit-Vertical/DemoKit-Vertical-WhatsApp.mp4 --pixel 540,1700,290,#1F2A55
//   pnpm controle <fichier.mp4> --pixel 540,1700,290,out/demo-kit/images-cles/DemoKit-Vertical-0290.png
//   (référence = la même image rendue en PNG : on compare la zone 4 × 4 px, en moyenne)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { RACINE } from "./commun.mjs";

const bin = path.join(RACINE, "node_modules", ".bin", process.platform === "win32" ? "remotion.cmd" : "remotion");
const outil = (nom, args) =>
  execFileSync(bin, [nom, ...args], { shell: process.platform === "win32", encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

/** Décodeur PNG minimal (8 bits, RVB ou RVBA, non entrelacé) : ce que produit ffmpeg. */
const lirePng = (fichier) => {
  const b = fs.readFileSync(fichier);
  let o = 8, largeur = 0, hauteur = 0, type = 0;
  const donnees = [];
  while (o < b.length) {
    const n = b.readUInt32BE(o), nom = b.toString("latin1", o + 4, o + 8), c = b.subarray(o + 8, o + 8 + n);
    if (nom === "IHDR") { largeur = c.readUInt32BE(0); hauteur = c.readUInt32BE(4); type = c[9]; }
    if (nom === "IDAT") donnees.push(c);
    o += 12 + n;
  }
  const canaux = type === 6 ? 4 : 3, ligne = largeur * canaux;
  const brut = zlib.inflateSync(Buffer.concat(donnees));
  const px = Buffer.alloc(ligne * hauteur);
  for (let y = 0; y < hauteur; y++) {
    const f = brut[y * (ligne + 1)], src = brut.subarray(y * (ligne + 1) + 1, (y + 1) * (ligne + 1));
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? px[y * ligne + x - canaux] : 0, h = y ? px[(y - 1) * ligne + x] : 0;
      const ah = x >= canaux && y ? px[(y - 1) * ligne + x - canaux] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += h; else if (f === 3) v += (a + h) >> 1;
      else if (f === 4) { const p = a + h - ah, pa = Math.abs(p - a), pb = Math.abs(p - h), pc = Math.abs(p - ah); v += pa <= pb && pa <= pc ? a : pb <= pc ? h : ah; }
      px[y * ligne + x] = v & 255;
    }
  }
  return { largeur, hauteur, canaux, px };
};

/** Couleur moyenne d’une petite zone (le grain de papier rend un pixel isolé peu fiable). */
const moyenne = ({ px, canaux }) => {
  const s = [0, 0, 0];
  const n = px.length / canaux;
  for (let i = 0; i < px.length; i += canaux) for (let c = 0; c < 3; c++) s[c] += px[i + c];
  return s.map((v) => Math.round(v / n));
};

const args = process.argv.slice(2);
const video = path.resolve(RACINE, args[0] ?? "");
if (!args[0] || !fs.existsSync(video)) {
  console.error("Usage : pnpm controle <fichier.mp4> [--pixel x,y,image,#RRGGBB]…");
  process.exit(1);
}
const pixels = [];
for (let i = 1; i < args.length; i++) if (args[i] === "--pixel") pixels.push(args[++i].split(","));

console.log(outil("ffprobe", ["-v", "error", "-show_entries",
  "stream=codec_name,width,height,r_frame_rate,nb_frames,pix_fmt,color_range,color_space:format=duration,size",
  "-of", "default=noprint_wrappers=1", video]).trim());

// Fluidité : toutes les images, réduites à 270 × 480.
const dossier = path.join(RACINE, "out", "_controle", path.basename(video, ".mp4"));
fs.rmSync(dossier, { recursive: true, force: true });
fs.mkdirSync(dossier, { recursive: true });
outil("ffmpeg", ["-v", "error", "-i", video, "-vf", "scale=270:-2", path.join(dossier, "%04d.png")]);
const images = fs.readdirSync(dossier).filter((f) => f.endsWith(".png")).sort();
const ecarts = [];
let precedente = null;
for (const f of images) {
  const { px } = lirePng(path.join(dossier, f));
  if (precedente) {
    let somme = 0;
    for (let i = 0; i < px.length; i++) somme += Math.abs(px[i] - precedente[i]);
    ecarts.push(somme / px.length);
  }
  precedente = px;
}
const suspects = ecarts
  .map((e, i) => ({ i: i + 1, e, voisins: Math.max(ecarts[i - 1] ?? 0, ecarts[i + 1] ?? 0) }))
  .filter(({ e, voisins }) => e > 1.5 && e > 3 * voisins);
console.log(`\nFluidité : ${images.length} images, écart moyen max ${Math.max(...ecarts).toFixed(2)} (image ${ecarts.indexOf(Math.max(...ecarts)) + 1}).`);
console.log(suspects.length ? `⚠ Sauts possibles aux images : ${suspects.map((s) => s.i).join(", ")}` : "✓ Aucun saut ni clignotement isolé.");
const cumul = ecarts.map((e) => e.toFixed(1)).join(" ");
fs.writeFileSync(path.join(dossier, "ecarts.txt"), cumul);

// Couleurs.
for (const [x, y, image, attendu] of pixels) {
  const fichier = path.join(dossier, `zone-${image}-${x}-${y}.png`);
  // Recherche par le temps (milieu de l’image voulue) : pas de filtre à virgules, que le shell Windows découpe.
  // 1 ms avant l’horodatage de l’image : ffmpeg rend la première image qui suit,
  // c’est-à-dire celle-ci, y compris la toute dernière de la vidéo.
  const t = Math.max(0, Number(image) / 30 - 0.001).toFixed(3);
  outil("ffmpeg", ["-v", "error", "-y", "-ss", t, "-i", video, "-frames:v", "1", "-vf", `crop=4:4:${x}:${y}`, fichier]);
  const obtenu = moyenne(lirePng(fichier));
  let cible;
  if (attendu.endsWith(".png")) {
    // Référence : la même image rendue directement en PNG par Remotion (pnpm images-cles), même zone.
    const ref = path.join(dossier, `reference-${image}-${x}-${y}.png`);
    outil("ffmpeg", ["-v", "error", "-y", "-i", path.resolve(RACINE, attendu), "-vf", `crop=4:4:${x}:${y}`, ref]);
    cible = moyenne(lirePng(ref));
  } else cible = attendu.replace("#", "").match(/../g).map((h) => parseInt(h, 16));
  const delta = Math.max(...cible.map((c, i) => Math.abs(c - obtenu[i])));
  console.log(`${delta <= 4 ? "✓" : "⚠"} Zone (${x}, ${y}) image ${image} : rgb(${obtenu.join(", ")}), attendu rgb(${cible.join(", ")}) (écart ${delta})`);
}

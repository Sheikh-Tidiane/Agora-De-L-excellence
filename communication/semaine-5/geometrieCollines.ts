/**
 * Géométrie des deux collines et minutage de l’annonce du texte du lancement, sans React :
 * la vidéo (TexteLancement.tsx) et la bande son (son-texte-lancement.ts) lisent les mêmes
 * valeurs, pour que chaque pose de tuile s’entende à l’image exacte de son contact.
 */
import type { VarianteTuile } from "../src/kit/Tuile";

const W = 1080;

type Place = { x: number; y: number; variante: VarianteTuile; rotation: number };

export const TAILLE_PLACE = 46;
/** Durée du vol d’une place avant le contact, en images. */
export const VOL_PLACE = 12;

/**
 * Les deux collines de Dakar, en places sans lettre (comme les gradins du logo), couleur
 * latérite. Chaque colline est faite de rangées en arc, l’une dans l’autre : un dôme, et
 * non un mur. Chaque place suit la courbe (tournée selon la tangente). Pose : rangée
 * extérieure d’abord, de gauche à droite, comme un geste qui dessine la colline.
 */
export const placesCollines = (base: number, echelle: number): Place[] => {
  const collines = [
    { cx: 350, a: 230, b: 220, rangs: 3, variante: "terracotta" as const },
    { cx: 800, a: 155, b: 145, rangs: 2, variante: "terracottaClair" as const },
  ];
  const places: Place[] = [];
  const pas = TAILLE_PLACE * 1.16 * echelle;
  const ecart = TAILLE_PLACE * 1.2 * echelle;
  collines.forEach((c) => {
    const cx = W / 2 + (c.cx - W / 2) * echelle;
    for (let r = 0; r < c.rangs; r++) {
      const a = c.a * echelle - r * ecart;
      const b = c.b * echelle - r * ecart;
      // Demi-ellipse échantillonnée finement, puis places réparties à longueur d’arc égale.
      const N = 400;
      const pts = Array.from({ length: N + 1 }, (_, k) => {
        const th = Math.PI - (Math.PI * k) / N;
        return { x: cx + a * Math.cos(th), y: base - b * Math.sin(th), th };
      });
      const cumul = [0];
      for (let k = 1; k <= N; k++) cumul.push(cumul[k - 1]! + Math.hypot(pts[k]!.x - pts[k - 1]!.x, pts[k]!.y - pts[k - 1]!.y));
      const longueur = cumul[N]!;
      const n = Math.max(2, Math.round(longueur / pas) + 1);
      for (let i = 0; i < n; i++) {
        const cible = (longueur * i) / (n - 1);
        let k = cumul.findIndex((v) => v >= cible);
        if (k < 0) k = N;
        const p = pts[k]!;
        let rot = (Math.atan2(-b * Math.cos(p.th), -a * Math.sin(p.th)) * 180) / Math.PI;
        if (rot > 90) rot -= 180;
        if (rot <= -90) rot += 180;
        // Les places au pied de la colline reposent à plat sur le sol.
        const y = Math.min(p.y, base - TAILLE_PLACE * 0.41 * echelle);
        places.push({ x: p.x, y, variante: c.variante, rotation: rot });
      }
    }
  });
  return places;
};


export const minutageTexteLancement = {
  surtitre: 6,
  collines: 14,
  accroche1: 92,
  sortie1: 160,
  accroche2: 176,
  sortie2: 256,
  titre: 274,
  auteur: 296,
  date: 344,
  signature: 392,
  fin: 480,
} as const;

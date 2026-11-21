/**
 * Interpolation de couleurs dans l’espace OKLCH (Björn Ottosson, 2020) : la
 * clarté perçue varie régulièrement et la teinte suit un chemin choisi, au lieu
 * du mélange RVB qui fait passer deux couleurs éloignées par un gris terne.
 */

export type Oklch = { L: number; C: number; H: number };

const versLineaire = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const versGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const borner = (v: number) => Math.min(1, Math.max(0, v));

export const hexVersOklch = (hex: string): Oklch => {
  const [r, g, b] = (hex.replace("#", "").match(/../g) ?? []).map((h) => versLineaire(parseInt(h, 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { L, C: Math.hypot(A, B), H };
};

export const oklchVersHex = ({ L, C, H }: Oklch): string => {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rvb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rvb.map((c) => Math.round(borner(versGamma(c)) * 255).toString(16).padStart(2, "0")).join("")}`;
};

export type OptionsOklch = {
  /**
   * Sens de rotation de la teinte : « court » (le plus court), « croissant » ou
   * « decroissant ». Entre l’ivoire (≈ 85°) et l’indigo (≈ 270°), le plus court
   * passe par les roses et donne un mauve ; « croissant » passe par les bleus.
   */
  sens?: "court" | "croissant" | "decroissant";
  /**
   * Fraction du passage à laquelle la teinte a fini de tourner (1 : en même temps
   * que le reste). Plus tôt, la teinte d’arrivée s’installe pendant que la couleur
   * est encore peu saturée, donc sans s’y attarder visiblement.
   */
  avanceTeinte?: number;
};

/** Couleur intermédiaire entre `de` et `vers` (hex), pour une progression p de 0 à 1. */
export const interpolerOklch = (de: string, vers: string, p: number, options: OptionsOklch = {}): string => {
  if (p <= 0) return de;
  if (p >= 1) return vers;
  const { sens = "court", avanceTeinte = 1 } = options;
  const a = hexVersOklch(de);
  const b = hexVersOklch(vers);
  let ecart = b.H - a.H;
  if (sens === "court") ecart = ((ecart + 540) % 360) - 180;
  else if (sens === "croissant") ecart = (ecart + 360) % 360;
  else ecart = -((360 - ecart) % 360);
  const pt = Math.min(1, p / avanceTeinte);
  return oklchVersHex({
    L: a.L + (b.L - a.L) * p,
    C: a.C + (b.C - a.C) * p,
    H: (a.H + ecart * pt + 360) % 360,
  });
};

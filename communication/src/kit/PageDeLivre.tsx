import React from "react";
import { couleurs, lumiere, polices } from "./tokens";

/**
 * Un livre ouvert vu de dessus, dont la page de droite se tourne : le coin bas
 * se soulève le premier, le pli traverse la page jusqu’au dos, le revers de la
 * page se rabat sur la gauche et découvre la page suivante.
 *
 * Tout est plat (aucune rotation 3D) : la page visible est découpée le long du
 * pli, le revers est le reflet de la partie découpée par rapport au pli, et la
 * profondeur ne vient que d’ombres douces dans la direction de la lumière commune.
 * Le texte est soit un vrai texte (`textes`), composé comme une page de livre et lisible
 * à l’arrêt sur image, soit figuré (lignes de mots) : jamais un faux texte inventé.
 */

type Point = [number, number];

/** Une page de vrai texte : un titre courant en capitales, des paragraphes, un ornement final facultatif. */
export type TextePage = { titre?: string; paragraphes: string[]; ornement?: boolean };

export type PageDeLivreProps = {
  /** Position du dos (x) et du haut de la page, en px, dans le repère du parent. */
  dos: number;
  haut: number;
  /** Largeur et hauteur d’une page. */
  largeur: number;
  hauteur: number;
  /** Avancement du tour de page, 0 (à plat) à 1 (tournée). Le parent choisit la courbe. */
  progression: number;
  /** Vrais textes des deux pages (la page qui se tourne, puis la page découverte). Absents : texte figuré. */
  textes?: [TextePage, TextePage];
  /** Graines des deux pages (texte figuré différent sur chacune). */
  graines?: [number, number];
  /** Lettrine en tête de la page découverte (une seule lettre, en Young Serif). */
  lettrine?: string;
  /**
   * Couleur du papier, pour faire apparaître ou disparaître le livre sur l’indigo par
   * un passage de couleur en OKLCH (jamais par transparence : le mélange RVB du papier
   * et de l’indigo donne un gris terne). Par défaut, l’ivoire.
   */
  papier?: string;
  /** Opacité du texte des pages (il sort avant que le papier ne change de couleur). */
  opaciteTexte?: number;
  /** 0–1 : ombres et reliefs du livre (nuls quand le papier se confond avec la table). */
  presence?: number;
  /** Faux : seule la page de droite est posée (image fixe où la page de gauche gênerait). */
  pageGauche?: boolean;
  /** Taille du cadre du parent, pour le dessin SVG. */
  cadre: { largeur: number; hauteur: number };
};

/** Générateur pseudo-aléatoire à graine fixe : le même dessin à chaque image. */
const aleatoire = (graine: number) => {
  let a = graine * 9301 + 49297;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
};

const MARGES = { haut: 0.11, bas: 0.12, dos: 0.1, exterieur: 0.12 };
const ENCRE = "rgba(31, 42, 85, 0.30)";

/** Lignes de texte figuré, mot par mot, justifiées, avec des paragraphes. */
const texteFigure = (x: number, y: number, l: number, h: number, graine: number, retraitLettrine: number) => {
  const r = aleatoire(graine);
  const pas = Math.max(30, l * 0.046);
  const epaisseur = pas * 0.34;
  const lignes = Math.floor(h / pas);
  const mots: React.ReactNode[] = [];
  let restantParagraphe = 4 + Math.floor(r() * 5);
  let debutParagraphe = retraitLettrine === 0;
  for (let i = 0; i < lignes; i++) {
    const yLigne = y + i * pas;
    const enLettrine = i < 3 && retraitLettrine > 0;
    const retrait = enLettrine ? retraitLettrine : debutParagraphe ? l * 0.07 : 0;
    const finParagraphe = restantParagraphe === 0;
    const longueur = finParagraphe ? l * (0.3 + r() * 0.4) : l - retrait;
    // Des mots de longueur variable, puis on justifie.
    const tailles: number[] = [];
    let total = 0;
    while (total < longueur) {
      const m = l * (0.04 + r() * 0.12);
      tailles.push(m);
      total += m + l * 0.018;
    }
    const espace = l * 0.018;
    const echelle = (longueur - espace * (tailles.length - 1)) / tailles.reduce((a, b) => a + b, 0);
    let xMot = x + retrait;
    tailles.forEach((m, j) => {
      const w = m * echelle;
      mots.push(<rect key={`${i}-${j}`} x={xMot} y={yLigne} width={w} height={epaisseur} rx={epaisseur / 2} fill={ENCRE} />);
      xMot += w + espace;
    });
    debutParagraphe = finParagraphe;
    restantParagraphe = finParagraphe ? 4 + Math.floor(r() * 6) : restantParagraphe - 1;
  }
  return mots;
};

/**
 * Un vrai texte, composé comme l’ouverture d’un chapitre : titre courant en capitales
 * espacées en haut, texte en Young Serif qui commence au tiers de la page, justifié,
 * avec une longueur de ligne de livre. Deux tailles de texte seulement.
 */
const VraiTexte: React.FC<{ x: number; y: number; l: number; h: number; texte: TextePage }> = ({ x, y, l, h, texte }) => {
  const corps = l * 0.047;
  const gauche = x + l * 0.13;
  const largeur = l * 0.72;
  return (
    <>
      {texte.titre ? (
        <foreignObject x={gauche} y={y + h * 0.075} width={largeur} height={corps * 2}>
          <div
            style={{
              fontFamily: polices.texte,
              fontWeight: 700,
              fontSize: l * 0.024,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: couleurs.terracottaFonce,
            }}
          >
            {texte.titre}
          </div>
        </foreignObject>
      ) : null}
      <foreignObject x={gauche} y={y + h * 0.29} width={largeur} height={h * 0.62}>
        <div
          lang="fr"
          style={{
            fontFamily: polices.titre,
            fontSize: corps,
            lineHeight: 1.5,
            color: couleurs.indigo,
            textAlign: "left",
          }}
        >
          {texte.paragraphes.map((p, i) => (
            <p key={i} style={{ margin: 0, textIndent: i === 0 ? 0 : corps * 1.4 }}>
              {p}
            </p>
          ))}
          {texte.ornement ? (
            // Ornement de fin de chapitre : trois places des gradins, en arc.
            <svg viewBox="-30 -16 60 24" style={{ display: "block", width: corps * 2.2, margin: `${corps * 1.2}px auto 0` }}>
              {[-24, 0, 24].map((a) => (
                <g key={a} transform={`rotate(${a} 0 40)`}>
                  <rect x={-5.5} y={-6} width={11} height={9} rx={1.6} fill={couleurs.terracotta} />
                </g>
              ))}
            </svg>
          ) : null}
        </div>
      </foreignObject>
    </>
  );
};

/** Contenu d’une page de droite : papier, ombre du dos, texte (vrai ou figuré). */
type ProprietesContenu = {
  x: number;
  y: number;
  l: number;
  h: number;
  graine: number;
  lettrine?: string;
  texte?: TextePage;
  id: string;
  papier: string;
  opaciteTexte: number;
  presence: number;
};

const ContenuPage: React.FC<ProprietesContenu> = ({
  x,
  y,
  l,
  h,
  graine,
  lettrine,
  texte,
  id,
  papier,
  opaciteTexte,
  presence,
}) => {
  const tx = x + l * MARGES.dos;
  const ty = y + h * MARGES.haut;
  const tl = l * (1 - MARGES.dos - MARGES.exterieur);
  const th = h * (1 - MARGES.haut - MARGES.bas);
  const pas = Math.max(30, tl * 0.046);
  const tailleLettrine = pas * 3.1;
  return (
    <g>
      <rect x={x} y={y} width={l} height={h} fill={papier} />
      <rect x={x} y={y} width={l * 0.12} height={h} fill={`url(#${id}-dos)`} opacity={presence} />
      {opaciteTexte > 0 ? (
        <g opacity={opaciteTexte}>
          {texte ? <VraiTexte x={x} y={y} l={l} h={h} texte={texte} /> : null}
          {!texte && lettrine ? (
            <text x={tx} y={ty + pas * 2 + pas * 0.34} fontFamily={polices.titre} fontSize={tailleLettrine} fill={couleurs.terracotta}>
              {lettrine}
            </text>
          ) : null}
          {texte ? null : texteFigure(tx, ty, tl, th, graine, lettrine ? tailleLettrine * 0.86 : 0)}
        </g>
      ) : null}
    </g>
  );
};

/** Coupe un polygone par la droite du pli : garde le côté où f(P) ≤ 0 (ou ≥ 0). */
const couper = (poly: Point[], f: (p: Point) => number, garderNegatif: boolean): Point[] => {
  const s = (p: Point) => (garderNegatif ? f(p) : -f(p));
  const res: Point[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const fp = s(p);
    const fq = s(q);
    if (fp <= 0) res.push(p);
    if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
      const t = fp / (fp - fq);
      res.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  });
  return res;
};

const enPoints = (poly: Point[]) => poly.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

export const PageDeLivre: React.FC<PageDeLivreProps> = ({
  dos,
  haut,
  largeur: l,
  hauteur: h,
  progression,
  graines = [3, 8],
  textes,
  lettrine,
  pageGauche = true,
  papier = couleurs.ivoire,
  opaciteTexte = 1,
  presence = 1,
  cadre,
}) => {
  const q = Math.min(1, Math.max(0, progression));
  const commun = { papier, opaciteTexte, presence };
  const id = `page-${graines[0]}-${graines[1]}`;
  // Le pli : il part du bord extérieur et traverse jusqu’au dos ; incliné en cours de route
  // (le coin bas se soulève le premier), droit au départ et à l’arrivée.
  const base = dos + l * (1 - q);
  const inclinaison = l * 0.32 * Math.sin(Math.PI * q);
  const A: Point = [base + inclinaison, haut];
  const B: Point = [base - inclinaison, haut + h];
  const f = (p: Point) => p[0] - A[0] - ((B[0] - A[0]) * (p[1] - A[1])) / h;

  const page: Point[] = [
    [dos, haut],
    [dos + l, haut],
    [dos + l, haut + h],
    [dos, haut + h],
  ];
  const gardee = q <= 0 ? page : couper(page, f, true);
  const soulevee = q <= 0 ? [] : couper(page, f, false);

  // Reflet de la partie soulevée par rapport au pli : le revers de la page.
  const dx = B[0] - A[0];
  const dy = B[1] - A[1];
  const n = Math.hypot(dx, dy);
  const ux = dx / n;
  const uy = dy / n;
  const reflet = soulevee.map(([x, y]): Point => {
    const vx = x - A[0];
    const vy = y - A[1];
    const d = vx * ux + vy * uy;
    return [A[0] + 2 * d * ux - vx, A[1] + 2 * d * uy - vy];
  });

  // Ombres : le revers soulevé projette une ombre douce (lumière en haut à gauche) ;
  // le creux du pli assombrit légèrement la page découverte. Les deux s’éteignent à plat.
  const soulevement = Math.sin(Math.PI * q);
  const normale: Point = [uy, -ux]; // vers la droite du pli (page découverte)
  const milieu: Point = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];

  return (
    <svg width={cadre.largeur} height={cadre.hauteur} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={`${id}-dos`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="rgba(15, 20, 45, 0.16)" />
          <stop offset="1" stopColor="rgba(15, 20, 45, 0)" />
        </linearGradient>
        <linearGradient id={`${id}-gauche`} x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="rgba(15, 20, 45, 0.18)" />
          <stop offset="0.12" stopColor="rgba(15, 20, 45, 0)" />
        </linearGradient>
        <linearGradient
          id={`${id}-creux`}
          gradientUnits="userSpaceOnUse"
          x1={milieu[0]}
          y1={milieu[1]}
          x2={milieu[0] + normale[0] * l * 0.16}
          y2={milieu[1] + normale[1] * l * 0.16}
        >
          <stop offset="0" stopColor={`rgba(15, 20, 45, ${(0.2 * soulevement).toFixed(3)})`} />
          <stop offset="1" stopColor="rgba(15, 20, 45, 0)" />
        </linearGradient>
        <linearGradient
          id={`${id}-revers`}
          gradientUnits="userSpaceOnUse"
          x1={milieu[0]}
          y1={milieu[1]}
          x2={milieu[0] - normale[0] * l * 0.5}
          y2={milieu[1] - normale[1] * l * 0.5}
        >
          <stop offset="0" stopColor={`rgba(255, 255, 255, ${(0.5 * soulevement).toFixed(3)})`} />
          <stop offset="0.35" stopColor="rgba(255, 255, 255, 0)" />
          <stop offset="1" stopColor={`rgba(15, 20, 45, ${(0.07 * soulevement).toFixed(3)})`} />
        </linearGradient>
        <filter id={`${id}-ombre-livre`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx={lumiere.x * 18} dy={lumiere.y * 18} stdDeviation={22} floodColor="rgb(10, 14, 32)" floodOpacity={0.45 * presence} />
        </filter>
        <filter id={`${id}-ombre-revers`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx={lumiere.x * 30 * soulevement}
            dy={lumiere.y * 30 * soulevement}
            stdDeviation={6 + 26 * soulevement}
            floodColor="rgb(15, 20, 45)"
            floodOpacity={0.28 * soulevement * presence}
          />
        </filter>
        {/* Le revers reste dans la hauteur du livre : une page tenue par le dos ne dépasse pas ses tranches. */}
        <clipPath id={`${id}-bande`}>
          <rect x={-cadre.largeur} y={haut} width={cadre.largeur * 3} height={h} />
        </clipPath>
        <clipPath id={`${id}-gardee`}>
          <polygon points={enPoints(gardee)} />
        </clipPath>
        <clipPath id={`${id}-decouverte`}>
          <polygon points={enPoints(soulevee)} />
        </clipPath>
      </defs>

      {/* Le livre ouvert : la page de gauche (sa marge intérieure seulement est dans le cadre) et l’ombre du livre. */}
      <g filter={`url(#${id}-ombre-livre)`}>
        <rect x={pageGauche ? dos - l : dos} y={haut} width={pageGauche ? l * 2 : l} height={h} fill={papier} />
      </g>
      {pageGauche ? <rect x={dos - l} y={haut} width={l} height={h} fill={`url(#${id}-gauche)`} opacity={presence} /> : null}

      {/* La page découverte, sous la page qui se tourne. */}
      {soulevee.length > 2 ? (
        <g clipPath={`url(#${id}-decouverte)`}>
          <ContenuPage x={dos} y={haut} l={l} h={h} graine={graines[1]} lettrine={lettrine} texte={textes?.[1]} id={`${id}-b`} {...commun} />
          <polygon points={enPoints(soulevee)} fill={`url(#${id}-creux)`} opacity={presence} />
        </g>
      ) : null}

      {/* La page qui se tourne, découpée le long du pli. */}
      {gardee.length > 2 ? (
        <g clipPath={`url(#${id}-gardee)`}>
          <ContenuPage x={dos} y={haut} l={l} h={h} graine={graines[0]} texte={textes?.[0]} id={`${id}-a`} {...commun} />
        </g>
      ) : null}

      {/* Le revers, rabattu de l’autre côté du pli. */}
      {reflet.length > 2 ? (
        <g clipPath={`url(#${id}-bande)`}>
          <g filter={`url(#${id}-ombre-revers)`}>
            <polygon points={enPoints(reflet)} fill={papier} />
            <polygon points={enPoints(reflet)} fill={`url(#${id}-revers)`} opacity={presence} />
          </g>
        </g>
      ) : null}
    </svg>
  );
};

import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import logoHorizontal from "../../public/logos/logo-horizontal.svg";
import logoHorizontalInverse from "../../public/logos/logo-horizontal-inverse.svg";
import {
  FondIndigo,
  FondPapier,
  Reglette,
  TexteCinetique,
  Tuile,
  TuileEnMigration,
  courbes,
  couleurs,
  durees,
  placeSurReglette,
  polices,
  valeurLettre,
} from "../src/kit";
import { defis, placesDansLeMot, type Defi } from "./contenus";

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const W = 1080;
const TAILLE = 112;
const RANGEE_Y = 820;

/** Deux tailles de texte par écran : les titres (Young Serif 96) et les étiquettes (Work Sans 34). */
const PETIT = 34;
const GRAND = 96;

const apparition = (frame: number, debut: number, duree: number = durees.transition) =>
  interpolate(frame, [debut, debut + duree], [0, 1], { ...borne, easing: courbes.entree });

const Etiquette: React.FC<{ texte: string; top: number; couleur: string; debut: number; capitales?: boolean }> = ({
  texte,
  top,
  couleur,
  debut,
  capitales = false,
}) => {
  const frame = useCurrentFrame();
  const p = apparition(frame, debut);
  return (
    <div
      style={{
        position: "absolute",
        left: 80,
        right: 80,
        top,
        textAlign: "center",
        fontFamily: polices.texte,
        fontWeight: capitales ? 700 : 500,
        fontSize: PETIT,
        letterSpacing: capitales ? "0.16em" : undefined,
        textTransform: capitales ? "uppercase" : undefined,
        color: couleur,
        opacity: p,
        transform: `translateY(${(1 - p) * 10}px)`,
      }}
    >
      {texte}
    </div>
  );
};

const Signature: React.FC<{ debut: number; inverse: boolean; top: number }> = ({ debut, inverse, top }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [debut, debut + durees.transitionLongue], [0, 1], { ...borne, easing: courbes.fondu });
  const largeur = 400;
  if (o <= 0) return null;
  return (
    <Img
      src={inverse ? logoHorizontalInverse : logoHorizontal}
      style={{ position: "absolute", left: (W - largeur) / 2, top, width: largeur, height: (largeur * 180) / 496, opacity: o }}
    />
  );
};

const departTirage = (i: number) => ({ x: (i % 2 === 0 ? -1 : 1) * TAILLE * 0.25, y: -TAILLE * 2.2, rotation: i % 2 === 0 ? -8 : 8 });

// ─── Le défi ──────────────────────────────────────────────────────────────────

/**
 * Défi (vertical, 15 s), sur l’indigo des Tournois de Scrabble :
 * titre, tirage de 7 tuiles sur le chevalet, compte à rebours de 5 s en tuiles,
 * puis « Réponds en commentaire » et la signature. Le tirage reste jusqu’à la fin (vignette).
 */
export const minutageDefi = {
  surtitre: 6,
  titre: 12,
  reglette: 40,
  tuiles: 48,
  consigne: 100,
  rebours: 132,
  fin_rebours: 282,
  appel: 288,
  suite: 336,
  signature: 366,
  fin: 450,
} as const;

/** Un chiffre du compte à rebours : une grande tuile qui tombe, tient, puis se soulève et s’efface. */
const TuileRebours: React.FC<{ chiffre: number; debut: number }> = ({ chiffre, debut }) => {
  const frame = useCurrentFrame();
  if (frame < debut || frame >= debut + 30) return null;
  const sortie = interpolate(frame, [debut + 23, debut + 30], [0, 1], { ...borne, easing: courbes.sortie });
  return (
    <div style={{ position: "absolute", left: W / 2, top: 1230, opacity: 1 - sortie, transform: `translateY(${-sortie * 40}px)` }}>
      <Tuile lettre={String(chiffre)} valeur={null} taille={230} variante="terracotta" debut={debut} vol={8} depart={{ x: 0, y: -120, rotation: chiffre % 2 ? -5 : 5 }} />
    </div>
  );
};

export const DefiScrabble: React.FC<{ numero: number }> = ({ numero }) => {
  const frame = useCurrentFrame();
  const d = defis[numero - 1]!;
  const t = minutageDefi;
  // La consigne s’efface quand l’appel arrive : jamais plus de deux tailles ni trop de lignes à la fois.
  const finConsigne = interpolate(frame, [t.fin_rebours, t.fin_rebours + durees.transitionCourte], [1, 0], { ...borne, easing: courbes.sortie });
  return (
    <AbsoluteFill>
      <FondIndigo />
      <Etiquette texte={`Défi Scrabble · ${d.numero}/3`} top={300} couleur={couleurs.terracottaClair} debut={t.surtitre} capitales />
      <div style={{ position: "absolute", left: 0, right: 0, top: 370 }}>
        <TexteCinetique lignes={["Quel est le", "meilleur mot ?"]} mode="ligne" debut={t.titre} reste taille={GRAND} interligne={1.04} alignement="center" couleur={couleurs.ivoire} />
      </div>
      <Reglette cx={W / 2} cy={RANGEE_Y} taille={TAILLE} debut={t.reglette} />
      {[...d.tirage].map((lettre, i) => (
        <div key={i} style={{ position: "absolute", left: placeSurReglette(i, { cx: W / 2, taille: TAILLE }), top: RANGEE_Y }}>
          <Tuile lettre={lettre} taille={TAILLE} variante="ivoire" debut={t.tuiles + i * 6} depart={departTirage(i)} />
        </div>
      ))}
      <div style={{ opacity: finConsigne }}>
        <Etiquette texte="Les 7 tuiles · leur valeur seule, sans plateau" top={960} couleur="rgba(247, 244, 237, 0.78)" debut={t.consigne} />
      </div>
      {[5, 4, 3, 2, 1].map((c, k) => (
        <TuileRebours key={c} chiffre={c} debut={t.rebours + k * 30} />
      ))}
      <div style={{ position: "absolute", left: 0, right: 0, top: 1080 }}>
        <TexteCinetique lignes={["Réponds", "en commentaire"]} debut={t.appel} reste taille={GRAND} interligne={1.04} alignement="center" couleur={couleurs.ivoire} accent={{ mots: ["Réponds"], couleur: couleurs.terracottaClair }} />
      </div>
      <Etiquette texte="La réponse dans la prochaine vidéo" top={1310} couleur="rgba(247, 244, 237, 0.78)" debut={t.suite} />
      <Signature debut={t.signature} inverse top={1420} />
    </AbsoluteFill>
  );
};

// ─── La réponse ───────────────────────────────────────────────────────────────

/**
 * Réponse (vertical, 13 s), sur le papier : le même tirage se pose, les tuiles se
 * déplacent une à une pour former le mot, puis on compte les points tuile par tuile.
 */
export const minutageReponse = {
  surtitre: 6,
  titre: 12,
  reglette: 30,
  tuiles: 36,
  rangement: 96,
  intervalleRangement: 6,
  compte: 186,
  intervalleCompte: 9,
  prime: 270,
  signature: 300,
  fin: 390,
} as const;

export const ReponseScrabble: React.FC<{ numero: number }> = ({ numero }) => {
  const frame = useCurrentFrame();
  const d: Defi = defis[numero - 1]!;
  const t = minutageReponse;
  const places = placesDansLeMot(d);
  const x = (i: number) => placeSurReglette(i, { cx: W / 2, taille: TAILLE });
  // Points comptés : la tuile du rang k du mot passe en terracotta et ajoute sa valeur.
  const comptees = [...d.mot].filter((_, k) => frame >= t.compte + k * t.intervalleCompte).length;
  const total = [...d.mot].slice(0, comptees).reduce((s, l) => s + (valeurLettre(l) ?? 0), 0);
  const pTotal = apparition(frame, t.compte, durees.transitionCourte);
  return (
    <AbsoluteFill>
      <FondPapier />
      <Etiquette texte={`Défi Scrabble · ${d.numero}/3 · la réponse`} top={300} couleur={couleurs.terracottaFonce} debut={t.surtitre} capitales />
      <div style={{ position: "absolute", left: 0, right: 0, top: 370 }}>
        <TexteCinetique lignes={["Le meilleur mot"]} mode="ligne" debut={t.titre} reste taille={GRAND} interligne={1.04} alignement="center" couleur={couleurs.indigo} />
      </div>
      <Reglette cx={W / 2} cy={RANGEE_Y} taille={TAILLE} debut={t.reglette} />
      {[...d.tirage].map((lettre, i) => {
        const debutRangement = t.rangement + places[i]! * t.intervalleRangement;
        const k = places[i]!;
        // Compter une tuile : elle fait un petit saut (soulevée puis reposée, avec son ombre).
        // Pas de changement de couleur : indigo → terracotta passerait par un violet.
        const tau = frame - (t.compte + k * t.intervalleCompte);
        const saut = tau >= 0 && tau < 12 ? 0.32 * Math.sin((Math.PI * tau) / 12) : 0;
        if (frame < debutRangement) {
          return (
            <div key={i} style={{ position: "absolute", left: x(i), top: RANGEE_Y }}>
              <Tuile lettre={lettre} taille={TAILLE} variante="indigo" debut={t.tuiles + i * 4} depart={departTirage(i)} />
            </div>
          );
        }
        if (frame < t.compte) {
          return (
            <div key={i} style={{ position: "absolute", inset: 0, zIndex: frame >= debutRangement && frame < debutRangement + 24 ? 2 : 1 }}>
            <TuileEnMigration
              depuis={{ x: x(i), y: RANGEE_Y, taille: TAILLE, variante: "indigo", lettre }}
              vers={{ x: x(k), y: RANGEE_Y, taille: TAILLE, variante: "indigo", lettre }}
              debut={debutRangement}
              duree={24}
              levee={0.5}
            />
            </div>
          );
        }
        return (
          <div key={i} style={{ position: "absolute", left: x(k), top: RANGEE_Y }}>
            <Tuile lettre={lettre} taille={TAILLE} variante="indigo" hauteur={saut} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1010,
          textAlign: "center",
          fontFamily: polices.titre,
          fontSize: GRAND,
          color: couleurs.indigo,
          opacity: pTotal,
          transform: `translateY(${(1 - pTotal) * 20}px)`,
        }}
      >
        <span style={{ color: couleurs.terracotta, fontVariantNumeric: "tabular-nums" }}>{total}</span> {total > 1 ? "points" : "point"}
      </div>
      <Etiquette texte="Sans case de couleur. En partie, poser les 7 tuiles rapporte en plus 50 points de prime." top={1170} couleur={couleurs.gris} debut={t.prime} />
      <Signature debut={t.signature} inverse={false} top={1420} />
    </AbsoluteFill>
  );
};

import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FondIndigo, Tuile, TuileEnMigration, courbes, type EtatTuile } from "../src/kit";
import { TAILLE_TUILE, W, Y_RANGEE, xRangee } from "./minutage";
import { GrilleDuPlateau, LIRE, Livre, PAS, SAVOIR, TUILE_PLATEAU, glissementLivre, type Pose } from "./Scenes";

/**
 * Version 100 % animée, de 2,6 s à 10,53 s : un seul plan continu sur la même table.
 *
 * 1. LIRE se pose sur le plateau.
 * 2. Le livre ouvert glisse dans le cadre par le bas, déjà ivoire et opaque ; la page se tourne ;
 *    le livre ressort par le haut. Pendant qu’il couvre le plateau, le cadre se recentre.
 * 3. SAVOIR se pose et croise LIRE sur le I.
 * 4. Quatre tuiles s’envolent hors du cadre ; les cinq autres volent jusqu’à la rangée
 *    centrale et écrivent AGORA (le V devient G, le E devient A, en vol, sur une seule tuile
 *    opaque) : jamais deux tuiles semi-transparentes l’une sur l’autre.
 *
 * Images relatives au début du plan (image 78 de la vidéo). Le plan s’arrête quand les
 * tuiles d’AGORA repartent vers l’hémicycle (image 316) : la finale prend le relais.
 */
export const temps = {
  lire: 6,
  intervalleLire: 5,
  livreEntree: 48,
  tour: 72,
  dureeTour: 24,
  livreSortie: 104,
  dureeGlissement: 18,
  /** Le plateau se recentre pendant que le livre le couvre entièrement. */
  recadrage: [74, 98] as const,
  savoir: 120,
  intervalleSavoir: 3,
  envol: 150,
  agora: 152,
  decalageAgora: 3,
  dureeAgora: 24,
  /** Fin du plan : les tuiles d’AGORA partent vers l’hémicycle (finale, image 106). */
  fin: 316 - 78,
} as const;

const borne = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OX = W / 2 - 0.5 * PAS;
const OY_LIRE = 930;
const OY_CROIX = 930 + 1.5 * PAS;

/** Les cinq tuiles qui deviennent AGORA (index dans le mot) et les quatre qui s’envolent. */
type Role = { agora: number; lettre: string } | { envol: { x: number; y: number; rotation: number } };
const role = (p: Pose, mot: "LIRE" | "SAVOIR"): Role => {
  if (mot === "LIRE") {
    if (p.lettre === "R") return { agora: 3, lettre: "R" };
    if (p.lettre === "E") return { agora: 4, lettre: "A" };
    if (p.lettre === "L") return { envol: { x: -220, y: 1450, rotation: -24 } };
    return { envol: { x: 380, y: 2180, rotation: 18 } }; // I
  }
  if (p.lettre === "A") return { agora: 0, lettre: "A" };
  if (p.lettre === "V") return { agora: 1, lettre: "G" };
  if (p.lettre === "O") return { agora: 2, lettre: "O" };
  if (p.lettre === "S") return { envol: { x: 260, y: -260, rotation: -20 } };
  return { envol: { x: 700, y: 2180, rotation: 22 } }; // R de SAVOIR
};

export const TableAnimee: React.FC = () => {
  const frame = useCurrentFrame();
  const t = temps;
  const oy = interpolate(frame, [...t.recadrage], [OY_LIRE, OY_CROIX], { ...borne, easing: courbes.deplacement });
  const grille = Math.min(
    interpolate(frame, [t.livreEntree + 6, t.livreEntree + 18], [1, 0], { ...borne, easing: courbes.fondu }) +
      interpolate(frame, [t.livreSortie, t.livreSortie + 14], [0, 1], { ...borne, easing: courbes.fondu }),
    interpolate(frame, [t.envol + 4, t.envol + 24], [1, 0], { ...borne, easing: courbes.fondu }),
  );
  const progression = interpolate(frame, [t.tour, t.tour + t.dureeTour], [0, 1], { ...borne, easing: courbes.deplacement });

  const tuiles = [
    ...LIRE.map((p) => ({ p, mot: "LIRE" as const, pose: t.lire + p.ordre * t.intervalleLire })),
    ...SAVOIR.map((p) => ({ p, mot: "SAVOIR" as const, pose: t.savoir + p.ordre * t.intervalleSavoir })),
  ];

  type Dessin = { plan: number; k: number; element: React.ReactNode };
  const dessin = tuiles.flatMap(({ p, mot, pose }, k): Dessin[] => {
    const x = OX + p.col * PAS;
    const y = oy + p.ligne * PAS;
    const r = role(p, mot);
    const depuis: EtatTuile = { x, y, taille: TUILE_PLATEAU, variante: "ivoire", lettre: p.lettre };
    const depart = "agora" in r ? t.agora + r.agora * t.decalageAgora : t.envol + (k % 4) * 3;
    // SAVOIR n’est pas encore là pendant le passage du livre.
    if (mot === "SAVOIR" && frame < pose) return [];
    let element: React.ReactNode;
    if (frame < depart) {
      element = (
        <div style={{ position: "absolute", left: x, top: y }}>
          <Tuile
            lettre={p.lettre}
            taille={TUILE_PLATEAU}
            variante="ivoire"
            debut={pose}
            depart={{ x: (p.ordre % 2 === 0 ? -1 : 1) * 40, y: -TUILE_PLATEAU * 1.6, rotation: p.ordre % 2 === 0 ? -8 : 8 }}
          />
        </div>
      );
    } else {
      const vers: EtatTuile =
        "agora" in r
          ? { x: xRangee(r.agora), y: Y_RANGEE, taille: TAILLE_TUILE, variante: "ivoire", lettre: r.lettre }
          : { x: r.envol.x, y: r.envol.y, taille: TUILE_PLATEAU * 1.1, rotation: r.envol.rotation, variante: "ivoire", lettre: p.lettre };
      element = (
        <TuileEnMigration depuis={depuis} vers={vers} debut={depart} duree={"agora" in r ? t.dureeAgora : 20} levee={"agora" in r ? 0.35 : 0.6} />
      );
    }
    // Ordre de dessin : les tuiles posées, puis celles qui s’envolent, puis celles d’AGORA.
    const plan = frame < depart ? 0 : "agora" in r ? 2 : 1;
    return [{ plan, k, element }];
  });

  return (
    <FondIndigo>
      <GrilleDuPlateau ox={OX} oy={oy} opacite={grille} />
      {dessin
        .sort((a, b) => a.plan - b.plan || a.k - b.k)
        .map((d) => (
          <React.Fragment key={d.k}>{d.element}</React.Fragment>
        ))}
      <Livre glissement={glissementLivre(frame, t.livreEntree, t.livreSortie, t.dureeGlissement)} progression={progression} />
    </FondIndigo>
  );
};

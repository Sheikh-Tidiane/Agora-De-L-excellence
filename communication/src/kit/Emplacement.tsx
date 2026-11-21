import React from "react";
import { AbsoluteFill, Img, OffthreadVideo, getStaticFiles, staticFile } from "remotion";
import { couleurs, polices } from "./tokens";

const VIDEO = /\.(mp4|mov|webm)$/i;

export type EmplacementProps = {
  /** Ce qu’il faut filmer, en clair : « mains qui posent des tuiles sur un plateau ». */
  libelle: string;
  /**
   * Nom du fichier attendu dans assets/plans/ (vidéo ou photo). S’il y est,
   * il remplace automatiquement le cadre d’attente.
   */
  fichier?: string;
  /** Début du plan à utiliser dans le fichier, en images. */
  debutDansLePlan?: number;
  /** Sur fond indigo (cadre ivoire) ou ivoire (cadre indigo). */
  surFondSombre?: boolean;
  style?: React.CSSProperties;
};

/** Le plan filmé est-il déposé ? */
export const planDisponible = (fichier?: string) =>
  Boolean(fichier) && getStaticFiles().some((f) => f.name === `plans/${fichier}`);

/**
 * Cadre réservé à un plan filmé par l’utilisateur. Tant que le fichier n’est pas
 * déposé dans assets/plans/, il affiche honnêtement « Plan à filmer : … ».
 */
export const Emplacement: React.FC<EmplacementProps> = ({
  libelle,
  fichier,
  debutDansLePlan = 0,
  surFondSombre = false,
  style,
}) => {
  if (fichier && planDisponible(fichier)) {
    const src = staticFile(`plans/${fichier}`);
    return (
      <AbsoluteFill style={{ overflow: "hidden", ...style }}>
        {VIDEO.test(fichier) ? (
          <OffthreadVideo src={src} startFrom={debutDansLePlan} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        )}
      </AbsoluteFill>
    );
  }

  const encre = surFondSombre ? couleurs.ivoire : couleurs.indigo;
  const coin = (pos: React.CSSProperties, bords: React.CSSProperties) => (
    <div style={{ position: "absolute", width: 56, height: 56, borderColor: encre, borderStyle: "solid", borderWidth: 0, ...pos, ...bords }} />
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: surFondSombre ? "rgba(247, 244, 237, 0.06)" : "rgba(31, 42, 85, 0.05)",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {coin({ top: 28, left: 28 }, { borderTopWidth: 3, borderLeftWidth: 3 })}
      {coin({ top: 28, right: 28 }, { borderTopWidth: 3, borderRightWidth: 3 })}
      {coin({ bottom: 28, left: 28 }, { borderBottomWidth: 3, borderLeftWidth: 3 })}
      {coin({ bottom: 28, right: 28 }, { borderBottomWidth: 3, borderRightWidth: 3 })}
      <div style={{ maxWidth: "72%", textAlign: "center", color: encre, fontFamily: polices.texte }}>
        <div style={{ fontWeight: 700, fontSize: 30, letterSpacing: "0.18em", textTransform: "uppercase", color: surFondSombre ? couleurs.terracottaClair : couleurs.terracottaFonce }}>
          Plan à filmer
        </div>
        <div style={{ marginTop: 18, fontWeight: 500, fontSize: 44, lineHeight: 1.25 }}>{libelle}</div>
        {fichier ? (
          <div style={{ marginTop: 22, fontWeight: 400, fontSize: 30, opacity: 0.75 }}>assets/plans/{fichier}</div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

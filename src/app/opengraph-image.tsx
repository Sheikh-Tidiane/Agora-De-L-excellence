import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";

/**
 * Image de partage (Open Graph) de tout le site : le logo vertical fourni, tel quel, sur fond indigo.
 * Le texte du logo est vectorisé : aucune police à charger, et le logo n'est ni redessiné ni recoloré.
 */
export const alt = site.name;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Lu une fois au chargement du module : le fichier ne dépend pas de la requête.
const logo = await readFile(
  path.join(process.cwd(), "public", "logos", "logo-vertical-inverse.svg"),
  "base64",
);

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: site.themeColor,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendu par next/og, pas par le navigateur */}
      <img src={`data:image/svg+xml;base64,${logo}`} width={474} height={460} alt="" />
    </div>,
    size,
  );
}

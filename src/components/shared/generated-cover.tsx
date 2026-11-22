import { cn, hashString } from "@/lib/utils";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";

/**
 * Couverture typographique générée à partir du titre, de l'auteur et de la catégorie.
 * Remplace les vraies couvertures tant que l'admin n'en a pas téléversé.
 * La variation est déterministe : un même livre a toujours la même couverture.
 */

type Palette = {
  fond: string;
  titre: string;
  auteur: string;
  accent: string;
  discret: string;
  /** Gabarit « bandeau » : fond du bandeau et couleur du nom d'auteur (contraste AA vérifié). */
  bandeau: string;
  surBandeau: string;
};

const palettes: Palette[] = [
  // Indigo de nuit
  {
    fond: "var(--color-indigo)",
    titre: "var(--color-ivoire)",
    auteur: "var(--color-terracotta-clair)",
    accent: "var(--color-terracotta-clair)",
    discret: "rgb(247 244 237 / 0.14)",
    bandeau: "var(--color-terracotta-clair)",
    surBandeau: "var(--color-indigo)",
  },
  // Latérite
  {
    fond: "var(--color-terracotta-fonce)",
    titre: "var(--color-blanc)",
    auteur: "var(--color-blanc)",
    accent: "var(--color-indigo)",
    discret: "rgb(31 42 85 / 0.18)",
    // Terracotta foncé sur indigo ne fait que 2,4:1 : le nom passe en terracotta clair (5,2:1).
    bandeau: "var(--color-indigo)",
    surBandeau: "var(--color-terracotta-clair)",
  },
  // Papier
  {
    fond: "var(--color-blanc)",
    titre: "var(--color-indigo)",
    auteur: "var(--color-terracotta-fonce)",
    accent: "var(--color-terracotta)",
    discret: "var(--color-trait)",
    // Blanc sur terracotta ne fait que 4,1:1 en petit corps : bandeau en terracotta foncé.
    bandeau: "var(--color-terracotta-fonce)",
    surBandeau: "var(--color-blanc)",
  },
  // Sable
  {
    fond: "var(--color-sable)",
    titre: "var(--color-indigo)",
    auteur: "var(--color-terracotta-fonce)",
    accent: "var(--color-indigo)",
    discret: "rgb(31 42 85 / 0.12)",
    bandeau: "var(--color-indigo)",
    surBandeau: "var(--color-sable)",
  },
  // Terre claire
  {
    fond: "var(--color-terracotta-clair)",
    titre: "var(--color-indigo)",
    auteur: "var(--color-indigo)",
    accent: "var(--color-ivoire)",
    discret: "rgb(31 42 85 / 0.14)",
    // Terracotta clair sur ivoire est illisible en petit corps : le nom passe en indigo.
    bandeau: "var(--color-ivoire)",
    surBandeau: "var(--color-indigo)",
  },
];

const gabarits = ["cadre", "bandeau", "initiale", "gradins", "lignes"] as const;
type Gabarit = (typeof gabarits)[number];

/**
 * Cadre commun à toutes les couvertures (image téléversée ou couverture générée) : ratio fixe
 * 2:3, coins et ombre de livre. Une seule définition, pour qu'aucune couverture ne dépasse.
 */
export const coverFrame =
  "relative aspect-[2/3] w-full shrink-0 overflow-hidden rounded-couverture shadow-posee";

export type GeneratedCoverProps = {
  title: string;
  author: string;
  category?: string;
  /** Force un gabarit (utile pour le design system). */
  variant?: Gabarit;
  /** Force une palette, de 0 à 4. */
  palette?: number;
  className?: string;
};

function titleSize(title: string) {
  const longest = Math.max(...title.split(/\s+/).map((w) => w.length));
  if (title.length <= 12 && longest <= 8) return "text-[15cqw]";
  if (title.length <= 26 && longest <= 10) return "text-[12cqw]";
  if (longest <= 12) return "text-[10cqw]";
  return "text-[8.4cqw]";
}

export function coverDesign(title: string, author: string, category = "") {
  const h = hashString(`${title}|${author}`);
  const c = hashString(category);
  return {
    gabarit: gabarits[h % gabarits.length],
    // La catégorie oriente la palette, le titre la départage : une étagère reste variée.
    palette: (c + (h >>> 8)) % palettes.length,
  };
}

export function GeneratedCover({
  title,
  author,
  category,
  variant,
  palette,
  className,
}: GeneratedCoverProps) {
  const design = coverDesign(title, author, category);
  const gabarit = variant ?? design.gabarit;
  const p = palettes[(palette ?? design.palette) % palettes.length];
  const size = titleSize(title);

  const titre = (
    <span
      className={cn("block font-serif leading-[1.02] tracking-[-0.01em] hyphens-auto", size)}
      style={{ color: p.titre }}
      lang="fr"
    >
      {title}
    </span>
  );
  const auteur = (
    <span
      className="block font-sans text-[4.6cqw] leading-tight font-bold tracking-[0.12em] uppercase"
      style={{ color: p.auteur }}
    >
      {author}
    </span>
  );

  return (
    <div
      role="img"
      aria-label={`Couverture de « ${title} », ${author}`}
      className={cn("@container", coverFrame, className)}
      style={{ background: p.fond }}
    >
      {/* Mors de la reliure : un filet vertical discret, commun à tous les gabarits. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-[3.2cqw] w-px"
        style={{ background: p.discret }}
      />
      <div aria-hidden="true" className="absolute inset-0">
        {gabarit === "cadre" && (
          <div className="absolute inset-[7cqw] flex flex-col justify-between p-[6cqw]">
            <span className="absolute inset-0 border" style={{ borderColor: p.accent }} />
            {titre}
            {auteur}
          </div>
        )}

        {gabarit === "bandeau" && (
          <div className="flex h-full flex-col">
            <div className="flex-1 px-[9cqw] pt-[11cqw]">{titre}</div>
            <div className="px-[9cqw] py-[7cqw]" style={{ background: p.bandeau }}>
              <span
                className="block font-sans text-[4.6cqw] leading-tight font-bold tracking-[0.12em] uppercase"
                style={{ color: p.surBandeau }}
              >
                {author}
              </span>
            </div>
          </div>
        )}

        {gabarit === "initiale" && (
          <div className="flex h-full flex-col justify-end px-[9cqw] pb-[9cqw]">
            <span
              className="absolute -top-[14cqw] -right-[6cqw] font-serif text-[92cqw] leading-none"
              style={{ color: p.discret }}
            >
              {title
                .replace(/^(L’|L'|La |Le |Les |Une |Un )/i, "")
                .charAt(0)
                .toUpperCase()}
            </span>
            <div className="relative space-y-[5cqw]">
              {titre}
              {auteur}
            </div>
          </div>
        )}

        {gabarit === "gradins" && (
          <div className="flex h-full flex-col px-[9cqw] pt-[11cqw]">
            {auteur}
            <div className="mt-[5cqw]">{titre}</div>
            <div className="absolute inset-x-[-18cqw] -bottom-[34cqw]">
              <Hemicycle
                rows={gradins([p.accent, p.discret, p.discret], { inner: 30, step: 14 })}
                overshoot={0}
              />
            </div>
          </div>
        )}

        {gabarit === "lignes" && (
          <div className="flex h-full flex-col justify-between px-[9cqw] py-[10cqw]">
            <div className="space-y-[2.4cqw]">
              {[60, 100, 82, 100, 44].map((w, i) => (
                <span
                  key={i}
                  className="block h-[1.1cqw]"
                  style={{ width: `${w}%`, background: i === 0 ? p.accent : p.discret }}
                />
              ))}
            </div>
            <div className="space-y-[5cqw]">
              {titre}
              {auteur}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

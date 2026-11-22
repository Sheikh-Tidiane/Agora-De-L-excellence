import { cn } from "@/lib/utils";

export type HemicycleRow = {
  /** Rayon du rang, en unités du viewBox. */
  radius: number;
  /** Couleur des tuiles du rang (token CSS, ex. `var(--color-terracotta)`). */
  fill: string;
  /** Tuiles mises en avant : index → couleur. */
  accents?: Record<number, string>;
};

type HemicycleProps = {
  rows: HemicycleRow[];
  /** Taille d'une tuile (largeur le long de l'arc, hauteur vers le centre). */
  tile?: { w: number; h: number };
  /** Espace entre deux tuiles d'un même rang. */
  gap?: number;
  /** Degrés de dépassement sous le diamètre, de chaque côté (20 dans le logo). */
  overshoot?: number;
  /** Fait apparaître les rangs l'un après l'autre (CSS seul, opacité uniquement). */
  cascade?: boolean;
  className?: string;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** Géométrie d'un hémicycle : exportée pour être testée. */
export function hemicycleGeometry(
  rows: HemicycleRow[],
  tile = { w: 11, h: 9 },
  gap = 4,
  overshoot = 20,
) {
  const maxRadius = Math.max(...rows.map((r) => r.radius));
  const pad = Math.hypot(tile.w, tile.h) / 2 + 1;
  const width = 2 * (maxRadius + pad);
  const drop = Math.sin((overshoot * Math.PI) / 180) * maxRadius;
  const height = maxRadius + drop + 2 * pad;
  const cx = width / 2;
  const cy = maxRadius + pad;
  const sweep = 180 + 2 * overshoot;

  const tiles = rows.flatMap((row, rowIndex) => {
    const arcLength = (sweep * Math.PI * row.radius) / 180;
    const count = Math.max(2, Math.round(arcLength / (tile.w + gap)) + 1);
    return Array.from({ length: count }, (_, i) => {
      // 180° = extrémité gauche du diamètre, 270° = sommet de l'arc.
      const angle = 180 - overshoot + (sweep * i) / (count - 1);
      const rad = (angle * Math.PI) / 180;
      return {
        key: `${rowIndex}-${i}`,
        x: round(cx + row.radius * Math.cos(rad)),
        y: round(cy + row.radius * Math.sin(rad)),
        rotation: round(angle + 90),
        fill: row.accents?.[i] ?? row.fill,
        row: rowIndex,
      };
    });
  });

  return { width: round(width), height: round(height), cx: round(cx), cy: round(cy), tiles };
}

/**
 * Gradins vus du dessus : des rangs de tuiles en arc.
 * Motif de l'identité inspiré du logo, jamais une copie : nombre de rangs,
 * proportions et couleurs diffèrent, et l'arc est fait pour être rogné par son conteneur.
 */
export function Hemicycle({
  rows,
  tile = { w: 11, h: 9 },
  gap = 4,
  overshoot = 20,
  cascade = false,
  className,
}: HemicycleProps) {
  const g = hemicycleGeometry(rows, tile, gap, overshoot);

  return (
    <svg
      viewBox={`0 0 ${g.width} ${g.height}`}
      aria-hidden="true"
      focusable="false"
      className={cn("block h-auto w-full", className)}
    >
      {rows.map((_, rowIndex) => (
        <g
          key={rowIndex}
          className={cascade ? "gradin-cascade" : undefined}
          style={cascade ? { animationDelay: `${rowIndex * 90}ms` } : undefined}
        >
          {g.tiles
            .filter((t) => t.row === rowIndex)
            .map((t) => (
              <rect
                key={t.key}
                x={-tile.w / 2}
                y={-tile.h / 2}
                width={tile.w}
                height={tile.h}
                rx={tile.h * 0.18}
                fill={t.fill}
                transform={`translate(${t.x} ${t.y}) rotate(${t.rotation})`}
              />
            ))}
        </g>
      ))}
    </svg>
  );
}

/** Rangs régulièrement espacés, du plus proche de la scène au plus éloigné. */
export function gradins(
  fills: string[],
  { inner = 44, step = 14 }: { inner?: number; step?: number } = {},
): HemicycleRow[] {
  return fills.map((fill, i) => ({ radius: inner + i * step, fill }));
}

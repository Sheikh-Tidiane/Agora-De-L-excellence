/**
 * Graphiques sobres des statistiques : SVG rendu côté serveur, sans bibliothèque. Une seule série
 * par graphique (pas de légende : le titre la nomme), barres terracotta fines aux extrémités
 * arrondies, grille discrète, textes dans les couleurs du texte. Chaque barre a une infobulle
 * (<title>) et chaque graphique un tableau de données équivalent (lecteurs d'écran, impression).
 */

/** Graduation « ronde » au-dessus du maximum : 1, 2, 5 × 10ⁿ. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((m) => m * power >= max)!;
  return step * power;
}

/** Géométrie des colonnes (testée sans rendu). */
export function columnGeometry(
  values: readonly number[],
  box: { width: number; height: number; gap: number; maxBar: number },
) {
  const top = niceMax(Math.max(0, ...values));
  const slot = values.length ? box.width / values.length : box.width;
  const bar = Math.max(2, Math.min(box.maxBar, slot - box.gap));
  return {
    top,
    bars: values.map((value, index) => {
      const height = top > 0 ? (Math.max(0, value) / top) * box.height : 0;
      return {
        x: index * slot + (slot - bar) / 2,
        width: bar,
        y: box.height - height,
        height,
      };
    }),
  };
}

/** Rectangle à extrémité arrondie (4 px), base droite. */
function barPath(x: number, y: number, w: number, h: number, horizontal = false) {
  if (h <= 0 || w <= 0) return "";
  if (horizontal) {
    const r = Math.min(4, w / 2, h / 2);
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ChartFigure({
  id,
  title,
  description,
  columns,
  rows,
  children,
}: {
  id: string;
  title: string;
  description: string;
  columns: string[];
  rows: (string | number)[][];
  children: React.ReactNode;
}) {
  return (
    <figure className="min-w-0">
      <figcaption id={`${id}-titre`} className="font-semibold">
        {title}
      </figcaption>
      <p id={`${id}-desc`} className="petit mt-1 text-gris">
        {description}
      </p>
      <div className="mt-4">{children}</div>
      <details className="mt-3">
        <summary className="petit cursor-pointer text-gris">Données du graphique</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[0.875rem]">
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={column}
                    className={`py-1.5 pr-4 font-semibold text-gris ${index ? "text-right" : "text-left"}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-trait">
              {rows.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      className={`py-1.5 pr-4 ${index ? "text-right tabular-nums" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** Colonnes (une par mois) : valeur du plus haut mois écrite, les autres dans l'infobulle. */
export function ColumnChart({
  id,
  points,
  unit,
}: {
  id: string;
  points: { label: string; value: number; display?: string }[];
  unit: string;
}) {
  const W = 640;
  const H = 180;
  const left = 32;
  const bottom = 24;
  const top = 18;
  const { top: max, bars } = columnGeometry(
    points.map((p) => p.value),
    { width: W - left, height: H - bottom - top, gap: 6, maxBar: 24 },
  );
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);
  const every = Math.ceil(points.length / 8);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-labelledby={`${id}-titre ${id}-desc`}
      className="block h-auto text-indigo"
    >
      {(max >= 2 ? [0, 0.5, 1] : [0, 1]).map((t) => {
        const y = top + (1 - t) * (H - bottom - top);
        return (
          <g key={t}>
            <line x1={left} x2={W} y1={y} y2={y} stroke="var(--color-trait)" strokeWidth="1" />
            <text
              x={left - 6}
              y={y + 4}
              textAnchor="end"
              fontSize="11"
              fill="currentColor"
              opacity="0.7"
            >
              {Math.round(max * t)}
            </text>
          </g>
        );
      })}
      {bars.map((bar, index) => {
        const point = points[index]!;
        return (
          <g key={point.label}>
            <path
              d={barPath(left + bar.x, top + bar.y, bar.width, bar.height)}
              fill="var(--color-terracotta)"
            >
              <title>{`${point.label} : ${point.display ?? point.value} ${unit}`}</title>
            </path>
            {/* Zone de survol plus grande que la barre. */}
            <rect
              x={left + bar.x - 4}
              y={top}
              width={bar.width + 8}
              height={H - bottom - top}
              fill="transparent"
            >
              <title>{`${point.label} : ${point.display ?? point.value} ${unit}`}</title>
            </rect>
            {index === peak && point.value > 0 ? (
              <text
                x={left + bar.x + bar.width / 2}
                y={top + bar.y - 5}
                textAnchor="middle"
                fontSize="12"
                fontWeight="600"
                fill="currentColor"
              >
                {point.value}
              </text>
            ) : null}
            {index % every === 0 ? (
              <text
                x={left + bar.x + bar.width / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize="11"
                fill="currentColor"
                opacity="0.7"
              >
                {point.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Barres horizontales (une par activité), valeur au bout de chaque barre. */
export function BarList({
  id,
  items,
  unit,
}: {
  id: string;
  items: { label: string; value: number; display?: string; note?: string }[];
  unit: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul aria-labelledby={`${id}-titre ${id}-desc`} className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[12rem_1fr]"
        >
          <span className="petit truncate" title={item.label}>
            {item.label}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <svg
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              className="h-3 min-w-0 flex-1"
              aria-hidden="true"
            >
              <path
                d={barPath(
                  0,
                  0,
                  Math.max(item.value > 0 ? 1 : 0, (item.value / max) * 100),
                  12,
                  true,
                )}
                fill="var(--color-terracotta)"
              >
                <title>{`${item.label} : ${item.display ?? item.value} ${unit}`}</title>
              </path>
            </svg>
            <span className="petit w-16 shrink-0 text-right font-semibold tabular-nums">
              {item.display ?? item.value}
              {item.note ? <span className="block font-normal text-gris">{item.note}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

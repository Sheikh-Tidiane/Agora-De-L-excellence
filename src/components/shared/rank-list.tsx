import type { ReactNode } from "react";
import { LetterTile } from "@/components/shared/letter-tile";
import { cn } from "@/lib/utils";

export type RankListRow = {
  key: string;
  rank: number;
  name: string;
  isViewer: boolean;
  /** Valeur mise en avant à droite (« 8/10 », « 42 pts »). */
  value: string;
  /** Précision sous le nom (durée, nombre de tournois). */
  detail?: string;
};

/**
 * Classement compact des espaces membre (quiz, Scrabble) : rangs en tuiles de lettres, podium
 * en terracotta, le membre connecté sur fond blanc ; sa position en bas s'il n'est pas affiché.
 */
export function RankList({
  rows,
  empty,
  viewerNote,
  footnote,
}: {
  rows: RankListRow[];
  empty: string;
  /** Message sur la position du membre quand il n'est pas dans la liste. */
  viewerNote?: ReactNode;
  footnote?: string;
}) {
  return (
    <div>
      {rows.length === 0 ? (
        <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">{empty}</p>
      ) : (
        <ol className="mt-4 border-b border-indigo/20">
          {rows.map((row) => (
            <li
              key={row.key}
              className={cn(
                "flex items-center gap-4 border-t border-indigo/20 px-2 py-3",
                row.isViewer && "bg-blanc",
              )}
            >
              <LetterTile
                letter={String(row.rank)}
                value={null}
                tone={row.rank <= 3 ? "terracotta" : "sable"}
                label={`Rang ${row.rank}`}
                className="text-[40px]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {row.name}
                  {row.isViewer ? <span className="font-normal text-gris"> (vous)</span> : null}
                </span>
                {row.detail ? <span className="petit block text-gris">{row.detail}</span> : null}
              </span>
              <span className="font-serif text-xl tabular-nums">{row.value}</span>
            </li>
          ))}
        </ol>
      )}
      {viewerNote ? (
        <p className="petit mt-4 rounded-champ bg-sable px-4 py-3">{viewerNote}</p>
      ) : null}
      {footnote ? <p className="petit mt-3 text-gris">{footnote}</p> : null}
    </div>
  );
}

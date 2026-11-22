import { LetterTile } from "@/components/shared/letter-tile";
import { signed, winsLabel } from "@/features/scrabble/components/labels";
import { cn } from "@/lib/utils";

export type StandingLine = {
  key: string;
  rank: number | null;
  name: string;
  detail?: string | null;
  withdrawn: boolean;
  played: number;
  wins: number;
  losses: number;
  forfeits: number;
  totalScore: number;
  spread: number;
};

/**
 * Classement d'un tournoi : rangs en tuiles (podium terracotta), colonnes selon la règle.
 * Sous 640 px, seules les colonnes décisives restent (rang, nom, victoires ou total).
 */
export function StandingsTable({
  lines,
  classic,
  caption,
}: {
  lines: StandingLine[];
  classic: boolean;
  caption: string;
}) {
  return (
    <table className="w-full text-left text-[0.9375rem]">
      <caption className="sr-only">{caption}</caption>
      <thead className="border-b border-indigo/25 text-gris">
        <tr>
          <th scope="col" className="w-14 py-2 font-semibold">
            Rang
          </th>
          <th scope="col" className="py-2 font-semibold">
            Joueur
          </th>
          {classic ? (
            <th scope="col" className="py-2 text-right font-semibold">
              Victoires
            </th>
          ) : null}
          <th scope="col" className="py-2 text-right font-semibold">
            Total
          </th>
          {classic ? (
            <th scope="col" className="py-2 text-right font-semibold max-sm:hidden">
              Différentiel
            </th>
          ) : null}
          <th scope="col" className="py-2 text-right font-semibold max-sm:hidden">
            Manches
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => (
          <tr
            key={line.key}
            className={cn("border-b border-indigo/10", line.withdrawn && "text-gris")}
          >
            <td className="py-2.5">
              {line.rank ? (
                <LetterTile
                  letter={String(line.rank)}
                  value={null}
                  tone={line.rank <= 3 ? "terracotta" : "sable"}
                  label={`Rang ${line.rank}`}
                  className="text-[34px]"
                />
              ) : (
                <span className="text-gris">—</span>
              )}
            </td>
            <td className="py-2.5">
              <span className="font-semibold">{line.name}</span>
              {line.detail || line.withdrawn ? (
                <span className="petit block text-gris">
                  {[line.detail, line.withdrawn ? "Retiré" : null].filter(Boolean).join(" · ")}
                </span>
              ) : null}
            </td>
            {classic ? (
              <td className="py-2.5 text-right font-serif text-lg tabular-nums">
                {winsLabel(line.wins)}
              </td>
            ) : null}
            <td
              className={cn("py-2.5 text-right tabular-nums", classic ? "" : "font-serif text-lg")}
            >
              {line.totalScore.toLocaleString("fr-FR")}
            </td>
            {classic ? (
              <td className="py-2.5 text-right tabular-nums max-sm:hidden">
                {signed(line.spread)}
              </td>
            ) : null}
            <td className="py-2.5 text-right tabular-nums max-sm:hidden">
              {line.played}
              {line.forfeits > 0 ? <span className="text-gris"> ({line.forfeits} f.)</span> : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

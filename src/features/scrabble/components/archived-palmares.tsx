import Link from "next/link";
import type { PalmaresEntry } from "@/features/scrabble/queries";
import { tournamentPublicPath } from "@/features/scrabble/rules";
import { formatMonthYear } from "@/lib/dates";

const winners = (entry: PalmaresEntry) =>
  entry.winningTeams.length > 0
    ? entry.winningTeams.join(" et ")
    : entry.winners.map((w) => (w.club ? `${w.name} (${w.club})` : w.name)).join(", ");

/** Archives : palmarès des tournois aux résultats publiés, relié à la page de chaque tournoi. */
export function ArchivedPalmares({ entries }: { entries: PalmaresEntry[] }) {
  return (
    <section
      aria-labelledby="palmares-archives-titre"
      className="mt-12 lg:mt-20 lg:grid lg:grid-cols-12 lg:gap-8"
    >
      <div className="lg:sticky lg:top-32 lg:col-span-3 lg:self-start">
        <h2 id="palmares-archives-titre" className="titre-2">
          Palmarès Scrabble
        </h2>
        <p className="petit mt-2 max-w-[18rem] text-gris">
          Les vainqueurs des tournois, résultats validés.
        </p>
      </div>
      <ol className="mt-6 border-b border-indigo/20 lg:col-span-9 lg:mt-0">
        {entries.map((entry) => (
          <li
            key={entry.slug}
            className="group relative grid gap-1 border-t border-indigo/20 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6"
          >
            <p className="surtitre sm:pt-1.5">{formatMonthYear(entry.startsAt)}</p>
            <div>
              <p className="font-serif text-[1.375rem] leading-tight">{winners(entry)}</p>
              <Link
                href={tournamentPublicPath(entry.slug)}
                className="text-gris decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
              >
                {entry.name}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

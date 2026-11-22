import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import { RankList } from "@/components/shared/rank-list";
import { authRoutes } from "@/config/auth";
import { formatLabels, ordinal, statusLabels } from "@/features/scrabble/components/labels";
import { getMemberTournamentHistory, getMonthlyScrabbleRanking } from "@/features/scrabble/queries";
import { tournamentPublicPath } from "@/features/scrabble/rules";
import { formatMonth, formatShortDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Scrabble" };

async function MemberScrabble() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/scrabble`);
  const now = new Date();
  const [ranking, history] = await Promise.all([
    getMonthlyScrabbleRanking({ viewerId: user.id, now }),
    getMemberTournamentHistory(user.id),
  ]);
  const viewerInTop = ranking.top.some((row) => row.isViewer);

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
      <section aria-labelledby="mensuel-titre" className="lg:order-2 lg:col-span-4">
        <h2 id="mensuel-titre" className="titre-3">
          Classement de {formatMonth(now).toLowerCase()}
        </h2>
        <p className="petit mt-1 text-gris">
          {ranking.tournaments === 0
            ? "Aucun tournoi publié ce mois-ci."
            : `Sur ${ranking.tournaments} tournoi${ranking.tournaments > 1 ? "s" : ""} : à chaque tournoi, le 1er de N joueurs classés marque N points, le dernier 1.`}
        </p>
        <RankList
          rows={ranking.top.map((row) => ({
            key: row.userId,
            rank: row.rank,
            name: `${row.firstName} ${row.lastNameInitial}`,
            isViewer: row.isViewer,
            value: String(row.points),
            detail: `${row.tournaments} tournoi${row.tournaments > 1 ? "s" : ""}`,
          }))}
          empty="Le classement du mois s’ouvre avec les premiers résultats publiés."
          viewerNote={
            ranking.viewer && !viewerInTop
              ? ranking.viewer.hidden
                ? "Vous avez choisi de ne pas apparaître dans les classements (réglable dans votre profil)."
                : ranking.viewer.rank
                  ? `Votre position : ${ranking.viewer.rank}e, avec ${ranking.viewer.points} points.`
                  : null
              : null
          }
          footnote="Visible des seuls membres connectés : prénom et initiale du nom."
        />
      </section>

      <div className="space-y-12 lg:order-1 lg:col-span-5">
        <section aria-labelledby="mes-tournois-titre">
          <h2 id="mes-tournois-titre" className="titre-3">
            Mes tournois
          </h2>
          {history.length === 0 ? (
            <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
              Vous n’avez encore joué aucun tournoi. Le responsable Scrabble inscrit les joueurs
              lors des séances ; les prochaines dates sont dans l’agenda.
            </p>
          ) : (
            <ul className="mt-4 border-b border-indigo/20">
              {history.map((entry) => (
                <li
                  key={entry.slug}
                  className="group relative flex items-center gap-4 border-t border-indigo/20 py-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="petit font-semibold text-gris">
                      {formatShortDate(entry.startsAt)} · {formatLabels[entry.format]}
                      {entry.team ? ` · ${entry.team}` : ""}
                    </p>
                    <Link
                      href={tournamentPublicPath(entry.slug)}
                      className="mt-0.5 block font-serif text-lg leading-snug decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
                    >
                      {entry.name}
                    </Link>
                  </div>
                  {entry.resultsPublished && entry.finalRank ? (
                    <span className="text-right">
                      <span className="block font-serif text-2xl leading-none">
                        {ordinal(entry.finalRank)}
                      </span>
                      {entry.rankedCount ? (
                        <span className="petit text-gris">sur {entry.rankedCount}</span>
                      ) : null}
                    </span>
                  ) : (
                    <Tag>{entry.withdrawn ? "Retiré" : statusLabels[entry.status]}</Tag>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link href="/scrabble" className="lien mt-4 inline-flex min-h-11 items-center gap-1">
            Tournois, palmarès et records du club
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </section>

        <Link
          href="/member/quiz"
          className="group block rounded-[18px] bg-sable p-6 transition-colors duration-200 hover:bg-blanc"
        >
          <p className="surtitre">Génies du soir</p>
          <p className="mt-2 font-serif text-[1.5rem] leading-tight">Les quiz de l’Agora</p>
          <p className="mt-1 text-gris">Une question par écran, un chrono, un classement.</p>
          <span className="lien mt-3 inline-flex items-center gap-1">
            Voir les quiz
            <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      </div>
    </div>
  );
}

export default function MemberScrabblePage() {
  return (
    <>
      <p className="surtitre">Jeux de l’esprit</p>
      <h1 className="titre-1 mt-3">Scrabble et quiz</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 space-y-4">
            <div className="skeleton h-24 w-full max-w-xl" />
            <div className="skeleton h-24 w-full max-w-xl" />
          </div>
        }
      >
        <MemberScrabble />
      </Suspense>
    </>
  );
}

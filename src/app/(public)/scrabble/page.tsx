import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { PageIntro } from "@/components/layout/page-intro";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { Tag } from "@/components/shared/event-row";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { formatLabels, modeLabels, statusLabels } from "@/features/scrabble/components/labels";
import {
  getCurrentRecords,
  getPalmares,
  getPublicTournaments,
  type PalmaresEntry,
  type PublicPlayer,
  type PublicTournamentSummary,
} from "@/features/scrabble/queries";
import { tournamentPublicPath } from "@/features/scrabble/rules";
import { eventDateParts, formatDate, formatMonthYear } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Tournois de Scrabble",
  description:
    "Les tournois de Scrabble de L’Agora de l’Excellence à Dakar : calendrier, résultats, palmarès et records du club.",
  alternates: { canonical: "/scrabble" },
};

const rangs = gradins(
  [
    "var(--color-terracotta-clair)",
    "var(--color-terracotta)",
    "rgb(247 244 237 / 0.14)",
    "rgb(247 244 237 / 0.09)",
  ],
  { inner: 52, step: 15 },
);

const playerLabel = (player: PublicPlayer) =>
  player.club ? `${player.name} (${player.club})` : player.name;

const winnersLabel = (entry: { winners: PublicPlayer[]; winningTeams: string[] }) =>
  entry.winningTeams.length > 0
    ? entry.winningTeams.join(" et ")
    : entry.winners.map(playerLabel).join(", ");

function TournamentLine({ tournament }: { tournament: PublicTournamentSummary }) {
  const date = eventDateParts(tournament.startsAt);
  return (
    <article className="group relative grid grid-cols-[64px_1fr] gap-x-4 border-t border-indigo/20 py-6 lg:grid-cols-[120px_1fr_auto] lg:gap-x-8">
      <time dateTime={date.iso}>
        <span className="block font-serif text-[2.75rem] leading-none lg:text-[4rem]">
          {date.day}
        </span>
        <span className="surtitre mt-1 block">{date.month}</span>
      </time>
      <div>
        <div className="flex flex-wrap gap-2">
          <Tag tone={tournament.status === "CANCELLED" ? "erreur" : "neutre"}>
            {statusLabels[tournament.status]}
          </Tag>
          {tournament.isInterclub ? <Tag tone="accent">Interclubs</Tag> : null}
        </div>
        <h3 className="titre-3 mt-3 lg:text-[1.75rem]">
          <Link
            href={tournamentPublicPath(tournament.slug)}
            className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
          >
            {tournament.name}
          </Link>
        </h3>
        <p className="mt-1.5 text-gris">
          {formatLabels[tournament.format]} · {modeLabels[tournament.gameMode]}
          {tournament.participantCount > 0 ? ` · ${tournament.participantCount} joueurs` : ""}
          {tournament.location ? ` · ${tournament.location}` : ""}
        </p>
      </div>
      {tournament.resultsPublishedAt &&
      (tournament.winners.length || tournament.winningTeams.length) ? (
        <p className="col-start-2 mt-3 lg:col-start-3 lg:mt-0 lg:max-w-[16rem] lg:text-right">
          <span className="surtitre block">Vainqueur</span>
          <span className="font-serif text-lg">{winnersLabel(tournament)}</span>
        </p>
      ) : null}
    </article>
  );
}

/** Palmarès : section indigo, chaque victoire sur une rangée, comme un gradin. */
function Palmares({ entries }: { entries: PalmaresEntry[] }) {
  return (
    <section
      aria-labelledby="palmares-titre"
      className="sur-indigo relative overflow-hidden bg-indigo text-ivoire"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-[210px] -bottom-[160px] w-[520px] lg:-right-[160px] lg:-bottom-[330px] lg:w-[1000px]"
      >
        <Hemicycle rows={rangs} overshoot={10} />
      </div>
      <div className="page relative py-16 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-4">
          <LetterTile letter="P" tone="ivoire" className="text-[64px] lg:text-[96px]" />
          <h2 id="palmares-titre" className="titre-1 mt-6">
            Palmarès
          </h2>
          <p className="mt-4 max-w-[22rem] text-ivoire/80">
            Les vainqueurs de chaque tournoi, une fois les résultats validés par le responsable
            Scrabble.
          </p>
        </div>
        <ol className="relative mt-10 border-b border-ivoire/15 lg:col-span-7 lg:col-start-6 lg:mt-0">
          {entries.map((entry) => (
            <li key={entry.slug} className="group relative border-t border-ivoire/15 py-5">
              <p className="text-[0.75rem] font-bold tracking-[0.16em] text-terracotta-clair uppercase">
                {formatMonthYear(entry.startsAt)}
                {entry.isInterclub ? " · Interclubs" : ""}
              </p>
              <p className="mt-2 font-serif text-[1.5rem] leading-tight lg:text-[2rem]">
                {winnersLabel(entry)}
              </p>
              <Link
                href={tournamentPublicPath(entry.slug)}
                className="mt-1 inline-block text-ivoire/75 underline-offset-4 group-hover:underline after:absolute after:inset-0"
              >
                {entry.name}
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

async function ScrabbleContent() {
  // « À venir » dépend de l'heure de la requête : rendu à chaque visite, sous <Suspense>.
  await connection();
  const [tournaments, palmares, records] = await Promise.all([
    getPublicTournaments(),
    getPalmares(),
    getCurrentRecords(),
  ]);
  const now = new Date().getTime();
  const upcoming = tournaments
    .filter(
      (t) =>
        t.status !== "CANCELLED" &&
        !t.resultsPublishedAt &&
        (t.endsAt ?? t.startsAt).getTime() >= now - 86_400_000,
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const others = tournaments.filter((t) => !upcoming.includes(t));

  return (
    <>
      {tournaments.length === 0 ? (
        <div className="page py-12 lg:py-24">
          <EmptyState
            title="Le premier tournoi se prépare"
            action={
              <Link href="/events" className={buttonVariants({ variant: "contour" })}>
                Voir l’agenda
              </Link>
            }
          >
            Les tournois paraîtront ici dès qu’ils seront annoncés, avec leurs résultats une fois
            validés.
          </EmptyState>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section
              aria-labelledby="prochains-titre"
              className="page py-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24"
            >
              <h2
                id="prochains-titre"
                className="titre-2 lg:sticky lg:top-32 lg:col-span-3 lg:self-start"
              >
                À venir
              </h2>
              <div className="mt-5 border-b border-indigo/20 lg:col-span-9 lg:mt-0">
                {upcoming.map((t) => (
                  <TournamentLine key={t.slug} tournament={t} />
                ))}
              </div>
            </section>
          ) : null}
          {palmares.length > 0 ? <Palmares entries={palmares} /> : null}
          {records.length > 0 ? (
            <section aria-labelledby="records-titre" className="page py-12 lg:py-24">
              <h2 id="records-titre" className="titre-1">
                Records du club
              </h2>
              <dl className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                {records.map((record) => (
                  <div key={record.id} className="border-t border-indigo/20 py-6">
                    <dt className="surtitre">{record.category}</dt>
                    <dd className="mt-2 font-serif text-[2rem] leading-tight">{record.value}</dd>
                    <dd className="mt-1 text-gris">
                      {record.holder}
                      {record.achievedAt ? ` · ${formatDate(record.achievedAt)}` : ""}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {others.length > 0 ? (
            <section
              aria-labelledby="historique-titre"
              className="page py-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24"
            >
              <h2
                id="historique-titre"
                className="titre-2 lg:sticky lg:top-32 lg:col-span-3 lg:self-start"
              >
                Historique
              </h2>
              <div className="mt-5 border-b border-indigo/20 lg:col-span-9 lg:mt-0">
                {others.map((t) => (
                  <TournamentLine key={t.slug} tournament={t} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function ScrabbleSkeleton() {
  return (
    <div aria-hidden="true" className="page py-12 lg:py-24">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="skeleton mt-6 h-24 w-full" />
      ))}
    </div>
  );
}

export default function ScrabblePage() {
  return (
    <>
      <PageIntro
        surtitre="Les Tournois de Scrabble"
        letter="S"
        tone="indigo"
        arc="b"
        title="La table, les tuiles, le chrono."
      >
        Des séances d’initiation pour apprendre, puis des compétitions sur place, en duplicate ou en
        partie classique, avec un classement mensuel pour les membres.
      </PageIntro>
      <Suspense fallback={<ScrabbleSkeleton />}>
        <ScrabbleContent />
      </Suspense>
    </>
  );
}

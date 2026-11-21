import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import {
  formatLabels,
  modeLabels,
  ruleLabels,
  statusLabels,
} from "@/features/scrabble/components/labels";
import { StandingsTable, type StandingLine } from "@/features/scrabble/components/standings-table";
import { getPublicTournament } from "@/features/scrabble/queries";
import { formatFullDate, formatTime } from "@/lib/dates";

type Props = PageProps<"/scrabble/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) return { title: "Tournoi introuvable", robots: { index: false } };
  const description =
    `${formatFullDate(t.startsAt)} · ${formatLabels[t.format]}, ${modeLabels[t.gameMode].toLowerCase()}. ${t.description ?? ""}`
      .trim()
      .slice(0, 200);
  return { title: t.name, description, alternates: { canonical: `/scrabble/${t.slug}` } };
}

async function Tournament({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const t = await getPublicTournament(slug);
  if (!t) notFound();
  const classic = t.gameMode === "CLASSIC";
  const practical: [string, string][] = [
    ["Date", `${formatFullDate(t.startsAt)}, ${formatTime(t.startsAt)}`],
    ["Formule", `${formatLabels[t.format]} · ${modeLabels[t.gameMode]}`],
    ["Classement", ruleLabels[t.rankingRule]],
    ...(t.location ? ([["Lieu", t.location]] as [string, string][]) : []),
    ...(t.roundCount > 0 ? ([["Manches", String(t.roundCount)]] as [string, string][]) : []),
    ...(t.reward ? ([["Récompense", t.reward]] as [string, string][]) : []),
  ];
  const lines: StandingLine[] =
    t.results?.standings.map((row, index) => ({
      key: `${index}`,
      rank: row.rank,
      name: row.name,
      detail: row.team ?? row.club,
      withdrawn: row.withdrawn,
      played: row.played,
      wins: row.wins,
      losses: row.losses,
      forfeits: row.forfeits,
      totalScore: row.totalScore,
      spread: row.spread,
    })) ?? [];
  const teamLines: StandingLine[] =
    t.results?.teams.map((team, index) => ({
      key: `equipe-${index}`,
      rank: team.rank,
      name: team.name,
      detail: team.players.map((p) => p.name).join(", "),
      withdrawn: false,
      played: 0,
      wins: team.wins,
      losses: 0,
      forfeits: 0,
      totalScore: team.totalScore,
      spread: team.spread,
    })) ?? [];

  return (
    <article className="page py-10 lg:py-20">
      <Link
        href="/scrabble"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Tous les tournois
      </Link>
      <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-8">
        <header className="lg:col-span-8">
          <div className="flex flex-wrap gap-2">
            <Tag tone={t.status === "CANCELLED" ? "erreur" : "accent"}>
              {statusLabels[t.status]}
            </Tag>
            {t.isInterclub ? <Tag>Interclubs</Tag> : null}
          </div>
          <h1 className="titre-1 mt-4 lg:text-[4rem]">{t.name}</h1>
          {t.description ? (
            <p className="chapo mt-5 max-w-(--container-lecture) text-gris">{t.description}</p>
          ) : null}
        </header>
        <dl className="mt-8 border-t border-indigo/20 lg:col-span-4 lg:mt-2">
          {practical.map(([label, value]) => (
            <div
              key={label}
              className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-indigo/20 py-3"
            >
              <dt className="petit font-semibold text-gris">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          {t.event ? (
            <div className="py-3">
              <Link href={`/events/${t.event.slug}`} className="lien">
                La rencontre : {t.event.title}
              </Link>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="mt-14 lg:mt-20 lg:grid lg:grid-cols-12 lg:gap-8">
        <section aria-labelledby="resultats-titre" className="lg:col-span-8">
          <h2 id="resultats-titre" className="titre-2">
            {t.results ? "Classement final" : "Joueurs inscrits"}
          </h2>
          {t.results ? (
            <div className="mt-6 space-y-10">
              {teamLines.length > 0 ? (
                <StandingsTable
                  lines={teamLines}
                  classic={classic}
                  caption="Classement des équipes"
                />
              ) : null}
              <StandingsTable lines={lines} classic={classic} caption="Classement des joueurs" />
              <p className="petit text-gris">
                Résultats validés par le responsable Scrabble. Membres du club : prénom et initiale.
              </p>
            </div>
          ) : t.players.length > 0 ? (
            <>
              <ul className="mt-6 grid gap-x-8 border-b border-indigo/20 sm:grid-cols-2">
                {t.players.map((player, index) => (
                  <li key={index} className="border-t border-indigo/20 py-3">
                    <span className="font-semibold">{player.name}</span>
                    {player.club ? <span className="text-gris"> · {player.club}</span> : null}
                  </li>
                ))}
              </ul>
              <p className="petit mt-4 text-gris">
                Le classement paraîtra ici une fois les résultats validés.
              </p>
            </>
          ) : (
            <p className="mt-4 text-gris">
              Les inscriptions se font auprès du responsable Scrabble.
            </p>
          )}
        </section>
        {t.rules ? (
          <aside className="mt-14 lg:col-span-4 lg:mt-0">
            <h2 className="titre-3">Règlement</h2>
            <p className="mt-3 whitespace-pre-line text-gris">{t.rules}</p>
          </aside>
        ) : null}
      </div>
    </article>
  );
}

export default function TournamentPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="page py-10 lg:py-20">
          <div className="skeleton h-4 w-32" />
          <div className="skeleton mt-8 h-14 w-3/4" />
          <div className="skeleton mt-10 h-64 w-full" />
        </div>
      }
    >
      <Tournament params={params} />
    </Suspense>
  );
}

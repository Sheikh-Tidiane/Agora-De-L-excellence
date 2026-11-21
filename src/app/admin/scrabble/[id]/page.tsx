import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import {
  formatLabels,
  modeLabels,
  ruleLabels,
  statusLabels,
  statusTones,
} from "@/features/scrabble/components/labels";
import { ResultsPanel } from "@/features/scrabble/components/results-panel";
import { RosterPanel } from "@/features/scrabble/components/roster-panel";
import { RoundsPanel } from "@/features/scrabble/components/rounds-panel";
import { StandingsTable, type StandingLine } from "@/features/scrabble/components/standings-table";
import { TournamentStatusActions } from "@/features/scrabble/components/tournament-status";
import { getAdminTournament } from "@/features/scrabble/queries";
import { PLAY_STATUSES, ROSTER_STATUSES, tournamentPublicPath } from "@/features/scrabble/rules";
import { formatDateTime } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Tournoi" };

/** Feuille d'un tournoi (desktop d'abord) : joueurs et manches à gauche, résultats à droite. */
async function Tournament({ params }: Pick<PageProps<"/admin/scrabble/[id]">, "params">) {
  const { id } = await params;
  const user = await requirePageAccess("tournaments.manage", `/admin/scrabble/${id}`);
  const t = await getAdminTournament(id);
  if (!t) notFound();

  const classic = t.gameMode === "CLASSIC";
  const locked = t.resultsValidatedAt !== null;
  const nameOf = new Map(t.participants.map((p) => [p.id, p]));
  const teamName = new Map(t.teams.map((team) => [team.id, team.name]));
  const lines: StandingLine[] = t.ranking.standings.map((s) => {
    const player = nameOf.get(s.participantId);
    return {
      key: s.participantId,
      rank: s.rank,
      name: player?.name ?? "Joueur",
      detail: player?.teamId ? teamName.get(player.teamId) : player?.externalClub,
      withdrawn: s.withdrawn,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      forfeits: s.forfeits,
      totalScore: s.totalScore,
      spread: s.spread,
    };
  });
  const teamLines: StandingLine[] = t.ranking.teams.map((team) => ({
    key: team.teamId,
    rank: team.rank,
    name: teamName.get(team.teamId) ?? "Équipe",
    detail: `${team.participantIds.length} joueurs`,
    withdrawn: false,
    played: team.played,
    wins: team.wins,
    losses: team.losses,
    forfeits: team.forfeits,
    totalScore: team.totalScore,
    spread: team.spread,
  }));
  const activePlayers = t.participants
    .filter((p) => !p.withdrawn)
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <AdminPageHeader
        title={t.name}
        actions={
          <>
            <Link
              href={`/admin/scrabble/${t.id}/settings`}
              className="lien inline-flex min-h-11 items-center px-2"
            >
              Réglages
            </Link>
            {t.status !== "DRAFT" ? (
              <Link
                href={tournamentPublicPath(t.slug)}
                className="lien inline-flex min-h-11 items-center px-2"
              >
                Page publique
              </Link>
            ) : null}
          </>
        }
      >
        {formatDateTime(t.startsAt)} · {formatLabels[t.format]} · {modeLabels[t.gameMode]} ·{" "}
        {ruleLabels[t.rankingRule]}
        {t.countsForMonthly ? "" : " · hors classement mensuel"}
      </AdminPageHeader>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <StatusPill tone={statusTones[t.status]}>{statusLabels[t.status]}</StatusPill>
        <TournamentStatusActions tournamentId={t.id} status={t.status} validated={locked} />
      </div>

      <div className="grid gap-12 xl:grid-cols-12 xl:gap-12">
        <div className="space-y-12 xl:col-span-8">
          <RoundsPanel
            tournamentId={t.id}
            rounds={t.rounds}
            entry={t.entry}
            classic={classic}
            players={activePlayers}
            canPlay={PLAY_STATUSES.includes(t.status)}
            locked={locked}
          />
          <section aria-labelledby="classement-titre">
            <h2 id="classement-titre" className="titre-3">
              {locked ? "Classement validé" : "Classement provisoire"}
            </h2>
            <p className="petit mt-1 text-gris">
              {locked
                ? "Rangs figés à la validation."
                : "Calculé en direct sur les scores saisis ; rien n’est public avant la publication."}
            </p>
            {lines.length === 0 ? (
              <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
                Le classement apparaît dès les premiers scores.
              </p>
            ) : (
              <div className="mt-4 space-y-8">
                {t.format === "TEAMS" && teamLines.length > 0 ? (
                  <StandingsTable lines={teamLines} classic={classic} caption="Équipes" />
                ) : null}
                <StandingsTable lines={lines} classic={classic} caption="Joueurs" />
              </div>
            )}
          </section>
        </div>
        <aside className="space-y-10 xl:col-span-4">
          <ResultsPanel
            tournamentId={t.id}
            canPublishResults={can(user, "results.publish")}
            canValidate={t.canValidate}
            missingScores={t.missingScores}
            validatedAt={t.resultsValidatedAt}
            validatedBy={t.resultsValidatedBy}
            publishedAt={t.resultsPublishedAt}
          />
          <RosterPanel
            tournamentId={t.id}
            participants={t.participants}
            teams={t.teams}
            teamsFormat={t.format === "TEAMS"}
            editable={ROSTER_STATUSES.includes(t.status) && !locked}
          />
        </aside>
      </div>
    </>
  );
}

export default function TournamentAdminPage({ params }: PageProps<"/admin/scrabble/[id]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Tournament params={params} />
    </Suspense>
  );
}

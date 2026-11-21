import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { roundStatusLabels } from "@/features/scrabble/components/labels";
import {
  ScoreEntry,
  type EntryGroup,
  type EntryRow,
} from "@/features/scrabble/components/score-entry";
import { getAdminTournament } from "@/features/scrabble/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Saisie des scores" };

async function Scores({
  params,
}: Pick<PageProps<"/admin/scrabble/[id]/rounds/[roundId]">, "params">) {
  const { id, roundId } = await params;
  await requirePageAccess("scores.enter", `/admin/scrabble/${id}/rounds/${roundId}`);
  const t = await getAdminTournament(id);
  const round = t?.rounds.find((item) => item.id === roundId);
  if (!t || !round) notFound();

  const scoreOf = new Map(round.scores.map((score) => [score.participantId, score]));
  const players = new Map(t.participants.map((p) => [p.id, p]));
  const teamName = new Map(t.teams.map((team) => [team.id, team.name]));
  const row = (participantId: string): EntryRow => {
    const player = players.get(participantId);
    const score = scoreOf.get(participantId);
    return {
      participantId,
      name: player?.name ?? "Joueur",
      detail: player?.teamId
        ? (teamName.get(player.teamId) ?? null)
        : (player?.externalClub ?? null),
      points: score?.points ?? null,
      isForfeit: score?.isForfeit ?? false,
    };
  };

  const classic = t.gameMode === "CLASSIC";
  const groups: EntryGroup[] = classic
    ? round.matches.map((match, index) => ({
        key: match.id,
        label: match.tableNumber ? `Table ${match.tableNumber}` : `Partie ${index + 1}`,
        rows: [row(match.participantAId), row(match.participantBId)],
      }))
    : [
        {
          key: "all",
          label: null,
          // Duplicate : tous les joueurs non retirés, plus ceux qui ont déjà un score.
          rows: t.participants
            .filter((p) => !p.withdrawn || scoreOf.has(p.id))
            .map((p) => row(p.id)),
        },
      ];
  const progress = t.entry.find((item) => item.roundId === round.id);

  return (
    <>
      <AdminPageHeader
        title={`Manche ${round.number}`}
        actions={
          <Link href={`/admin/scrabble/${t.id}`} className="lien inline-flex min-h-11 items-center">
            Retour au tournoi
          </Link>
        }
      >
        {t.name} · {roundStatusLabels[round.status]}
        {progress ? ` · ${progress.entered}/${progress.expected} scores saisis` : ""}
      </AdminPageHeader>
      {groups.length === 0 || groups.every((group) => group.rows.length === 0) ? (
        <EmptyState title={classic ? "Aucune partie appariée" : "Aucun joueur"}>
          {classic
            ? "Appariez les joueurs depuis la feuille du tournoi avant de saisir les scores."
            : "Inscrivez des joueurs depuis la feuille du tournoi."}
        </EmptyState>
      ) : (
        <div className="max-w-[36rem]">
          <ScoreEntry
            key={round.scores.map((s) => `${s.id}${s.updatedAt.getTime()}`).join()}
            roundId={round.id}
            groups={groups}
            locked={t.resultsValidatedAt !== null}
          />
        </div>
      )}
    </>
  );
}

export default function RoundScoresPage({
  params,
}: PageProps<"/admin/scrabble/[id]/rounds/[roundId]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Scores params={params} />
    </Suspense>
  );
}

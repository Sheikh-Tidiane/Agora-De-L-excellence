import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { TournamentForm } from "@/features/scrabble/components/tournament-form";
import { getAdminTournament, getLinkableEvents } from "@/features/scrabble/queries";
import { formatShortDate, toLocalDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Réglages du tournoi" };

async function Settings({ params }: Pick<PageProps<"/admin/scrabble/[id]/settings">, "params">) {
  const { id } = await params;
  await requirePageAccess("tournaments.manage", `/admin/scrabble/${id}/settings`);
  const isNew = id === "new";
  const [tournament, events] = await Promise.all([
    isNew ? null : getAdminTournament(id),
    getLinkableEvents(isNew ? null : id),
  ]);
  if (!isNew && !tournament) notFound();

  return (
    <>
      <AdminPageHeader title={tournament ? tournament.name : "Nouveau tournoi"}>
        {tournament
          ? "Format et mode de jeu se figent dès la première manche."
          : "Il est créé en brouillon, invisible du public : vous inscrivez les joueurs, puis vous ouvrez les inscriptions ou lancez le tournoi."}
      </AdminPageHeader>
      <TournamentForm
        tournamentId={tournament?.id}
        locked={tournament ? tournament.rounds.length > 0 : false}
        events={events.map((event) => ({
          id: event.id,
          label: `${event.title} · ${formatShortDate(event.startsAt)}`,
        }))}
        initial={{
          name: tournament?.name ?? "",
          description: tournament?.description ?? "",
          rules: tournament?.rules ?? "",
          format: tournament?.format ?? "INDIVIDUAL",
          gameMode: tournament?.gameMode ?? "DUPLICATE",
          rankingRule: tournament?.rankingRule ?? "CUMULATIVE_SCORE",
          isInterclub: tournament?.isInterclub ?? false,
          countsForMonthly: tournament?.countsForMonthly ?? true,
          location: tournament?.location ?? "",
          reward: tournament?.reward ?? "",
          startsAt: toLocalDateTime(tournament?.startsAt),
          endsAt: toLocalDateTime(tournament?.endsAt),
          eventId: tournament?.event?.id ?? "",
        }}
      />
    </>
  );
}

export default function TournamentSettingsPage({
  params,
}: PageProps<"/admin/scrabble/[id]/settings">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Settings params={params} />
    </Suspense>
  );
}

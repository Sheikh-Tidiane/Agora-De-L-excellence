"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import {
  formatLabels,
  modeLabels,
  statusLabels,
  statusTones,
} from "@/features/scrabble/components/labels";
import type { AdminTournamentRow } from "@/features/scrabble/queries";
import { formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const Results = ({ row }: { row: AdminTournamentRow }) =>
  row.resultsPublishedAt ? (
    <StatusPill tone="succes">Publiés</StatusPill>
  ) : row.resultsValidatedAt ? (
    <StatusPill tone="alerte">Validés</StatusPill>
  ) : (
    <span className="text-gris">—</span>
  );

const columns: Column<AdminTournamentRow>[] = [
  {
    key: "name",
    header: "Tournoi",
    cell: (row) => <span className="font-semibold">{row.name}</span>,
    sort: (row) => row.name,
  },
  {
    key: "startsAt",
    header: "Date",
    cell: (row) => <span className="tabular-nums">{formatShortDate(row.startsAt)}</span>,
    sort: (row) => row.startsAt.getTime(),
  },
  {
    key: "format",
    header: "Formule",
    cell: (row) => `${formatLabels[row.format]} · ${modeLabels[row.gameMode]}`,
    sort: (row) => `${row.format}${row.gameMode}`,
    className: "max-xl:hidden",
  },
  {
    key: "players",
    header: "Joueurs",
    cell: (row) => <span className="tabular-nums">{row.participantCount}</span>,
    sort: (row) => row.participantCount,
    align: "right",
  },
  {
    key: "rounds",
    header: "Manches",
    cell: (row) => <span className="tabular-nums">{row.roundCount}</span>,
    sort: (row) => row.roundCount,
    align: "right",
    className: "max-lg:hidden",
  },
  {
    key: "status",
    header: "État",
    cell: (row) => (
      <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
    ),
    sort: (row) => row.status,
  },
  { key: "results", header: "Résultats", cell: (row) => <Results row={row} /> },
];

/** Tournois : tri, recherche, filtre par état ; la feuille du tournoi s'ouvre sur sa page. */
export function TournamentsTable({ rows }: { rows: AdminTournamentRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      label="Tournois"
      rows={rows}
      columns={columns}
      getId={(row) => row.id}
      searchText={(row) => row.name}
      searchPlaceholder="Nom du tournoi…"
      filters={[
        {
          key: "status",
          label: "État",
          get: (row) => row.status,
          options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })),
        },
      ]}
      defaultSort={{ key: "startsAt", direction: "desc" }}
      onOpen={(row) => router.push(`/admin/scrabble/${row.id}`)}
      actions={
        <Link
          href="/admin/scrabble/new/settings"
          data-shortcut-new
          className={cn(buttonVariants({ variant: "principal", size: "sm" }))}
        >
          <Plus aria-hidden="true" />
          Nouveau tournoi
        </Link>
      }
      card={(row) => (
        <>
          <span className="flex items-center justify-between gap-3">
            <span className="font-semibold">{row.name}</span>
            <StatusPill tone={statusTones[row.status]}>{statusLabels[row.status]}</StatusPill>
          </span>
          <span className="petit mt-1 block text-gris">
            {formatShortDate(row.startsAt)} · {modeLabels[row.gameMode]} · {row.participantCount}{" "}
            joueurs
          </span>
        </>
      )}
      empty={
        <EmptyState title="Aucun tournoi pour l’instant">
          Créez le premier avec « Nouveau tournoi » : séance d’initiation, tournoi duplicate ou
          rencontre par équipes.
        </EmptyState>
      }
    />
  );
}

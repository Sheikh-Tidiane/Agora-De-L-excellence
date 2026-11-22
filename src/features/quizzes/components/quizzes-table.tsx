"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { phaseLabels, phaseTones } from "@/features/quizzes/components/labels";
import type { QuizPhase } from "@/features/quizzes/rules";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type QuizRow = {
  id: string;
  title: string;
  phase: QuizPhase;
  archived: boolean;
  opensAt: Date;
  closesAt: Date;
  durationMinutes: number;
  questionCount: number;
  attemptCount: number;
  eventTitle: string | null;
};

const Phase = ({ row }: { row: QuizRow }) =>
  row.archived ? (
    <StatusPill tone="neutre">Archivé</StatusPill>
  ) : (
    <StatusPill tone={phaseTones[row.phase]}>{phaseLabels[row.phase]}</StatusPill>
  );

const columns: Column<QuizRow>[] = [
  {
    key: "title",
    header: "Quiz",
    cell: (row) => (
      <span>
        <span className="font-semibold">{row.title}</span>
        {row.eventTitle ? <span className="petit block text-gris">{row.eventTitle}</span> : null}
      </span>
    ),
    sort: (row) => row.title,
  },
  {
    key: "opensAt",
    header: "Ouverture",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.opensAt)}</span>,
    sort: (row) => row.opensAt.getTime(),
  },
  {
    key: "closesAt",
    header: "Fermeture",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.closesAt)}</span>,
    sort: (row) => row.closesAt.getTime(),
    className: "max-xl:hidden",
  },
  {
    key: "duration",
    header: "Durée",
    cell: (row) => <span className="tabular-nums">{row.durationMinutes} min</span>,
    sort: (row) => row.durationMinutes,
    align: "right",
    className: "max-lg:hidden",
  },
  {
    key: "questions",
    header: "Questions",
    cell: (row) => <span className="tabular-nums">{row.questionCount}</span>,
    sort: (row) => row.questionCount,
    align: "right",
  },
  {
    key: "attempts",
    header: "Participants",
    cell: (row) => <span className="tabular-nums">{row.attemptCount}</span>,
    sort: (row) => row.attemptCount,
    align: "right",
  },
  { key: "phase", header: "État", cell: (row) => <Phase row={row} />, sort: (row) => row.phase },
];

/** Liste des quiz : tri, recherche, filtre par état ; la fiche s'ouvre sur sa page. */
export function QuizzesTable({ rows }: { rows: QuizRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      label="Quiz"
      rows={rows}
      columns={columns}
      getId={(row) => row.id}
      searchText={(row) => `${row.title} ${row.eventTitle ?? ""}`}
      searchPlaceholder="Titre du quiz…"
      filters={[
        {
          key: "phase",
          label: "État",
          get: (row) => (row.archived ? "archived" : row.phase),
          options: [
            ...Object.entries(phaseLabels).map(([value, label]) => ({ value, label })),
            { value: "archived", label: "Archivé" },
          ],
        },
      ]}
      defaultSort={{ key: "opensAt", direction: "desc" }}
      onOpen={(row) => router.push(`/admin/quizzes/${row.id}`)}
      actions={
        <Link
          href="/admin/quizzes/new"
          data-shortcut-new
          className={cn(buttonVariants({ variant: "principal", size: "sm" }))}
        >
          <Plus aria-hidden="true" />
          Nouveau quiz
        </Link>
      }
      card={(row) => (
        <>
          <span className="flex items-center justify-between gap-3">
            <span className="font-semibold">{row.title}</span>
            <Phase row={row} />
          </span>
          <span className="petit mt-1 block text-gris">
            Du {formatShortDate(row.opensAt)} au {formatShortDate(row.closesAt)} ·{" "}
            {row.questionCount} questions · {row.attemptCount} participants
          </span>
        </>
      )}
      empty={
        <EmptyState title="Aucun quiz pour l’instant">
          Préparez le premier avec « Nouveau quiz » : une dizaine de questions pour échauffer les
          Génies du soir, à jouer sur téléphone.
        </EmptyState>
      }
    />
  );
}

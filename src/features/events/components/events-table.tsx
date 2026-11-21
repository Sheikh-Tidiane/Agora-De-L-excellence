"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { setEventStatusAction } from "@/features/events/admin-actions";
import {
  eventStatusLabels,
  eventTypeLabels,
  type EventStatusCode,
  type EventTypeCode,
} from "@/features/events/rules";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type EventRowData = {
  id: string;
  title: string;
  type: EventTypeCode;
  status: EventStatusCode;
  startsAt: Date;
  location: string | null;
  capacity: number | null;
  taken: number;
  isPublic: boolean;
  past: boolean;
};

export const eventStatusTones = {
  DRAFT: "alerte",
  PUBLISHED: "succes",
  CLOSED: "neutre",
  CANCELLED: "erreur",
} as const;

const Status = ({ status }: { status: EventStatusCode }) => (
  <StatusPill tone={eventStatusTones[status]}>{eventStatusLabels[status]}</StatusPill>
);

const seats = (row: EventRowData) =>
  row.capacity ? `${row.taken} / ${row.capacity}` : String(row.taken);

const columns: Column<EventRowData>[] = [
  { key: "title", header: "Événement", cell: (row) => row.title, sort: (row) => row.title },
  {
    key: "startsAt",
    header: "Date",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.startsAt)}</span>,
    sort: (row) => row.startsAt.getTime(),
  },
  {
    key: "type",
    header: "Type",
    cell: (row) => eventTypeLabels[row.type],
    sort: (row) => eventTypeLabels[row.type],
    className: "max-lg:hidden",
  },
  {
    key: "audience",
    header: "Public",
    cell: (row) => (row.isPublic ? "Ouvert" : "Membres"),
    sort: (row) => (row.isPublic ? 0 : 1),
    className: "max-xl:hidden",
  },
  { key: "seats", header: "Inscrits", align: "right", cell: seats, sort: (row) => row.taken },
  {
    key: "status",
    header: "Statut",
    cell: (row) => <Status status={row.status} />,
    sort: (row) => row.status,
  },
];

/** Événements : tableau triable, publication et clôture groupées ; la fiche s'ouvre sur sa page. */
export function EventsTable({ rows }: { rows: EventRowData[] }) {
  const router = useRouter();
  const { run, toast, notify } = useAdminAction();

  const setStatus = async (ids: string[], status: EventStatusCode, done: string) => {
    const results = await Promise.all(
      ids.map((eventId) => run(() => setEventStatusAction({ eventId, status }), {})),
    );
    const ok = results.filter(Boolean).length;
    if (ok > 0) notify({ tone: "succes", text: `${ok} événement${ok > 1 ? "s" : ""} ${done}.` });
  };

  return (
    <>
      <DataTable
        label="Événements"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.title} ${row.location ?? ""}`}
        searchPlaceholder="Titre ou lieu…"
        filters={[
          {
            key: "when",
            label: "Période",
            initial: "upcoming",
            get: (row) => (row.past ? "past" : "upcoming"),
            options: [
              { value: "upcoming", label: "À venir" },
              { value: "past", label: "Passés" },
            ],
          },
          {
            key: "status",
            label: "Statut",
            get: (row) => row.status,
            options: Object.entries(eventStatusLabels).map(([value, label]) => ({ value, label })),
          },
          {
            key: "type",
            label: "Type",
            get: (row) => row.type,
            options: Object.entries(eventTypeLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
        defaultSort={{ key: "startsAt", direction: "asc" }}
        onOpen={(row) => router.push(`/admin/events/${row.id}`)}
        bulkActions={[
          { label: "Publier", run: (ids) => setStatus(ids, "PUBLISHED", "publié(s)") },
          {
            label: "Clôturer",
            tone: "contour",
            run: (ids) => setStatus(ids, "CLOSED", "clôturé(s)"),
          },
        ]}
        actions={
          <Link
            href="/admin/events/new"
            data-shortcut-new
            className={cn(buttonVariants({ variant: "principal", size: "sm" }))}
          >
            <Plus aria-hidden="true" />
            Nouvel événement
          </Link>
        }
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.title}</span>
              <Status status={row.status} />
            </span>
            <span className="petit mt-1 block text-gris tabular-nums">
              {formatDateTime(row.startsAt)} · {seats(row)} inscrit{row.taken > 1 ? "s" : ""}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucun événement ici">
            Changez la période ou créez une rencontre avec « Nouvel événement ».
          </EmptyState>
        }
      />
      {toast}
    </>
  );
}

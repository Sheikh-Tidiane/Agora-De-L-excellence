import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EventsTable, type EventRowData } from "@/features/events/components/events-table";
import { holdsSeat } from "@/features/events/rules";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Événements" };

async function Events() {
  await requirePageAccess("events.manage", "/admin/events");
  const now = new Date();
  const events = await prisma.event.findMany({
    where: { archivedAt: null },
    orderBy: { startsAt: "desc" },
    take: 1000,
    select: {
      id: true,
      title: true,
      type: true,
      activities: true,
      status: true,
      startsAt: true,
      location: true,
      capacity: true,
      isPublic: true,
      registrations: { select: { status: true, updatedAt: true } },
    },
  });
  const rows: EventRowData[] = events.map(({ registrations, ...event }) => ({
    ...event,
    taken: registrations.filter((registration) => holdsSeat(registration, now)).length,
    past: event.startsAt.getTime() < now.getTime(),
  }));

  return (
    <>
      <AdminPageHeader title="Événements">
        Une rencontre naît en brouillon, puis se publie. Les inscriptions ferment d’elles-mêmes au
        début de la rencontre.
      </AdminPageHeader>
      <EventsTable rows={rows} />
    </>
  );
}

export default function EventsAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Events />
    </Suspense>
  );
}

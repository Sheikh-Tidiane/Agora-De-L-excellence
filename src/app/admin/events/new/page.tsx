import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EventForm, blankEvent } from "@/features/events/components/event-form";
import { loadClubSettings } from "@/features/settings/club";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Nouvel événement" };

async function NewEvent() {
  await requirePageAccess("events.manage", "/admin/events/new");
  const settings = await loadClubSettings();
  return (
    <>
      <AdminPageHeader title="Nouvel événement">
        Il est créé en brouillon : vous le relisez, puis vous le publiez.
      </AdminPageHeader>
      <div className="max-w-[46rem]">
        <EventForm initial={blankEvent} defaultDeadlineHours={settings.cancellationDeadlineHours} />
      </div>
    </>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <NewEvent />
    </Suspense>
  );
}

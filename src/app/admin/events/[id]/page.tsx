import { eventActivities } from "@/config/activities";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import {
  EventStatusPanel,
  RegistrantsTable,
  WaitlistPanel,
  type RegistrantRow,
} from "@/features/events/components/event-admin-panels";
import { EventForm } from "@/features/events/components/event-form";
import { EventReportEditor } from "@/features/events/components/event-report-editor";
import { holdsSeat, placeLabel } from "@/features/events/rules";
import { formatFcfa } from "@/lib/money";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime, toLocalDateTime } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getWaitlist } from "@/features/events/waitlist";

export const metadata: Metadata = { title: "Événement" };

async function EventAdmin({ params }: Pick<PageProps<"/admin/events/[id]">, "params">) {
  const { id } = await params;
  const user = await requirePageAccess("events.manage", `/admin/events/${id}`);
  const [event, settings, waitlist] = await Promise.all([
    prisma.event.findFirst({
      where: { id, archivedAt: null },
      include: {
        registrations: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { name: true, email: true, memberNumber: true } },
            payments: {
              where: { kind: "SESSION_FEE", cancelledAt: null },
              select: { amount: true },
            },
          },
        },
      },
    }),
    loadClubSettings(),
    getWaitlist(id),
  ]);
  if (!event) notFound();
  const now = new Date();
  const taken = event.registrations.filter((registration) => holdsSeat(registration, now)).length;

  const registrants: RegistrantRow[] = event.registrations.flatMap((registration) =>
    registration.status === "WAITLISTED"
      ? []
      : [
          {
            id: registration.id,
            name: registration.user?.name ?? registration.guestName ?? "Invité",
            email: registration.user?.email ?? registration.guestEmail ?? "",
            kind: registration.userId ? "member" : "guest",
            memberNumber: registration.user?.memberNumber ?? null,
            status: registration.status,
            createdAt: registration.createdAt,
            present: registration.attendedAt !== null,
            paid: registration.payments.length > 0,
          },
        ],
  );
  // Le pointage ouvre le jour de la rencontre (heure de Dakar = UTC).
  const dayStart = new Date(event.startsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const checkInOpen = now.getTime() >= dayStart.getTime();
  const collected = event.registrations.reduce(
    (total, registration) => total + (registration.payments[0]?.amount ?? 0),
    0,
  );
  const presentCount = registrants.filter((row) => row.present).length;

  return (
    <>
      <AdminPageHeader title={event.title}>
        {formatFullDate(event.startsAt)}, {formatTime(event.startsAt)} ·{" "}
        {placeLabel(event.location)}
      </AdminPageHeader>

      <div className="grid gap-x-12 gap-y-10 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <h2 className="titre-3 mb-5">Fiche</h2>
          <EventForm
            id={event.id}
            defaultDeadlineHours={settings.cancellationDeadlineHours}
            initial={{
              title: event.title,
              type: event.type,
              activities: eventActivities(event),
              summary: event.summary ?? "",
              description: event.description,
              location: event.location ?? "",
              isTentative: event.isTentative,
              program: event.program ?? "",
              speakerName: event.speakerName ?? "",
              speakerTitle: event.speakerTitle ?? "",
              speakerMode: event.speakerMode ?? "",
              videoLink: event.videoLink ?? "",
              startsAt: toLocalDateTime(event.startsAt),
              endsAt: toLocalDateTime(event.endsAt),
              capacity: event.capacity ? String(event.capacity) : "",
              isPublic: event.isPublic,
              cancellationDeadlineHours:
                event.cancellationDeadlineHours !== null
                  ? String(event.cancellationDeadlineHours)
                  : "",
            }}
          />
        </div>
        <div className="xl:col-span-4">
          <div className="flex flex-col gap-5 xl:sticky xl:top-24">
            <EventStatusPanel eventId={event.id} status={event.status} slug={event.slug} />
            <div className="rounded-feuille bg-blanc p-5">
              <p className="petit text-gris">Places occupées</p>
              <p className="mt-1 font-serif text-[2.5rem] leading-none tabular-nums">
                {taken}
                {event.capacity ? <span className="text-gris"> / {event.capacity}</span> : null}
              </p>
              <p className="petit mt-2 text-gris">
                Inscriptions confirmées et invités en attente de confirmation.
              </p>
            </div>
            {checkInOpen ? (
              <div className="rounded-feuille bg-blanc p-5">
                <p className="petit text-gris">Participations encaissées</p>
                <p className="mt-1 font-serif text-[2.5rem] leading-none tabular-nums">
                  {formatFcfa(collected)}
                </p>
                <p className="petit mt-2 text-gris">
                  {presentCount} présent{presentCount > 1 ? "s" : ""} ·{" "}
                  {formatFcfa(settings.sessionFee)} par séance
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {now.getTime() > event.startsAt.getTime() ? (
        <section aria-labelledby="cr-titre" className="mt-14 border-t border-indigo/30 pt-8">
          <h2 id="cr-titre" className="titre-3">
            Compte rendu
          </h2>
          <p className="mt-1.5 mb-5 max-w-[46rem] text-gris">
            Synthèse du débat, livre discuté, film projeté, résultats du tournoi. Une fois publié,
            il paraît sur la page de la rencontre et dans les archives.
          </p>
          <EventReportEditor
            eventId={event.id}
            initial={event.reportContent ?? ""}
            published={event.reportPublishedAt !== null}
          />
        </section>
      ) : null}

      <section aria-labelledby="attente-titre" className="mt-14 border-t border-indigo/30 pt-8">
        <h2 id="attente-titre" className="titre-3">
          Liste d’attente{waitlist.length > 0 ? ` (${waitlist.length})` : ""}
        </h2>
        <p className="mt-1.5 mb-5 max-w-[46rem] text-gris">
          Une place libérée jusqu’à {settings.waitlistCutoffHours}&nbsp;h avant le début va d’office
          à la première personne, prévenue par e-mail. Vous pouvez aussi inscrire quelqu’un à la
          main.
        </p>
        <WaitlistPanel
          full={event.capacity !== null && taken >= event.capacity}
          rows={waitlist.map((row) => ({
            id: row.id,
            name: row.user?.name ?? row.guestName ?? "Invité",
            email: row.user?.email ?? row.guestEmail ?? "",
            kind: row.userId ? "member" : "guest",
            position: row.position,
            since: row.waitlistedAt,
            blocked: row.blocked,
          }))}
        />
      </section>

      <section aria-labelledby="inscrits-titre" className="mt-14 border-t border-indigo/30 pt-8">
        <h2 id="inscrits-titre" className="titre-3 mb-5">
          Inscrits
        </h2>
        <RegistrantsTable
          eventId={event.id}
          rows={registrants}
          canExport={can(user, "data.export")}
          checkInOpen={checkInOpen}
          canCheckIn={can(user, "attendance.record")}
          canCollect={can(user, "payments.record")}
          sessionFee={formatFcfa(settings.sessionFee)}
        />
      </section>
    </>
  );
}

export default function EventAdminPage({ params }: PageProps<"/admin/events/[id]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <EventAdmin params={params} />
    </Suspense>
  );
}

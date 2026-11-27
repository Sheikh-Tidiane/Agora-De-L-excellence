import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { authRoutes } from "@/config/auth";
import { MyRegistrationsList } from "@/features/events/components/my-registrations";
import { getMyAttendance, getMyUpcomingRegistrations } from "@/features/events/queries";
import { activityLabels } from "@/config/activities";
import { loadClubSettings } from "@/features/settings/club";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Mes rencontres" };

async function MyEvents() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/events`);
  const now = new Date();
  const [registrations, attendance, settings] = await Promise.all([
    getMyUpcomingRegistrations(user.id, now),
    getMyAttendance(user.id),
    loadClubSettings(),
  ]);

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
      <section aria-labelledby="inscriptions-titre" className="lg:col-span-5">
        <h2 id="inscriptions-titre" className="titre-3">
          Mes inscriptions
        </h2>
        {registrations.length === 0 ? (
          <EmptyState
            title="Aucune rencontre à venir"
            className="pt-4"
            action={
              <Link href="/events" className={buttonVariants({ variant: "principal" })}>
                Voir l’agenda
                <ArrowRight aria-hidden="true" />
              </Link>
            }
          >
            Vous n’êtes inscrit à aucune rencontre pour l’instant. L’agenda du club liste les
            prochaines.
          </EmptyState>
        ) : (
          <>
            <p className="petit mt-2 text-gris">
              Annulation possible jusqu’à {settings.cancellationDeadlineHours}&nbsp;h avant le
              début.
            </p>
            <div className="mt-4">
              <MyRegistrationsList
                registrations={registrations}
                now={now}
                cancellationDeadlineHours={settings.cancellationDeadlineHours}
              />
            </div>
            <Link href="/events" className="lien mt-4 inline-flex min-h-11 items-center">
              Voir tout l’agenda
            </Link>
          </>
        )}
      </section>

      <section aria-labelledby="activites-titre" className="lg:col-span-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="activites-titre" className="titre-3">
            Mes activités
          </h2>
          {attendance.length > 0 ? (
            <span className="petit font-semibold text-gris tabular-nums">
              {attendance.length} {attendance.length > 1 ? "présences" : "présence"}
            </span>
          ) : null}
        </div>
        {attendance.length === 0 ? (
          <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
            Votre présence est notée à chaque rencontre, quand un responsable scanne votre carte de
            membre. L’historique apparaîtra ici.
          </p>
        ) : (
          <ul className="mt-4 border-b border-indigo/20">
            {attendance.map(({ id, event, payments }) => (
              <li key={id} className="border-t border-indigo/20 py-4">
                <p className="petit font-semibold text-gris">
                  {activityLabels(event).join(", ")} · {formatDate(event.startsAt)}
                </p>
                <Link
                  href={`/events/${event.slug}`}
                  className="mt-0.5 block font-serif text-lg leading-snug decoration-terracotta underline-offset-4 hover:underline"
                >
                  {event.title}
                </Link>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Tag tone="succes">Présent</Tag>
                  {payments.length > 0 ? <Tag>Participation réglée</Tag> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MemberEventsPage() {
  return (
    <>
      <p className="surtitre">Événements</p>
      <h1 className="titre-1 mt-3">Mes rencontres</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 space-y-4">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-24 w-full" />
          </div>
        }
      >
        <MyEvents />
      </Suspense>
    </>
  );
}

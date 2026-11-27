import Link from "next/link";
import { MemberCancelButton } from "@/features/events/components/registration-forms";
import type { getMyUpcomingRegistrations } from "@/features/events/queries";
import { activityLabels } from "@/config/activities";
import { canCancel, placeLabel } from "@/features/events/rules";
import { eventDateParts } from "@/lib/dates";

type Registration = Awaited<ReturnType<typeof getMyUpcomingRegistrations>>[number];

/**
 * Inscriptions à venir d'un membre : date en grand chiffre, type, titre, lieu, annulation
 * tant que le délai le permet. Partagée par le tableau de bord et « Mes inscriptions ».
 */
export function MyRegistrationsList({
  registrations,
  now,
  cancellationDeadlineHours,
}: {
  registrations: Registration[];
  now: Date;
  cancellationDeadlineHours: number;
}) {
  return (
    <ul className="border-b border-indigo/20">
      {registrations.map(({ id, event }) => {
        const date = eventDateParts(event.startsAt);
        return (
          <li key={id} className="grid grid-cols-[56px_1fr] gap-x-4 border-t border-indigo/20 py-5">
            <time dateTime={date.iso}>
              <span className="block font-serif text-[2.25rem] leading-none">{date.day}</span>
              <span className="surtitre mt-1 block">{date.month}</span>
            </time>
            <div>
              <p className="petit font-semibold text-gris">
                {activityLabels(event).join(", ")} · {date.weekday}, {date.time}
              </p>
              <h3 className="mt-1 font-serif text-xl leading-snug">
                <Link
                  href={`/events/${event.slug}`}
                  className="decoration-terracotta underline-offset-4 hover:underline"
                >
                  {event.title}
                </Link>
              </h3>
              <p className="petit mt-1">{placeLabel(event.location)}</p>
              {event.status === "CANCELLED" ? (
                <p className="petit mt-2 font-semibold text-erreur">Cette rencontre est annulée.</p>
              ) : canCancel(event, now, cancellationDeadlineHours) ? (
                <div className="mt-3">
                  <MemberCancelButton registrationId={id} />
                </div>
              ) : (
                <p className="petit mt-2 text-gris">Le délai d’annulation est passé.</p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

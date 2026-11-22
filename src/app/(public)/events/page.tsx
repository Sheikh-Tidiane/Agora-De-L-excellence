import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { EventList } from "@/features/events/components/event-list";
import { getPastEvents, getUpcomingEvents, type PublicEvent } from "@/features/events/queries";
import { eventTypeLabels } from "@/features/events/rules";
import { formatDate, formatMonthYear } from "@/lib/dates";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  title: "Événements",
  description:
    "L’agenda du club : rendez-vous lecture, tournois de Scrabble, débats d’idées, Génies du soir et Agora Ciné, à Dakar.",
  alternates: { canonical: "/events" },
};

/** Regroupe les rencontres par mois, dans l'ordre où elles arrivent. */
function byMonth(events: PublicEvent[]) {
  const groups: { label: string; events: PublicEvent[] }[] = [];
  for (const event of events) {
    const label = formatMonthYear(event.startsAt);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([getUpcomingEvents(), getPastEvents()]);
  const groups = byMonth(upcoming);

  return (
    <>
      <PageIntro
        surtitre="Agenda"
        letter="É"
        tone="clair"
        arc="c"
        title="Les prochaines rencontres."
      >
        Une rencontre en présentiel tous les quinze jours. Les rencontres ouvertes au public sont
        signalées, les autres sont réservées aux membres.
      </PageIntro>

      <div className="page py-12 lg:py-24">
        {groups.length === 0 ? (
          <EmptyState
            title="Aucune rencontre annoncée pour l’instant"
            action={
              <Link href="/news" className={buttonVariants({ variant: "contour" })}>
                Lire les actualités
              </Link>
            }
          >
            Les prochaines dates paraîtront ici dès qu’elles seront fixées.
          </EmptyState>
        ) : (
          groups.map((group) => (
            <section
              key={group.label}
              aria-label={group.label}
              className="mb-14 last:mb-0 lg:mb-24 lg:grid lg:grid-cols-12 lg:gap-8"
            >
              <h2 className="titre-2 capitalize lg:sticky lg:top-32 lg:col-span-3 lg:self-start">
                {group.label}
              </h2>
              <EventList events={group.events} className="mt-5 lg:col-span-9 lg:mt-0" />
            </section>
          ))
        )}
      </div>

      {past.length > 0 ? (
        <section aria-labelledby="passees-titre" className="bg-sable py-16 lg:py-24">
          <div className="page lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-3">
              <p className="surtitre">Déjà eu lieu</p>
              <h2 id="passees-titre" className="titre-2 mt-2">
                Les rencontres passées
              </h2>
              <Link href="/archives" className="lien mt-3 inline-flex min-h-11 items-center">
                Toutes les archives
              </Link>
            </div>
            <ul className="mt-6 lg:col-span-9 lg:mt-0">
              {past.map((event) => (
                <li key={event.slug} className="border-t border-indigo/20">
                  <Link
                    href={`/events/${event.slug}`}
                    className="group flex min-h-14 flex-col justify-center gap-0.5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
                  >
                    <span className="font-serif text-lg decoration-terracotta underline-offset-4 group-hover:underline">
                      {event.title}
                    </span>
                    <span className="petit shrink-0 text-gris">
                      {eventTypeLabels[event.type]} · {formatDate(event.startsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <ForVisitors>
        <section className="page py-16 lg:py-24">
          <div className="border-l-2 border-indigo pl-5 lg:max-w-[44rem]">
            <p className="font-serif text-[1.5rem] leading-snug lg:text-[1.875rem]">
              Les membres s’inscrivent en un geste, et participent à toutes les rencontres.
            </p>
            <Link href={membershipHref} className="lien mt-3 inline-flex min-h-11 items-center">
              Demander mon adhésion
            </Link>
          </div>
        </section>
      </ForVisitors>
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { FilterChip } from "@/components/shared/filter-chip";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { EventList } from "@/features/events/components/event-list";
import { getPastEvents, getUpcomingEvents, type PublicEvent } from "@/features/events/queries";
import { activities, activityBySlug, activityLabels, eventHasActivity } from "@/config/activities";
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

/** Agenda filtré par activité (`?activite=`) : une rencontre paraît sous chacune de ses activités. */
async function Agenda({ searchParams }: Pick<PageProps<"/events">, "searchParams">) {
  const params = await searchParams;
  const activity = activityBySlug(
    typeof params.activite === "string" ? params.activite : undefined,
  );
  // Filtrée, la liste des rencontres passées est prise plus large, puis ramenée à six.
  const [allUpcoming, allPast] = await Promise.all([
    getUpcomingEvents(),
    getPastEvents(activity ? 60 : 6),
  ]);
  const matches = (event: PublicEvent) => !activity || eventHasActivity(event, activity);
  const upcoming = allUpcoming.filter(matches);
  const past = allPast.filter(matches).slice(0, 6);
  const groups = byMonth(upcoming);

  return (
    <>
      <div className="page py-12 lg:py-24">
        <nav aria-label="Filtrer l’agenda par activité" className="mb-10 lg:mb-16">
          <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
            <li>
              <FilterChip active={!activity} to="/events">
                Toutes les activités
              </FilterChip>
            </li>
            {activities.map((item) => (
              <li key={item.slug}>
                <FilterChip
                  active={activity?.slug === item.slug}
                  to={`/events?activite=${item.slug}`}
                >
                  {item.shortName}
                </FilterChip>
              </li>
            ))}
          </ul>
        </nav>
        {groups.length === 0 && activity ? (
          <EmptyState
            title={`Aucune rencontre « ${activity.shortName} » annoncée`}
            action={
              <Link href="/events" className={buttonVariants({ variant: "contour" })}>
                Voir toutes les rencontres
              </Link>
            }
          >
            Les autres activités ont peut-être des dates : retirez le filtre pour les voir.
          </EmptyState>
        ) : groups.length === 0 ? (
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
                      {activityLabels(event).join(", ")} · {formatDate(event.startsAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function EventsPage({ searchParams }: PageProps<"/events">) {
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

      <Suspense fallback={<div className="page min-h-[60vh] py-12 lg:py-24" aria-busy="true" />}>
        <Agenda searchParams={searchParams} />
      </Suspense>

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

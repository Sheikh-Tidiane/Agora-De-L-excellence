import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/layout/page-intro";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { buttonVariants } from "@/components/ui/button";
import { activities, type Activity } from "@/config/activities";
import { membershipHref } from "@/config/navigation";
import { getUpcomingEvents, type PublicEvent } from "@/features/events/queries";
import { eventDateParts } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  title: "Activités",
  description:
    "Les cinq activités du club : Rendez-vous lecture, Tournois de Scrabble, Débats d’idées, Génies du soir et Agora Ciné.",
  alternates: { canonical: "/activities" },
};

const rangs = gradins(
  [
    "var(--color-terracotta-clair)",
    "var(--color-terracotta)",
    "rgb(247 244 237 / 0.14)",
    "rgb(247 244 237 / 0.09)",
  ],
  { inner: 52, step: 15 },
);

const tileTones = ["indigo", "clair", "terracotta", "blanc", "indigo"] as const;

/** Prochaines dates d'une activité : trois au plus, la plus proche d'abord. */
function NextDates({ events, dark }: { events: PublicEvent[]; dark: boolean }) {
  const line = dark ? "border-ivoire/20" : "border-indigo/20";
  return (
    <div className="mt-8">
      <h3 className="surtitre">Prochaines dates</h3>
      {events.length === 0 ? (
        <p className={cn("mt-3 border-t py-4", line, dark ? "text-ivoire/80" : "text-gris")}>
          Aucune date annoncée pour l’instant.
        </p>
      ) : (
        <ul className={cn("mt-3 border-b", line)}>
          {events.slice(0, 3).map((event) => {
            const date = eventDateParts(event.startsAt);
            return (
              <li key={event.slug} className={cn("border-t", line)}>
                <Link
                  href={`/events/${event.slug}`}
                  className="group grid min-h-14 grid-cols-[5.5rem_1fr] items-baseline gap-4 py-3.5"
                >
                  <time dateTime={date.iso} className="font-serif text-[1.25rem] leading-tight">
                    {date.day} {date.month}
                  </time>
                  <span>
                    <span
                      className={cn(
                        "font-semibold underline-offset-4 group-hover:underline",
                        dark ? "decoration-terracotta-clair" : "decoration-terracotta",
                      )}
                    >
                      {event.title}
                    </span>
                    <span className={cn("petit block", dark ? "text-ivoire/80" : "text-gris")}>
                      {date.weekday}, {date.time}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ActivitySection({
  activity,
  index,
  events,
}: {
  activity: Activity;
  index: number;
  events: PublicEvent[];
}) {
  // Le Scrabble porte la section sombre de la page.
  const dark = index === 1;
  const mirrored = index % 2 === 1;
  return (
    <section
      id={activity.slug}
      aria-labelledby={`${activity.slug}-titre`}
      className={cn(
        "relative scroll-mt-16 overflow-hidden",
        dark && "sur-indigo bg-indigo text-ivoire",
        index === 3 && "bg-sable",
      )}
    >
      {dark ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[210px] -bottom-[160px] w-[520px] lg:-right-[160px] lg:-bottom-[330px] lg:w-[1000px]"
        >
          <Hemicycle rows={rangs} overshoot={10} />
        </div>
      ) : null}
      <div
        className={cn(
          "page relative py-16 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-28",
          !dark && index !== 3 && index !== 0 && "border-t border-indigo/20",
        )}
      >
        <div className={cn("lg:col-span-5", mirrored && "lg:order-2 lg:col-start-8")}>
          <div className="flex items-end gap-4">
            <LetterTile
              letter={activity.letter}
              tone={dark ? "ivoire" : tileTones[index]}
              className="text-[72px] lg:text-[120px]"
            />
            <span
              className={cn(
                "pb-1 font-serif text-[1.5rem] leading-none lg:text-[2rem]",
                dark ? "text-ivoire/70" : "text-gris",
              )}
            >
              {index + 1}/{activities.length}
            </span>
          </div>
          <h2 id={`${activity.slug}-titre`} className="titre-1 mt-6 text-balance lg:mt-8">
            {activity.name}
          </h2>
          {activity.rhythm ? <p className="surtitre mt-4">{activity.rhythm}</p> : null}
        </div>

        <div className={cn("mt-6 lg:col-span-6 lg:mt-3", !mirrored && "lg:col-start-7")}>
          <p className="font-serif text-[1.375rem] leading-snug lg:text-[1.75rem]">
            {activity.paragraphs[0]}
          </p>
          {activity.paragraphs.slice(1).map((paragraph) => (
            <p
              key={paragraph}
              className={cn(
                "mt-5 max-w-(--container-lecture) text-[1.0625rem]",
                dark ? "text-ivoire/80" : "text-gris",
              )}
            >
              {paragraph}
            </p>
          ))}
          {activity.feature ? (
            <aside className="mt-8 border-l-2 border-terracotta pl-5">
              <p className="surtitre">Concept associé</p>
              <p className="titre-3 mt-2">{activity.feature.title}</p>
              <p className="mt-2 max-w-[34rem] text-gris">{activity.feature.text}</p>
            </aside>
          ) : null}
          <NextDates events={events} dark={dark} />
          {activity.slug === "tournois-de-scrabble" ? (
            <Link
              href="/scrabble"
              className={cn(
                "mt-6 inline-flex min-h-11 items-center gap-1 font-semibold underline-offset-4 hover:underline",
                dark ? "text-terracotta-clair" : "text-terracotta-fonce",
              )}
            >
              Tournois, palmarès et records
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default async function ActivitiesPage() {
  const upcoming = await getUpcomingEvents();

  return (
    <>
      <PageIntro
        surtitre="Activités"
        letter="L"
        tone="terracotta"
        arc="c"
        title="Les cinq activités du club."
        aside={
          <nav aria-label="Aller à une activité">
            <ul className="-ml-2 flex flex-wrap gap-x-1">
              {activities.map((activity) => (
                <li key={activity.slug}>
                  <a
                    href={`#${activity.slug}`}
                    className="lien inline-flex min-h-11 items-center px-2"
                  >
                    {activity.shortName}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        }
      >
        Une rencontre en présentiel tous les quinze jours, deux heures au maximum.
      </PageIntro>

      {activities.map((activity, index) => (
        <ActivitySection
          key={activity.slug}
          activity={activity}
          index={index}
          events={upcoming.filter((event) => activity.types.includes(event.type))}
        />
      ))}

      <section aria-labelledby="suite-titre" className="bg-sable py-18 lg:py-28">
        <div className="page lg:grid lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <h2 id="suite-titre" className="titre-1">
              Toutes les dates sont dans l’agenda.
            </h2>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:col-span-5 lg:mt-0 lg:justify-end">
            <Link href="/events" className={buttonVariants({ variant: "principal", size: "lg" })}>
              Voir l’agenda
              <ArrowRight aria-hidden="true" />
            </Link>
            <ForVisitors>
              <Link
                href={membershipHref}
                className={buttonVariants({ variant: "contour", size: "lg" })}
              >
                Demander mon adhésion
              </Link>
            </ForVisitors>
          </div>
        </div>
      </section>
    </>
  );
}

import { Suspense } from "react";
import { BackToTop } from "@/components/layout/back-to-top";
import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { Tag } from "@/components/shared/event-row";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { activities, activityBySlug, eventTypeLabels } from "@/config/activities";
import { getArchive, type ArchiveEntry } from "@/features/events/queries";
import { ArchivedReviews } from "@/features/library/components/archived-reviews";
import { getArchivedReviews } from "@/features/library/queries";
import { ArchivedPalmares } from "@/features/scrabble/components/archived-palmares";
import { getPalmares } from "@/features/scrabble/queries";
import { eventDateParts } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Archives de l’Agora",
  description:
    "Les rencontres passées du club et leurs comptes rendus : débats, lectures, tournois, projections. Filtrables par activité et par année.",
  alternates: { canonical: "/archives" },
};

type Props = PageProps<"/archives">;

const href = (activity: string | undefined, year: string | undefined) => {
  const query = new URLSearchParams();
  if (activity) query.set("activite", activity);
  if (year) query.set("annee", year);
  const text = query.toString();
  return text ? `/archives?${text}` : "/archives";
};

function Chip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-pastille border px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200",
        active
          ? "border-indigo bg-indigo text-ivoire"
          : "border-indigo/25 hover:border-indigo hover:bg-indigo/5",
      )}
    >
      {children}
    </Link>
  );
}

function Entry({ entry }: { entry: ArchiveEntry }) {
  const date = eventDateParts(entry.startsAt);
  return (
    <article className="group relative grid grid-cols-[64px_1fr] gap-x-4 border-t border-indigo/20 py-6 lg:grid-cols-[120px_1fr] lg:gap-x-8 lg:py-8">
      <time dateTime={date.iso}>
        <span className="block font-serif text-[2.75rem] leading-none lg:text-[4rem]">
          {date.day}
        </span>
        <span className="surtitre mt-1 block">{date.month}</span>
      </time>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="accent">{eventTypeLabels[entry.type]}</Tag>
          {entry.reportPublishedAt ? <Tag tone="succes">Compte rendu</Tag> : null}
        </div>
        <h3 className="titre-3 mt-3 lg:text-[1.75rem]">
          <Link
            href={`/events/${entry.slug}`}
            className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
          >
            {entry.title}
          </Link>
        </h3>
        {(entry.reportExcerpt ?? entry.summary) ? (
          <p className="mt-1.5 max-w-[40rem] text-gris">{entry.reportExcerpt ?? entry.summary}</p>
        ) : null}
      </div>
    </article>
  );
}

async function Archive({ searchParams }: Pick<Props, "searchParams">) {
  const params = await searchParams;
  const activity = activityBySlug(
    typeof params.activite === "string" ? params.activite : undefined,
  );
  const [all, allReviews, allPalmares] = await Promise.all([
    getArchive(),
    getArchivedReviews(),
    getPalmares(),
  ]);
  const yearOf = (date: Date) => String(date.getUTCFullYear());
  const years = [
    ...new Set([
      ...all.map((entry) => yearOf(entry.startsAt)),
      ...allReviews.flatMap((review) => (review.approvedAt ? [yearOf(review.approvedAt)] : [])),
      ...allPalmares.map((entry) => yearOf(entry.startsAt)),
    ]),
  ].sort((a, b) => b.localeCompare(a));
  const year =
    typeof params.annee === "string" && years.includes(params.annee) ? params.annee : undefined;

  const entries = all.filter(
    (entry) =>
      (!activity || activity.types.includes(entry.type)) &&
      (!year || String(entry.startsAt.getUTCFullYear()) === year),
  );
  // Les fiches de lecture relèvent des Rendez-vous lecture.
  const reviews =
    activity && activity.slug !== "rendez-vous-lecture"
      ? []
      : allReviews.filter(
          (review) => !year || (review.approvedAt && yearOf(review.approvedAt) === year),
        );
  const palmares =
    activity && activity.slug !== "tournois-de-scrabble"
      ? []
      : allPalmares.filter((entry) => !year || yearOf(entry.startsAt) === year);
  const byYear = new Map<string, ArchiveEntry[]>();
  for (const entry of entries) {
    const key = String(entry.startsAt.getUTCFullYear());
    byYear.set(key, [...(byYear.get(key) ?? []), entry]);
  }

  if (all.length === 0 && allReviews.length === 0 && allPalmares.length === 0) {
    return (
      <EmptyState
        title="Les archives s’ouvriront avec les premières rencontres"
        action={
          <Link href="/events" className={buttonVariants({ variant: "contour" })}>
            Voir l’agenda
          </Link>
        }
      >
        Chaque rencontre passée paraîtra ici, avec son compte rendu quand il aura été rédigé.
      </EmptyState>
    );
  }

  return (
    <>
      <nav aria-label="Filtrer les archives" className="flex flex-col gap-4">
        <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <li>
            <Chip active={!activity} to={href(undefined, year)}>
              Toutes les activités
            </Chip>
          </li>
          {activities.map((item) => (
            <li key={item.slug}>
              <Chip active={activity?.slug === item.slug} to={href(item.slug, year)}>
                {item.shortName}
              </Chip>
            </li>
          ))}
        </ul>
        {years.length > 1 ? (
          <ul className="flex flex-wrap gap-2">
            <li>
              <Chip active={!year} to={href(activity?.slug, undefined)}>
                Toutes les années
              </Chip>
            </li>
            {years.map((item) => (
              <li key={item}>
                <Chip active={year === item} to={href(activity?.slug, item)}>
                  {item}
                </Chip>
              </li>
            ))}
          </ul>
        ) : null}
      </nav>

      {entries.length === 0 && reviews.length === 0 && palmares.length === 0 ? (
        <EmptyState
          title="Rien dans cette sélection"
          className="mt-10"
          action={
            <Link href="/archives" className={buttonVariants({ variant: "contour" })}>
              Voir toutes les archives
            </Link>
          }
        >
          Aucune rencontre passée ne correspond à ces filtres.
        </EmptyState>
      ) : (
        [...byYear.entries()].map(([label, items]) => (
          <section
            key={label}
            aria-label={label}
            className="mt-12 lg:mt-20 lg:grid lg:grid-cols-12 lg:gap-8"
          >
            <h2 className="titre-1 lg:sticky lg:top-32 lg:col-span-3 lg:self-start">{label}</h2>
            <div className="mt-5 border-b border-indigo/20 lg:col-span-9 lg:mt-0">
              {items.map((entry) => (
                <Entry key={entry.slug} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}
      {palmares.length > 0 ? <ArchivedPalmares entries={palmares} /> : null}
      {reviews.length > 0 ? <ArchivedReviews reviews={reviews} /> : null}
    </>
  );
}

function ArchiveSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-11 w-full max-w-xl rounded-pastille!" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="skeleton mt-6 h-24 w-full" />
      ))}
    </div>
  );
}

export default function ArchivesPage({ searchParams }: Props) {
  return (
    <>
      <PageIntro
        surtitre="Archives de l’Agora"
        letter="M"
        tone="clair"
        arc="b"
        title="La mémoire des rencontres."
      >
        Synthèses des débats, livres discutés, films projetés, résultats des tournois&nbsp;: ce que
        le club produit, rencontre après rencontre.
      </PageIntro>
      <div className="page py-10 lg:py-20">
        <Suspense fallback={<ArchiveSkeleton />}>
          <Archive searchParams={searchParams} />
        </Suspense>
      </div>
      <BackToTop />
    </>
  );
}

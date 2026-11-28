import { activityLabels } from "@/config/activities";
import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ActivityTags, Tag } from "@/components/shared/event-row";
import { site } from "@/config/site";
import {
  RegistrationPanel,
  RegistrationPanelSkeleton,
} from "@/features/events/components/registration-panel";
import { getEventBySlug, getEventReport, getPublishedEventSlugs } from "@/features/events/queries";
import { parseProgram, placeLabel } from "@/features/events/rules";
import { Markdown } from "@/lib/markdown";
import { eventDateParts, formatFullDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env";

type Props = PageProps<"/events/[slug]">;

/**
 * Rendu bloquant assumé : une rencontre créée après le build, ou une page régénérée après une
 * modification, est rendue en entier avant d'être envoyée (pas de squelette). Sans cette ligne,
 * Next refuse à l'exécution la lecture de `params` hors <Suspense> (erreur 500).
 */
export const instant = false;

/**
 * Les rencontres déjà publiées au build sont prérendues : leur titre arrive dans le premier HTML
 * au lieu d'attendre le flux (LCP mobile). Une rencontre créée ensuite est rendue à la demande.
 */
export async function generateStaticParams() {
  const slugs = await getPublishedEventSlugs();
  // Next exige au moins une entrée ; une base vide prérend une adresse qui répond « introuvable ».
  return (slugs.length > 0 ? slugs : ["rencontre-introuvable"]).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return { title: "Rencontre introuvable", robots: { index: false } };
  const description =
    `${formatFullDate(event.startsAt)}, ${formatTime(event.startsAt)} · ${placeLabel(event.location)}. ${event.summary ?? ""}`
      .trim()
      .slice(0, 200);
  return {
    title: event.title,
    description,
    alternates: { canonical: `/events/${event.slug}` },
    openGraph: { type: "article", title: event.title, description },
  };
}

async function EventSheet({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();
  const date = eventDateParts(event.startsAt);
  const cancelled = event.status === "CANCELLED";
  const steps = parseProgram(event.program);
  const report = event.reportPublishedAt ? await getEventReport(event.id) : null;

  const practical = [
    ["Date", `${formatFullDate(event.startsAt)}${event.isTentative ? " (date provisoire)" : ""}`],
    [
      "Horaire",
      event.endsAt ? `De ${date.time} à ${formatTime(event.endsAt)}` : `À partir de ${date.time}`,
    ],
    ["Lieu", placeLabel(event.location)],
    ["Pour qui", event.isPublic ? "Ouvert à tous, membres ou non" : "Réservé aux membres du club"],
    [
      "Places",
      event.capacity ? `${event.capacity} place${event.capacity > 1 ? "s" : ""}` : "Sans limite",
    ],
    ["Participation", "Sur inscription"],
  ];

  return (
    <article className="page pt-6 pb-28 lg:pt-10 lg:pb-28">
      <Link
        href="/events"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Agenda
      </Link>

      {/* En-tête : la date en très grand, comme sur un billet. */}
      <header className="mt-4 border-b border-indigo/20 pb-8 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-8 lg:pb-14">
        <time dateTime={date.iso} className="flex items-baseline gap-3 lg:col-span-3 lg:block">
          <span className="font-serif text-[5.5rem] leading-[0.85] lg:text-[11rem]">
            {date.day}
          </span>
          <span className="lg:mt-3 lg:block">
            <span className="surtitre block">{date.month}</span>
            <span className="petit mt-1 block font-semibold">
              {date.weekday}, {date.time}
            </span>
          </span>
        </time>
        <div className="mt-6 lg:col-span-8 lg:col-start-5 lg:mt-0">
          <div className="flex flex-wrap items-center gap-2">
            <ActivityTags labels={activityLabels(event)} />
            <Tag>{event.isPublic ? "Ouvert au public" : "Réservé aux membres"}</Tag>
            {event.isTentative ? <Tag tone="alerte">Date provisoire</Tag> : null}
            {cancelled ? <Tag tone="erreur">Annulé</Tag> : null}
          </div>
          <h1 className="titre-1 mt-4 lg:text-[3.75rem]">{event.title}</h1>
          {event.summary ? <p className="chapo mt-4 text-gris">{event.summary}</p> : null}
        </div>
      </header>

      <div className="mt-10 lg:mt-16 lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6 lg:col-start-1">
          {report ? (
            <section aria-labelledby="compte-rendu-titre" className="mb-12 lg:mb-16">
              <h2 id="compte-rendu-titre" className="surtitre">
                Compte rendu
              </h2>
              <div className="mt-4 max-w-(--container-lecture) text-[1.0625rem]">
                <Markdown source={report} lettrine />
              </div>
            </section>
          ) : null}

          <h2 className="surtitre">La rencontre</h2>
          <div className="mt-4 max-w-(--container-lecture) space-y-4 text-[1.0625rem] leading-[1.7]">
            {event.description.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>

          {event.speakerName ? (
            <aside className="mt-10 border-l-2 border-terracotta pl-5">
              <p className="surtitre">L’Invité de l’Agora</p>
              <p className="titre-2 mt-2">{event.speakerName}</p>
              {event.speakerTitle ? <p className="mt-1 text-gris">{event.speakerTitle}</p> : null}
              <p className="petit mt-2 font-semibold">
                {event.speakerMode === "REMOTE" ? "En visioconférence" : "Sur place"}
              </p>
            </aside>
          ) : null}

          {steps.length > 0 ? (
            <>
              <h2 className="surtitre mt-12">Le programme</h2>
              <ol className="mt-3 border-b border-indigo/20">
                {steps.map((step) => (
                  <li
                    key={`${step.time}-${step.label}`}
                    className="grid grid-cols-1 gap-x-4 gap-y-0.5 border-t border-indigo/20 py-3.5 sm:grid-cols-[10.5rem_1fr]"
                  >
                    <span className="font-semibold text-terracotta-fonce tabular-nums">
                      {step.time}
                    </span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          <h2 className="surtitre mt-12">En pratique</h2>
          <dl className="mt-3 border-t border-indigo/20">
            {practical.map(([label, value]) => (
              <div
                key={label}
                className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-indigo/20 py-3.5"
              >
                <dt className="petit pt-0.5 text-gris">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Inscription : un panneau qui suit la lecture sur desktop. */}
        <aside className="mt-12 lg:col-span-5 lg:col-start-8 lg:mt-0">
          <div className="rounded-feuille bg-blanc p-5 sm:p-7 lg:sticky lg:top-32">
            <Suspense fallback={<RegistrationPanelSkeleton />}>
              <RegistrationPanel event={event} />
            </Suspense>
          </div>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Event",
            name: event.title,
            // Les activités de la rencontre (principale d'abord) : schema.org n'a pas de champ
            // dédié ; `keywords` les expose aux moteurs de recherche.
            keywords: activityLabels(event).join(", "),
            startDate: event.startsAt.toISOString(),
            ...(event.endsAt ? { endDate: event.endsAt.toISOString() } : {}),
            eventStatus: cancelled
              ? "https://schema.org/EventCancelled"
              : "https://schema.org/EventScheduled",
            eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
            location: { "@type": "Place", name: event.location ?? site.city, address: site.city },
            description: event.summary ?? event.description.slice(0, 200),
            organizer: { "@type": "Organization", name: site.name, url: env.APP_URL },
          }),
        }}
      />
    </article>
  );
}

/**
 * Pas de <Suspense> autour de la fiche : son contenu est lu en cache et prérendu, il arrive donc
 * dans le premier HTML. Un squelette affiché d'abord retardait le titre (LCP) et déplaçait le
 * pied de page à son remplacement (CLS). Seul le panneau d'inscription, propre à chaque visiteur,
 * garde son squelette.
 */
export default function EventPage({ params }: Props) {
  return <EventSheet params={params} />;
}

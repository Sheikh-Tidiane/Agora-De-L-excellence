import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

type EventRowProps = {
  href: string;
  title: string;
  /** Jour du mois, ex. « 21 ». */
  day: string;
  /** Mois abrégé, ex. « nov. ». */
  month: string;
  weekday: string;
  time: string;
  iso: string;
  /** Activité, ou activités de la rencontre (principale d'abord). */
  type: string | readonly string[];
  place: string;
  /** Événement ouvert au public (sinon réservé aux membres). */
  open: boolean;
  summary?: string;
  /** Date annoncée à titre provisoire. */
  tentative?: boolean;
  className?: string;
};

export function Tag({
  children,
  tone = "neutre",
}: {
  children: React.ReactNode;
  tone?: "neutre" | "accent" | "contour" | "succes" | "alerte" | "erreur";
}) {
  const tones = {
    neutre: "bg-sable text-indigo",
    // Activité secondaire d'une rencontre : distincte de « Ouvert au public » (neutre).
    contour: "text-indigo ring-1 ring-inset ring-indigo/50",
    accent: "bg-indigo text-ivoire",
    succes: "bg-succes-fond text-succes",
    alerte: "bg-alerte-fond text-alerte",
    erreur: "bg-erreur-fond text-erreur",
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-pastille px-3 text-[0.8125rem] font-semibold whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/**
 * Une rencontre dans l'agenda : la date en grand à gauche, comme sur un billet.
 * Les lignes sont séparées par un filet, sans boîte.
 */
export function EventRow({
  href,
  title,
  day,
  month,
  weekday,
  time,
  iso,
  type,
  place,
  open,
  summary,
  tentative,
  className,
}: EventRowProps) {
  return (
    <article
      className={cn(
        "group relative grid grid-cols-[64px_1fr] gap-x-4 border-t border-indigo/20 py-6 lg:grid-cols-[120px_1fr_auto] lg:items-center lg:gap-x-8 lg:py-8",
        className,
      )}
    >
      <time dateTime={iso} className="row-span-2 lg:row-span-1">
        <span className="block font-serif text-[2.75rem] leading-none lg:text-[4.5rem]">{day}</span>
        <span className="surtitre mt-1 block">{month}</span>
      </time>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <ActivityTags labels={typeof type === "string" ? [type] : type} />
          <Tag>{open ? "Ouvert au public" : "Réservé aux membres"}</Tag>
          {tentative ? <Tag tone="alerte">Date provisoire</Tag> : null}
        </div>
        <h3 className="titre-3 mt-3 lg:text-[1.75rem]">
          <Link href={href} className="after:absolute after:inset-0">
            {title}
          </Link>
        </h3>
        {summary ? <p className="mt-1.5 max-w-[38rem] text-gris">{summary}</p> : null}
        <p className="petit mt-2 font-semibold">
          {weekday}, {time} · {place}
        </p>
      </div>

      <span
        aria-hidden="true"
        className="hidden size-12 place-items-center rounded-full border border-indigo/25 transition-colors duration-200 ease-agora group-hover:bg-indigo group-hover:text-ivoire lg:grid"
      >
        <ArrowUpRight className="size-5" />
      </span>
    </article>
  );
}

/** Activités d'une rencontre : la principale en étiquette pleine, les autres en contour. */
export function ActivityTags({ labels }: { labels: readonly string[] }) {
  return (
    <>
      {labels.map((label, index) => (
        <Tag key={label} tone={index === 0 ? "accent" : "contour"}>
          {label}
        </Tag>
      ))}
    </>
  );
}

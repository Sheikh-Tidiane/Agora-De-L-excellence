import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { getFeaturedLaunch } from "@/features/events/queries";
import { parseProgram, placeLabel } from "@/features/events/rules";
import { eventDateParts, formatMonthYear } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ForVisitors } from "@/components/layout/by-viewer";

/**
 * Le lancement du club, mis en avant tant qu'il n'est pas passé : la date en très grand, comme
 * sur une affiche, et le déroulé de l'après-midi. La section disparaît d'elle-même ensuite.
 */
export async function LaunchSection() {
  const launch = await getFeaturedLaunch();
  if (!launch) return null;
  const date = eventDateParts(launch.startsAt);
  const steps = parseProgram(launch.program);

  return (
    <section aria-labelledby="lancement-titre" className="sur-indigo bg-indigo text-ivoire">
      <div className="page py-14 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-28">
        <div className="lg:col-span-5">
          <p className="surtitre">Le lancement</p>
          <time dateTime={date.iso} className="mt-4 flex items-end gap-4 lg:mt-6 lg:gap-6">
            <span className="font-serif text-[7.5rem] leading-[0.78] text-terracotta-clair lg:text-[15rem]">
              {date.day}
            </span>
            <span className="pb-1 lg:pb-3">
              <span className="block font-serif text-[1.5rem] leading-tight capitalize lg:text-[2.25rem]">
                {formatMonthYear(launch.startsAt)}
              </span>
              <span className="mt-1 block font-semibold text-ivoire/80">
                {date.weekday}, à partir de {date.time}
              </span>
            </span>
          </time>
          <p className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-[0.9375rem] font-semibold text-terracotta-clair lg:mt-10">
            {launch.isTentative ? <span>Date provisoire</span> : null}
            {launch.isTentative ? <span aria-hidden="true">·</span> : null}
            <span>{placeLabel(launch.location)}</span>
          </p>
        </div>

        <div className="mt-8 lg:col-span-6 lg:col-start-7 lg:mt-0">
          <h2 id="lancement-titre" className="titre-1">
            {launch.title}
          </h2>
          {launch.summary ? <p className="chapo mt-4 text-ivoire/80">{launch.summary}</p> : null}

          {steps.length > 0 ? (
            <ol className="mt-8 hidden border-b border-ivoire/20 lg:block">
              {steps.map((step) => (
                <li
                  key={`${step.time}-${step.label}`}
                  className="grid grid-cols-[10.5rem_1fr] gap-4 border-t border-ivoire/20 py-3"
                >
                  <span className="font-semibold text-terracotta-clair tabular-nums">
                    {step.time}
                  </span>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            <Link
              href={`/events/${launch.slug}`}
              className={cn(buttonVariants({ variant: "clair", size: "lg" }), "max-sm:w-full")}
            >
              <span className="lg:hidden">Voir le programme</span>
              <span className="max-lg:hidden">S’inscrire au lancement</span>
              <ArrowRight aria-hidden="true" />
            </Link>
            <ForVisitors>
              <Link
                href={membershipHref}
                className="lien inline-flex min-h-11 items-center max-sm:justify-center"
              >
                Demander mon adhésion
              </Link>
            </ForVisitors>
          </div>
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { EventList } from "@/features/events/components/event-list";
import { getUpcomingEvents } from "@/features/events/queries";
import { cn } from "@/lib/utils";

export async function EventsSection() {
  const events = await getUpcomingEvents(4);

  return (
    <section
      id="evenements"
      aria-labelledby="evenements-titre"
      className="page scroll-mt-(--hauteur-entete) py-18 lg:py-36"
    >
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:sticky lg:top-32 lg:col-span-4 lg:self-start">
          <p className="surtitre">Agenda</p>
          <h2 id="evenements-titre" className="titre-1 mt-3">
            Les prochaines rencontres
          </h2>
          <p className="mt-4 max-w-[24rem] text-gris">
            Une rencontre en présentiel tous les quinze jours, deux heures au maximum. Celles qui
            sont ouvertes au public sont signalées.
          </p>
          <Link
            href="/events"
            className={cn(buttonVariants({ variant: "contour" }), "mt-7 hidden lg:inline-flex")}
          >
            Tout l’agenda
          </Link>
        </div>

        {events.length > 0 ? (
          <EventList events={events} className="mt-8 lg:col-span-8 lg:mt-0" />
        ) : (
          <EmptyState
            title="Aucune rencontre annoncée pour l’instant"
            className="lg:col-span-7 lg:col-start-6 lg:py-0"
          >
            Les prochaines dates paraîtront ici dès qu’elles seront fixées.
          </EmptyState>
        )}
      </div>
      <Link
        href="/events"
        className={cn(buttonVariants({ variant: "contour", largeur: "pleine" }), "mt-8 lg:hidden")}
      >
        Tout l’agenda
      </Link>
    </section>
  );
}

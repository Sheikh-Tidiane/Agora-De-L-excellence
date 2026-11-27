import { activityLabels } from "@/config/activities";
import { EventRow } from "@/components/shared/event-row";
import { Reveal } from "@/components/shared/motion";
import type { PublicEvent } from "@/features/events/queries";
import { placeLabel } from "@/features/events/rules";
import { eventDateParts } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Liste d'agenda : une rencontre par ligne, séparées par un filet. */
export function EventList({ events, className }: { events: PublicEvent[]; className?: string }) {
  return (
    <ul className={cn("border-b border-indigo/20", className)}>
      {events.map((event, i) => {
        const date = eventDateParts(event.startsAt);
        return (
          <li key={event.slug}>
            <Reveal delay={Math.min(i, 5) * 0.05}>
              <EventRow
                href={`/events/${event.slug}`}
                title={event.title}
                day={date.day}
                month={date.month}
                weekday={date.weekday}
                time={date.time}
                iso={date.iso}
                type={activityLabels(event)}
                place={placeLabel(event.location)}
                tentative={event.isTentative}
                open={event.isPublic}
                summary={event.summary ?? undefined}
              />
            </Reveal>
          </li>
        );
      })}
    </ul>
  );
}

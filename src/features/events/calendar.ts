import { placeLabel } from "@/features/events/rules";
import { googleCalendarUrl, toIcs, type CalendarEvent } from "@/lib/calendar";

/**
 * Agenda d'une rencontre : fichier .ics (route /events/<slug>/agenda.ics) et lien Google Agenda.
 * Seules des informations publiques y figurent : jamais le lien de visio.
 */
export type CalendarSource = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  status: string;
  updatedAt: Date;
};

export function toCalendarEvent(event: CalendarSource, appUrl: string): CalendarEvent {
  const url = `${appUrl}/events/${event.slug}`;
  return {
    uid: `${event.id}@${new URL(appUrl).hostname}`,
    title: event.title,
    description: [event.summary, `Détails et inscription : ${url}`].filter(Boolean).join("\n\n"),
    location: event.location ? placeLabel(event.location) : null,
    url,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    cancelled: event.status === "CANCELLED",
    sequence: Math.floor(event.updatedAt.getTime() / 1000),
    stamp: event.updatedAt,
  };
}

export function calendarLinks(event: CalendarSource, appUrl: string) {
  return {
    ics: `${appUrl}/events/${event.slug}/agenda.ics`,
    google: googleCalendarUrl(toCalendarEvent(event, appUrl)),
  };
}

export const eventIcs = (event: CalendarSource, appUrl: string) =>
  toIcs(toCalendarEvent(event, appUrl));

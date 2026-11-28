import { CLUB_TIME_ZONE } from "@/lib/dates";

/**
 * « Ajouter à mon agenda » : fichier iCalendar (RFC 5545) et lien Google Agenda, sans dépendance.
 * Les heures sont écrites dans le fuseau du club (Africa/Dakar, UTC+0 sans heure d'été, donc
 * l'heure UTC est l'heure locale), avec la définition du fuseau dans le fichier.
 */
export type CalendarEvent = {
  /** Identifiant stable : le même événement remplace l'ancien dans l'agenda. */
  uid: string;
  title: string;
  description: string;
  location: string | null;
  url: string;
  startsAt: Date;
  endsAt: Date | null;
  cancelled: boolean;
  /** Augmente à chaque modification : l'agenda prend la version la plus récente. */
  sequence: number;
  stamp: Date;
};

/** Durée retenue quand la rencontre n'a pas d'heure de fin. */
export const DEFAULT_DURATION_HOURS = 2;

const pad = (n: number) => String(n).padStart(2, "0");

/** « 20261205T180000 » : heure de Dakar (= UTC). */
function localStamp(date: Date): string {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

export const endOf = (event: Pick<CalendarEvent, "startsAt" | "endsAt">) =>
  event.endsAt && event.endsAt > event.startsAt
    ? event.endsAt
    : new Date(event.startsAt.getTime() + DEFAULT_DURATION_HOURS * 3_600_000);

/** Texte d'une propriété : \ ; , et retours à la ligne échappés. */
export function escapeIcsText(value: string): string {
  return (
    value
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n|\r|\n/g, "\\n")
      // Autres caractères de contrôle : retirés (interdits dans une valeur iCalendar).
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
  );
}

/** Ligne repliée à 75 octets UTF-8 au plus (continuation : CRLF + espace), sans couper un caractère. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    const limit = parts.length === 0 ? 75 : 74; // la continuation commence par une espace
    if (size + bytes > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function toIcs(event: CalendarEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//L'Agora de l'Excellence//Rencontres//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    `TZID:${CLUB_TIME_ZONE}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${localStamp(event.stamp)}Z`,
    `SEQUENCE:${event.sequence}`,
    `DTSTART;TZID=${CLUB_TIME_ZONE}:${localStamp(event.startsAt)}`,
    `DTEND;TZID=${CLUB_TIME_ZONE}:${localStamp(endOf(event))}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeIcsText(event.location)}`] : []),
    `URL:${event.url}`,
    `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}

/** Lien « Ajouter à Google Agenda » (heures en UTC, fuseau d'affichage Africa/Dakar). */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${localStamp(event.startsAt)}Z/${localStamp(endOf(event))}Z`,
    details: event.description,
    ctz: CLUB_TIME_ZONE,
  });
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

import { describe, expect, it } from "vitest";
import {
  escapeIcsText,
  foldIcsLine,
  googleCalendarUrl,
  toIcs,
  type CalendarEvent,
} from "@/lib/calendar";

const event: CalendarEvent = {
  uid: "ckx1@agora.test",
  title: "Rendez-vous lecture : « L’Aventure ambiguë »",
  description: "Lecture partagée, débat.\nDétails : https://agora.test/events/aventure",
  location: "Maison de la culture, Dakar",
  url: "https://agora.test/events/aventure",
  startsAt: new Date("2026-12-05T18:00:00Z"),
  endsAt: null,
  cancelled: false,
  sequence: 7,
  stamp: new Date("2026-11-28T09:30:00Z"),
};

describe("agenda (.ics, Google Agenda)", () => {
  it("échappe le texte et replie les lignes à 75 octets sans couper un caractère accentué", () => {
    expect(escapeIcsText("a;b,c\\d\ne")).toBe(String.raw`a\;b\,c\\d\ne`);
    const line = `SUMMARY:${"é".repeat(60)}`;
    const folded = foldIcsLine(line);
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });

  it("fichier iCalendar : fuseau Africa/Dakar, fin par défaut à +2 h, lieu, lien, CRLF", () => {
    const ics = toIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("TZID:Africa/Dakar");
    expect(ics).toContain("DTSTART;TZID=Africa/Dakar:20261205T180000");
    expect(ics).toContain("DTEND;TZID=Africa/Dakar:20261205T200000");
    expect(ics).toContain("LOCATION:Maison de la culture\\, Dakar");
    expect(ics).toContain("URL:https://agora.test/events/aventure");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("SEQUENCE:7");
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    const ended = toIcs({ ...event, endsAt: new Date("2026-12-05T21:30:00Z"), cancelled: true });
    expect(ended).toContain("DTEND;TZID=Africa/Dakar:20261205T213000");
    expect(ended).toContain("STATUS:CANCELLED");
  });

  it("lien Google Agenda : dates UTC, fuseau d'affichage, titre et lieu", () => {
    const url = new URL(googleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("dates")).toBe("20261205T180000Z/20261205T200000Z");
    expect(url.searchParams.get("ctz")).toBe("Africa/Dakar");
    expect(url.searchParams.get("text")).toBe(event.title);
    expect(url.searchParams.get("location")).toBe(event.location);
    expect(
      new URL(googleCalendarUrl({ ...event, location: null })).searchParams.has("location"),
    ).toBe(false);
  });
});

/**
 * Dates du club : toujours affichées à l'heure de Dakar (UTC+0, sans heure d'été),
 * quel que soit le fuseau du serveur ou du visiteur.
 */
export const CLUB_TIME_ZONE = "Africa/Dakar";

const make = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: CLUB_TIME_ZONE, ...options });

const formats = {
  long: make({ day: "numeric", month: "long", year: "numeric" }),
  full: make({ weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  short: make({ day: "2-digit", month: "2-digit", year: "numeric" }),
  day: make({ day: "numeric" }),
  monthShort: make({ month: "short" }),
  monthLong: make({ month: "long" }),
  monthYear: make({ month: "long", year: "numeric" }),
  weekday: make({ weekday: "long" }),
  parts: make({ hour: "numeric", minute: "2-digit", hour12: false }),
  dateMedium: make({ dateStyle: "medium" }),
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** « 21 novembre 2026 » */
export const formatDate = (date: Date) => formats.long.format(date);
/** « samedi 21 novembre 2026 » */
export const formatFullDate = (date: Date) => formats.full.format(date);
/** « 21/11/2026 » */
export const formatShortDate = (date: Date) => formats.short.format(date);
/** « 21 nov. 2026, 16 h » : l'heure à la française, comme partout sur le site. */
export const formatDateTime = (date: Date) =>
  `${formats.dateMedium.format(date)}, ${formatTime(date)}`;
/** « Novembre » */
export const formatMonth = (date: Date) => capitalize(formats.monthLong.format(date));
/** « novembre 2026 » */
export const formatMonthYear = (date: Date) => formats.monthYear.format(date);

/** Heure à la française : « 16 h » ou « 16 h 30 ». */
export function formatTime(date: Date): string {
  const parts = formats.parts.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  // Espaces insécables : « 16 h » ne se coupe jamais en fin de ligne.
  return minute === "00" ? `${hour} h` : `${hour} h ${minute}`;
}

/** Morceaux d'une date pour une ligne d'agenda : « 21 », « nov. », « Samedi », « 16 h ». */
export function eventDateParts(date: Date) {
  return {
    day: formats.day.format(date),
    month: formats.monthShort.format(date),
    weekday: capitalize(formats.weekday.format(date)),
    time: formatTime(date),
    iso: date.toISOString(),
  };
}

/** Premier jour (UTC) du mois de `date`, vu de Dakar : clé de `MonthlySelection.month`. */
export function monthStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Ajoute des mois à une date (fin de mois gérée par l'horloge UTC). */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

/** Valeur d'un champ `datetime-local` (heure de Dakar = UTC) → Date. `null` si vide ou invalide. */
export function parseLocalDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → valeur d'un champ `datetime-local`, à l'heure de Dakar. */
export function toLocalDateTime(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 16) : "";
}

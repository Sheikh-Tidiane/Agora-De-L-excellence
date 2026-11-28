import { eventActivities, eventTypeLabels, type EventTypeCode } from "@/config/activities";
import { displayAverage } from "@/features/feedback/rules";
import { addMonths } from "@/lib/dates";

/**
 * Statistiques pour le comité (docs/REGLES-METIER.md, « Statistiques ») : fonctions pures,
 * testées sans base. Dakar est à UTC+0 sans heure d'été : périodes et mois en UTC.
 */
const DAY = 86_400_000;

export type ActivityMode = "all" | "primary";
export const INACTIVITY_WEEKS_DEFAULT = 6;
export const INACTIVITY_WEEKS_MIN = 2;
export const INACTIVITY_WEEKS_MAX = 26;
/** Version partenaires : un effectif de personnes plus petit est masqué (« < 3 »). */
export const SMALL_COUNT = 3;
/** Version partenaires : un taux n'est donné que sur au moins 5 personnes. */
export const MIN_RATE_BASE = 5;

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
/** Date « AAAA-MM-JJ » réelle (pas de 30 février), ou `null`. */
export const day = (value: string | undefined) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);

export type StatsPeriod = {
  /** Dates demandées invalides : préréglage « 12 mois » appliqué à la place. */
  fallback?: boolean;
  from: Date;
  /** Fin exclue (lendemain du dernier jour). */
  toExcl: Date;
  preset: "3m" | "12m" | "annee" | "libre";
  du: string;
  au: string;
};

/**
 * Période choisie : préréglage (3 mois, 12 mois, année en cours) ou dates « du … au … », bornes
 * incluses. Dates invalides, à l'envers ou plus de 5 ans : 12 derniers mois.
 */
export function parseStatsPeriod(
  query: Record<string, string | string[] | undefined>,
  now: Date,
): StatsPeriod {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const tomorrow = new Date(today.getTime() + DAY);
  const make = (from: Date, toExcl: Date, preset: StatsPeriod["preset"]): StatsPeriod => ({
    from,
    toExcl,
    preset,
    du: iso(from),
    au: iso(new Date(toExcl.getTime() - DAY)),
  });
  const preset = one(query.periode);
  if (preset === "3m") return make(addMonths(today, -3), tomorrow, "3m");
  if (preset === "annee") {
    return make(new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), tomorrow, "annee");
  }
  const du = day(one(query.du));
  const au = day(one(query.au));
  if (preset !== "12m" && du && au && du <= au && au.getTime() - du.getTime() <= 5 * 366 * DAY) {
    return make(du, new Date(au.getTime() + DAY), "libre");
  }
  return {
    ...make(addMonths(today, -12), tomorrow, "12m"),
    fallback: preset !== "12m" && Boolean(one(query.du) || one(query.au)),
  };
}

/** Seuil d'inactivité en semaines (2 à 26, 6 par défaut). */
export function parseThreshold(value: string | string[] | undefined): number {
  const n = Number(one(value));
  return Number.isInteger(n) && n >= INACTIVITY_WEEKS_MIN && n <= INACTIVITY_WEEKS_MAX
    ? n
    : INACTIVITY_WEEKS_DEFAULT;
}

/** Activités sous lesquelles une rencontre compte : toutes, ou la principale seule. */
export function countedActivities(
  event: { type: EventTypeCode; activities?: readonly EventTypeCode[] | null },
  mode: ActivityMode,
): EventTypeCode[] {
  return mode === "primary" ? [event.type] : eventActivities(event);
}

export type StatsEvent = {
  id: string;
  title: string;
  startsAt: Date;
  type: EventTypeCode;
  activities: EventTypeCode[];
  capacity: number | null;
  registrations: {
    status: "PENDING" | "CONFIRMED" | "CANCELLED" | "WAITLISTED";
    attendedAt: Date | null;
    waitlistedAt: Date | null;
    promotedAt: Date | null;
  }[];
  ratings: number[];
};

export type AttendanceRow = {
  id: string;
  title: string;
  startsAt: Date;
  registered: number;
  present: number;
  /** Présents / inscrits (0 à 1), `null` sans inscrit. */
  rate: number | null;
};

const ratio = (part: number, whole: number) => (whole > 0 ? Math.min(1, part / whole) : null);

/** Par rencontre : inscrits confirmés, présents, taux de présence. */
export function attendanceRows(events: readonly StatsEvent[]): AttendanceRow[] {
  return events.map((event) => {
    const registered = event.registrations.filter((r) => r.status === "CONFIRMED").length;
    const present = event.registrations.filter(
      (r) => r.status === "CONFIRMED" && r.attendedAt !== null,
    ).length;
    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      registered,
      present,
      rate: ratio(present, registered),
    };
  });
}

/** Synthèse : taux global (présents / inscrits sur la période), moyenne des taux, présents moyens. */
export function attendanceSummary(rows: readonly AttendanceRow[]) {
  const registered = rows.reduce((total, row) => total + row.registered, 0);
  const present = rows.reduce((total, row) => total + row.present, 0);
  const rates = rows.flatMap((row) => (row.rate === null ? [] : [row.rate]));
  return {
    events: rows.length,
    registered,
    present,
    rate: ratio(present, registered),
    averageRate: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
    averagePresent: rows.length ? present / rows.length : null,
  };
}

/** Présents par mois (clé « AAAA-MM »), mois vides compris. */
export function monthKeys(from: Date, toExcl: Date): string[] {
  const keys: string[] = [];
  let cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor < toExcl) {
    keys.push(cursor.toISOString().slice(0, 7));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return keys;
}

export function presentByMonth(rows: readonly AttendanceRow[], from: Date, toExcl: Date) {
  const totals = new Map(monthKeys(from, toExcl).map((key) => [key, { present: 0, events: 0 }]));
  for (const row of rows) {
    const entry = totals.get(row.startsAt.toISOString().slice(0, 7));
    if (!entry) continue;
    entry.present += row.present;
    entry.events += 1;
  }
  return [...totals.entries()].map(([month, value]) => ({ month, ...value }));
}

export type ActivityStat = {
  code: EventTypeCode;
  label: string;
  events: number;
  present: number;
  averagePresent: number;
  ratings: number;
  /** Note moyenne (à partir de 3 avis), sinon `null`. */
  averageRating: number | null;
};

/** Activités les plus suivies : présences et note moyenne, triées par présences. */
export function activityStats(events: readonly StatsEvent[], mode: ActivityMode): ActivityStat[] {
  const byCode = new Map<
    EventTypeCode,
    { events: number; present: number; sum: number; count: number }
  >();
  for (const event of events) {
    const present = event.registrations.filter(
      (r) => r.status === "CONFIRMED" && r.attendedAt !== null,
    ).length;
    const sum = event.ratings.reduce((a, b) => a + b, 0);
    for (const code of countedActivities(event, mode)) {
      const entry = byCode.get(code) ?? { events: 0, present: 0, sum: 0, count: 0 };
      entry.events += 1;
      entry.present += present;
      entry.sum += sum;
      entry.count += event.ratings.length;
      byCode.set(code, entry);
    }
  }
  return [...byCode.entries()]
    .map(([code, entry]) => ({
      code,
      label: eventTypeLabels[code],
      events: entry.events,
      present: entry.present,
      averagePresent: entry.present / entry.events,
      ratings: entry.count,
      averageRating: displayAverage(entry.sum, entry.count),
    }))
    .sort((a, b) => b.present - a.present || a.label.localeCompare(b.label, "fr"));
}

/** Nouveaux membres par mois : date de la première adhésion validée de chacun. */
export function newMembersByMonth(firstStarts: readonly Date[], from: Date, toExcl: Date) {
  const totals = new Map(monthKeys(from, toExcl).map((key) => [key, 0]));
  for (const start of firstStarts) {
    if (start < from || start >= toExcl) continue;
    const key = start.toISOString().slice(0, 7);
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }
  return [...totals.entries()].map(([month, count]) => ({ month, count }));
}

/**
 * Début de l'adhésion en cours, renouvellements compris : on remonte les adhésions qui se suivent
 * (moins d'un jour d'écart). Une interruption (départ puis retour) repart du retour.
 */
export function continuousSince(
  memberships: readonly { startsAt: Date; endsAt: Date }[],
  at: Date,
): Date | null {
  const sorted = [...memberships].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const index = sorted.findLastIndex((m) => m.startsAt <= at && m.endsAt > at);
  if (index < 0) return null;
  let start = sorted[index]!.startsAt;
  for (let i = index - 1; i >= 0; i--) {
    if (sorted[i]!.endsAt.getTime() + DAY < start.getTime()) break;
    if (sorted[i]!.startsAt < start) start = sorted[i]!.startsAt;
  }
  return start;
}

export type CurrentMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  memberNumber: string | null;
  memberSince: Date;
};

/**
 * Membres qui ne reviennent plus : adhérents à jour dont la dernière présence et le début de
 * l'adhésion en cours sont tous deux plus anciens que le seuil (un membre qui vient de revenir
 * au club n'est pas relancé). Les plus anciens d'abord.
 */
export function inactiveMembers(
  members: readonly CurrentMember[],
  lastAttended: ReadonlyMap<string, Date>,
  now: Date,
  weeks: number,
) {
  const limit = new Date(now.getTime() - weeks * 7 * DAY);
  return members
    .map((member) => ({ ...member, lastAttended: lastAttended.get(member.id) ?? null }))
    .filter(
      (member) =>
        member.memberSince < limit && (!member.lastAttended || member.lastAttended < limit),
    )
    .sort(
      (a, b) =>
        (a.lastAttended?.getTime() ?? -Infinity) - (b.lastAttended?.getTime() ?? -Infinity) ||
        a.memberSince.getTime() - b.memberSince.getTime(),
    );
}

export type WaitlistRow = {
  id: string;
  title: string;
  startsAt: Date;
  capacity: number;
  confirmed: number;
  waited: number;
  promoted: number;
  stayed: number;
  left: number;
};

/**
 * Listes d'attente : rencontres complètes (capacité atteinte, ou une liste d'attente a existé),
 * personnes promues, restées en attente, sorties d'elles-mêmes.
 */
export function waitlistStats(events: readonly StatsEvent[]) {
  const rows: WaitlistRow[] = [];
  for (const event of events) {
    if (event.capacity === null) continue;
    const confirmed = event.registrations.filter((r) => r.status === "CONFIRMED").length;
    const listed = event.registrations.filter((r) => r.waitlistedAt !== null);
    if (confirmed < event.capacity && listed.length === 0) continue;
    rows.push({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      capacity: event.capacity,
      confirmed,
      waited: listed.length,
      promoted: listed.filter((r) => r.promotedAt !== null).length,
      stayed: listed.filter((r) => r.status === "WAITLISTED").length,
      left: listed.filter((r) => r.status === "CANCELLED" && r.promotedAt === null).length,
    });
  }
  return {
    rows,
    full: rows.length,
    waited: rows.reduce((total, row) => total + row.waited, 0),
    promoted: rows.reduce((total, row) => total + row.promoted, 0),
    stayed: rows.reduce((total, row) => total + row.stayed, 0),
  };
}

/** Effectif de personnes pour la version partenaires : « < 3 » en dessous du seuil (sauf 0). */
export function maskSmall(n: number, min: number = SMALL_COUNT): number | string {
  return n > 0 && n < min ? `< ${min}` : n;
}

/** Taux pour la version partenaires : seulement sur une base suffisante. */
export function maskRate(part: number, whole: number): number | null {
  return whole >= MIN_RATE_BASE ? Math.min(1, part / whole) : null;
}

/** Libellé de mois : « nov. 2026 ». */
export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));
}

/**
 * Version « à présenter aux partenaires » : chiffres agrégés seulement, par mois et par activité.
 * Aucune ligne par rencontre (titre, date), aucun nom ni coordonnée ; les effectifs de personnes
 * inférieurs à 3 sont masqués, et un taux n'est donné que sur au moins 5 personnes.
 */
export type PartnerStats = {
  events: number;
  present: number | string;
  rate: number | null;
  averagePresent: number | null;
  newMembers: number | string;
  currentMembers: number | string;
  byMonth: { month: string; events: number; present: number | string }[];
  activities: {
    label: string;
    events: number;
    present: number | string;
    averageRating: number | null;
  }[];
  waitlists: { full: number; waited: number | string; promoted: number | string };
};

export function partnerView(input: {
  summary: ReturnType<typeof attendanceSummary>;
  byMonth: ReturnType<typeof presentByMonth>;
  activities: readonly ActivityStat[];
  waitlists: ReturnType<typeof waitlistStats>;
  newMembers: number;
  currentMembers: number;
}): PartnerStats {
  const { summary } = input;
  return {
    events: summary.events,
    present: maskSmall(summary.present),
    rate: maskRate(summary.present, summary.registered),
    averagePresent:
      summary.events > 0 && summary.present >= SMALL_COUNT
        ? summary.present / summary.events
        : null,
    newMembers: maskSmall(input.newMembers),
    currentMembers: maskSmall(input.currentMembers),
    byMonth: input.byMonth.map((m) => ({
      month: m.month,
      events: m.events,
      present: maskSmall(m.present),
    })),
    activities: input.activities.map((a) => ({
      label: a.label,
      events: a.events,
      present: maskSmall(a.present),
      averageRating: a.averageRating,
    })),
    waitlists: {
      full: input.waitlists.full,
      waited: maskSmall(input.waitlists.waited),
      promoted: maskSmall(input.waitlists.promoted),
    },
  };
}

import {
  activityStats,
  continuousSince,
  attendanceRows,
  attendanceSummary,
  inactiveMembers,
  newMembersByMonth,
  presentByMonth,
  waitlistStats,
  type ActivityMode,
  type CurrentMember,
  type StatsEvent,
  type StatsPeriod,
} from "@/features/stats/rules";
import { prisma } from "@/lib/prisma";

/**
 * Statistiques du comité. Données personnelles (liste de relance) : jamais en cache, pages
 * rendues à la demande. Rencontres comptées : publiées ou clôturées, passées, non archivées, hors
 * données de démonstration. Inscrits = confirmés ; présents = confirmés pointés (invités compris).
 */
/** Rencontres comptées partout (présences, activités, relances). */
export const countedEventWhere = {
  archivedAt: null,
  isDemo: false,
  status: { in: ["PUBLISHED" as const, "CLOSED" as const] },
};

export async function getEventStats(period: StatsPeriod, mode: ActivityMode, now: Date) {
  const end = period.toExcl < now ? period.toExcl : now;
  const rows = await prisma.event.findMany({
    where: { ...countedEventWhere, startsAt: { gte: period.from, lt: end } },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      type: true,
      activities: true,
      capacity: true,
      registrations: {
        select: { status: true, attendedAt: true, waitlistedAt: true, promotedAt: true },
      },
      feedbacks: { select: { rating: true } },
    },
  });
  const events: StatsEvent[] = rows.map(({ feedbacks, ...event }) => ({
    ...event,
    ratings: feedbacks.map((f) => f.rating),
  }));
  const attendance = attendanceRows(events);
  return {
    attendance,
    summary: attendanceSummary(attendance),
    byMonth: presentByMonth(attendance, period.from, period.toExcl),
    activities: activityStats(events, mode),
    waitlists: waitlistStats(events),
  };
}

/**
 * Adhérents à jour à une date : compte actif et adhésion couvrant cette date. Une adhésion
 * renouvelée depuis est passée « EXPIRED » : elle compte encore pour une période passée.
 */
const currentMemberWhere = (at: Date) => ({
  status: "ACTIVE" as const,
  archivedAt: null,
  isDemo: false,
  memberships: {
    some: {
      status: { in: ["ACTIVE" as const, "EXPIRED" as const] },
      startsAt: { lte: at },
      endsAt: { gt: at },
    },
  },
});

/**
 * Membres : nouveaux par mois (première adhésion validée), adhérents à jour à la fin de la
 * période, et parmi eux ceux venus au moins une fois pendant la période (« actifs »).
 */
export async function getMemberStats(period: StatsPeriod, now: Date) {
  const end = period.toExcl < now ? period.toExcl : now;
  const at = new Date(end.getTime() - 1);
  const [firsts, current, active] = await Promise.all([
    // Seulement les membres dont la première adhésion tombe dans la période.
    prisma.membership.groupBy({
      by: ["userId"],
      _min: { startsAt: true },
      where: { startsAt: { lt: period.toExcl }, user: { isDemo: false } },
      having: { startsAt: { _min: { gte: period.from } } },
    }),
    prisma.user.count({ where: currentMemberWhere(at) }),
    prisma.user.count({
      where: {
        ...currentMemberWhere(at),
        registrations: {
          some: {
            status: "CONFIRMED",
            attendedAt: { not: null },
            event: { ...countedEventWhere, startsAt: { gte: period.from, lt: end } },
          },
        },
      },
    }),
  ]);
  return {
    newByMonth: newMembersByMonth(
      firsts.flatMap((f) => (f._min.startsAt ? [f._min.startsAt] : [])),
      period.from,
      period.toExcl,
    ),
    current,
    active,
  };
}

/** Membres qui ne reviennent plus (aujourd'hui), avec leurs coordonnées pour les relancer. */
export async function getInactiveMembers(weeks: number, now: Date) {
  const members = await prisma.user.findMany({
    where: currentMemberWhere(now),
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      memberNumber: true,
      memberships: {
        where: { status: { in: ["ACTIVE", "EXPIRED"] } },
        select: { startsAt: true, endsAt: true },
      },
    },
  });
  // Dernière présence des seuls adhérents à jour, aux rencontres comptées.
  const last = members.length
    ? await prisma.eventRegistration.groupBy({
        by: ["userId"],
        _max: { attendedAt: true },
        where: {
          userId: { in: members.map((m) => m.id) },
          status: "CONFIRMED",
          attendedAt: { not: null },
          event: countedEventWhere,
        },
      })
    : [];
  const current: CurrentMember[] = members.flatMap((m) => {
    const since = continuousSince(m.memberships, now);
    return since
      ? [
          {
            id: m.id,
            name: m.name,
            email: m.email,
            phone: m.phone,
            memberNumber: m.memberNumber,
            memberSince: since,
          },
        ]
      : [];
  });
  const lastAttended = new Map(
    last.flatMap((l) => (l.userId && l._max.attendedAt ? [[l.userId, l._max.attendedAt]] : [])),
  );
  return inactiveMembers(current, lastAttended, now, weeks);
}

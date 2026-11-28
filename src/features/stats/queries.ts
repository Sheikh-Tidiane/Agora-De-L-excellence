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

/**
 * Lecture (cahier des charges § 14) : livres terminés déclarés et validés, par genre (catégorie du
 * livre), et participation au livre du mois (lectures du livre, présents à la rencontre liée).
 */
export async function getReadingStats(period: StatsPeriod, now: Date) {
  const end = period.toExcl < now ? period.toExcl : now;
  const [finished, selections] = await Promise.all([
    prisma.reading.findMany({
      where: {
        status: "FINISHED",
        finishedAt: { gte: period.from, lt: end },
        user: { isDemo: false },
      },
      select: {
        completionStatus: true,
        book: { select: { category: { select: { name: true } } } },
      },
    }),
    prisma.monthlySelection.findMany({
      where: { isDemo: false, month: { gte: period.from, lt: end } },
      orderBy: { month: "asc" },
      select: {
        month: true,
        bookId: true,
        book: { select: { title: true } },
        event: {
          select: {
            registrations: {
              where: { status: "CONFIRMED", attendedAt: { not: null } },
              select: { id: true },
            },
          },
        },
      },
    }),
  ]);
  const byGenre = new Map<string, number>();
  for (const r of finished) {
    byGenre.set(r.book.category.name, (byGenre.get(r.book.category.name) ?? 0) + 1);
  }
  const monthly = await Promise.all(
    selections.map(async (s) => ({
      month: s.month.toISOString().slice(0, 7),
      title: s.book.title,
      readers: await prisma.reading.count({
        where: { bookId: s.bookId, user: { isDemo: false }, createdAt: { lt: end } },
      }),
      present: s.event?.registrations.length ?? null,
    })),
  );
  return {
    finished: finished.length,
    validated: finished.filter((r) => r.completionStatus === "APPROVED").length,
    genres: [...byGenre.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "fr")),
    monthly,
  };
}

/**
 * Scrabble (§ 14) : tournois joués sur la période, participants (forfaits et retraits exclus),
 * manches jouées, et score moyen par partie, tournoi par tournoi (évolution des scores).
 */
export async function getScrabbleStats(period: StatsPeriod, now: Date) {
  const end = period.toExcl < now ? period.toExcl : now;
  const tournaments = await prisma.tournament.findMany({
    where: {
      archivedAt: null,
      status: { in: ["IN_PROGRESS", "COMPLETED"] },
      startsAt: { gte: period.from, lt: end },
    },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      name: true,
      startsAt: true,
      isInterclub: true,
      participants: { where: { withdrawnAt: null }, select: { id: true } },
      rounds: {
        select: {
          status: true,
          scores: { where: { isForfeit: false }, select: { points: true } },
        },
      },
    },
  });
  const rows = tournaments.map((t) => {
    const scores = t.rounds.flatMap((r) => r.scores.map((s) => s.points));
    return {
      id: t.id,
      name: t.name,
      startsAt: t.startsAt,
      interclub: t.isInterclub,
      participants: t.participants.length,
      rounds: t.rounds.filter((r) => r.scores.length > 0).length,
      averageScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    };
  });
  return {
    rows,
    tournaments: rows.length,
    participants: rows.reduce((total, r) => total + r.participants, 0),
    rounds: rows.reduce((total, r) => total + r.rounds, 0),
  };
}

/** Renouvellements : adhésions commencées dans la période par un membre qui en avait déjà une. */
export async function countRenewals(period: StatsPeriod, now: Date) {
  const end = period.toExcl < now ? period.toExcl : now;
  const started = await prisma.membership.findMany({
    where: { startsAt: { gte: period.from, lt: end }, user: { isDemo: false } },
    select: { userId: true, startsAt: true },
  });
  if (started.length === 0) return 0;
  const earlier = await prisma.membership.groupBy({
    by: ["userId"],
    _min: { startsAt: true },
    where: { userId: { in: [...new Set(started.map((m) => m.userId))] } },
  });
  const first = new Map(earlier.map((e) => [e.userId, e._min.startsAt!.getTime()]));
  return started.filter((m) => m.startsAt.getTime() > first.get(m.userId)!).length;
}

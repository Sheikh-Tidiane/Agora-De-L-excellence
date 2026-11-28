import {
  activityLabels,
  eventActivities,
  eventTypeLabels,
  type EventTypeCode,
} from "@/config/activities";
import { displayAverage, feedbackWindow } from "@/features/feedback/rules";
import { prisma } from "@/lib/prisma";

/** Lectures des avis. Données personnelles : jamais en cache, pages rendues à la demande. */

/** Page « Donner mon avis » du membre : la rencontre, sa présence, son avis, la fenêtre. */
export async function getMyFeedbackPage(userId: string, slug: string, hour: number) {
  const event = await prisma.event.findFirst({
    where: { slug, archivedAt: null, status: { in: ["PUBLISHED", "CLOSED"] } },
    select: { id: true, slug: true, title: true, startsAt: true, endsAt: true, location: true },
  });
  if (!event) return null;
  const registration = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId } },
    select: {
      status: true,
      attendedAt: true,
      feedback: { select: { rating: true, comment: true, hiddenAt: true, updatedAt: true } },
    },
  });
  const present = registration?.status === "CONFIRMED" && registration.attendedAt !== null;
  return {
    event,
    present,
    feedback: present ? (registration?.feedback ?? null) : null,
    window: feedbackWindow(event, hour),
  };
}

export type FeedbackFilters = {
  /** Rencontres depuis cette date. */
  from: Date;
  /** Activité (code), ou toutes. */
  activity: string | null;
  /** Compter chaque avis pour toutes les activités de la rencontre, ou la principale seulement. */
  mode: "all" | "primary";
};

type Row = {
  id: string;
  title: string;
  startsAt: Date;
  activities: string[];
  present: number;
  count: number;
  sum: number;
  comments: number;
  hidden: number;
  distribution: [number, number, number, number, number];
  average: number | null;
};

/**
 * Tableau des avis : par rencontre (présents, avis, taux de réponse, moyenne, répartition) et par
 * activité. Une rencontre à plusieurs activités compte pour chacune (mode « toutes ») ou pour sa
 * seule activité principale (mode « principale »).
 */
export async function getFeedbackOverview(filters: FeedbackFilters, now: Date = new Date()) {
  const events = await prisma.event.findMany({
    where: {
      archivedAt: null,
      status: { in: ["PUBLISHED", "CLOSED"] },
      startsAt: { gte: filters.from, lt: now },
    },
    orderBy: { startsAt: "desc" },
    select: {
      id: true,
      title: true,
      type: true,
      activities: true,
      startsAt: true,
      _count: {
        select: { registrations: { where: { status: "CONFIRMED", attendedAt: { not: null } } } },
      },
      feedbacks: { select: { rating: true, comment: true, hiddenAt: true } },
    },
  });
  const counted = (event: (typeof events)[number]): EventTypeCode[] =>
    filters.mode === "primary" ? [event.type] : eventActivities(event);
  const rows: Row[] = events
    .filter(
      (event) => !filters.activity || counted(event).includes(filters.activity as EventTypeCode),
    )
    .filter((event) => event._count.registrations > 0 || event.feedbacks.length > 0)
    .map((event) => {
      const sum = event.feedbacks.reduce((total, f) => total + f.rating, 0);
      const distribution = [0, 0, 0, 0, 0] as Row["distribution"];
      for (const f of event.feedbacks) distribution[f.rating - 1] += 1;
      return {
        id: event.id,
        title: event.title,
        startsAt: event.startsAt,
        activities: activityLabels(event),
        present: event._count.registrations,
        count: event.feedbacks.length,
        sum,
        comments: event.feedbacks.filter((f) => f.comment).length,
        hidden: event.feedbacks.filter((f) => f.hiddenAt).length,
        distribution,
        average: displayAverage(sum, event.feedbacks.length),
      };
    });

  const byActivity = new Map<
    string,
    { label: string; count: number; sum: number; events: number }
  >();
  for (const event of events) {
    if (event.feedbacks.length === 0) continue;
    const sum = event.feedbacks.reduce((total, f) => total + f.rating, 0);
    for (const code of counted(event)) {
      if (filters.activity && code !== filters.activity) continue;
      const entry = byActivity.get(code) ?? {
        label: eventTypeLabels[code],
        count: 0,
        sum: 0,
        events: 0,
      };
      entry.count += event.feedbacks.length;
      entry.sum += sum;
      entry.events += 1;
      byActivity.set(code, entry);
    }
  }
  const activities = [...byActivity.entries()]
    .map(([code, entry]) => ({ code, ...entry, average: displayAverage(entry.sum, entry.count) }))
    .sort((a, b) => b.count - a.count);

  const totalCount = rows.reduce((total, row) => total + row.count, 0);
  const totalSum = rows.reduce((total, row) => total + row.sum, 0);
  const totalPresent = rows.reduce((total, row) => total + row.present, 0);
  return {
    rows,
    activities,
    total: {
      count: totalCount,
      average: displayAverage(totalSum, totalCount),
      responseRate: totalPresent > 0 ? Math.min(1, totalCount / totalPresent) : null,
    },
  };
}

/** Avis d'une rencontre, avec leur auteur (responsables seulement). */
export async function getEventFeedback(eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, archivedAt: null },
    select: {
      id: true,
      title: true,
      startsAt: true,
      _count: {
        select: { registrations: { where: { status: "CONFIRMED", attendedAt: { not: null } } } },
      },
    },
  });
  if (!event) return null;
  const feedbacks = await prisma.eventFeedback.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      rating: true,
      comment: true,
      hiddenAt: true,
      hiddenReason: true,
      anonymizedAt: true,
      createdAt: true,
      updatedAt: true,
      registration: {
        select: { guestName: true, user: { select: { name: true, memberNumber: true } } },
      },
    },
  });
  const sum = feedbacks.reduce((total, f) => total + f.rating, 0);
  return {
    event,
    feedbacks,
    average: displayAverage(sum, feedbacks.length),
  };
}

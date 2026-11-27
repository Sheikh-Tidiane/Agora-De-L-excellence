import { cacheLife, cacheTag } from "next/cache";
import type { EventTypeCode } from "@/config/activities";
import { excerpt } from "@/features/events/excerpt";
import type { EventStatusCode } from "@/features/events/rules";
import { holdCutoff } from "@/features/events/rules";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { prisma, type Db } from "@/lib/prisma";

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  /** Activité principale. */
  type: EventTypeCode;
  /** Toutes les activités, principale comprise. */
  activities: EventTypeCode[];
  status: EventStatusCode;
  summary: string | null;
  description: string;
  /** `null` : lieu à confirmer. */
  location: string | null;
  startsAt: Date;
  endsAt: Date | null;
  capacity: number | null;
  isPublic: boolean;
  cancellationDeadlineHours: number | null;
  isTentative: boolean;
  program: string | null;
  speakerName: string | null;
  speakerTitle: string | null;
  speakerMode: "ON_SITE" | "REMOTE" | null;
  /** Date de publication du compte rendu ; `null` s'il n'y en a pas (ou pas encore publié). */
  reportPublishedAt: Date | null;
};

/** Le lien de visio n'en fait pas partie : il n'est lu que pour un membre inscrit. */
const eventSelect = {
  id: true,
  slug: true,
  title: true,
  type: true,
  activities: true,
  status: true,
  summary: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  capacity: true,
  isPublic: true,
  cancellationDeadlineHours: true,
  isTentative: true,
  program: true,
  speakerName: true,
  speakerTitle: true,
  speakerMode: true,
  reportPublishedAt: true,
};

/** Une rencontre reste « à venir » jusqu'à trois heures après son début. */
const GRACE = 3 * 60 * 60 * 1000;
const visible = { status: { in: ["PUBLISHED", "CLOSED"] as EventStatusCode[] }, archivedAt: null };

/** Agenda : rencontres publiées à venir, la plus proche d'abord. */
export async function getUpcomingEvents(take = 50): Promise<PublicEvent[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  return prisma.event.findMany({
    where: { ...visible, startsAt: { gte: new Date(Date.now() - GRACE) } },
    orderBy: { startsAt: "asc" },
    take,
    select: eventSelect,
  });
}

/** Rencontres passées, la plus récente d'abord. */
export async function getPastEvents(take = 6): Promise<PublicEvent[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  return prisma.event.findMany({
    where: { ...visible, startsAt: { lt: new Date(Date.now() - GRACE) } },
    orderBy: { startsAt: "desc" },
    take,
    select: eventSelect,
  });
}

/** Le prochain événement « Vie du club » à venir (le lancement) : mis en avant sur l'accueil. */
export async function getFeaturedLaunch(): Promise<PublicEvent | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  return prisma.event.findFirst({
    where: {
      ...visible,
      type: "LANCEMENT_AUTRE",
      status: "PUBLISHED",
      startsAt: { gte: new Date(Date.now() - GRACE) },
    },
    orderBy: { startsAt: "asc" },
    select: eventSelect,
  });
}

export type ArchiveEntry = Pick<
  PublicEvent,
  "slug" | "title" | "type" | "activities" | "startsAt" | "summary" | "reportPublishedAt"
> & { reportExcerpt: string | null };

/**
 * Archives de l'Agora : toutes les rencontres passées, la plus récente d'abord.
 * Le filtrage par activité et par année se fait sur cette liste (quelques dizaines de lignes par an).
 */
export async function getArchive(): Promise<ArchiveEntry[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  const events = await prisma.event.findMany({
    where: { ...visible, startsAt: { lt: new Date(Date.now() - GRACE) } },
    orderBy: { startsAt: "desc" },
    take: 500,
    select: {
      slug: true,
      title: true,
      type: true,
      activities: true,
      startsAt: true,
      summary: true,
      reportPublishedAt: true,
      reportContent: true,
    },
  });
  return events.map(({ reportContent, ...event }) => ({
    ...event,
    reportExcerpt: event.reportPublishedAt && reportContent ? excerpt(reportContent) : null,
  }));
}

/** Détail d'une rencontre. Un brouillon ou une rencontre archivée n'existe pas pour le public. */
export async function getEventBySlug(slug: string): Promise<PublicEvent | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  return prisma.event.findFirst({
    where: { slug, status: { not: "DRAFT" }, archivedAt: null },
    select: eventSelect,
  });
}

/** Adresses des rencontres publiées, pour prérendre leurs pages au build. */
export async function getPublishedEventSlugs(): Promise<string[]> {
  const rows = await prisma.event.findMany({
    where: { status: { not: "DRAFT" }, archivedAt: null },
    select: { slug: true },
    orderBy: { startsAt: "desc" },
    take: 200,
  });
  return rows.map((row) => row.slug);
}

/** Compte rendu publié d'une rencontre (Markdown), ou `null`. */
export async function getEventReport(eventId: string): Promise<string | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.events);
  const event = await prisma.event.findFirst({
    where: { id: eventId, reportPublishedAt: { not: null }, archivedAt: null },
    select: { reportContent: true },
  });
  return event?.reportContent ?? null;
}

/** Lien de visio d'une rencontre : à n'appeler que pour un membre dont l'inscription est confirmée. */
export async function getEventVideoLink(eventId: string): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { videoLink: true },
  });
  return event?.videoLink ?? null;
}

/** Places occupées : inscriptions confirmées + invités en attente de confirmation depuis moins de 24 h. */
export async function countSeatsTaken(eventId: string, now: Date, db: Db = prisma) {
  return db.eventRegistration.count({
    where: {
      eventId,
      OR: [{ status: "CONFIRMED" }, { status: "PENDING", updatedAt: { gt: holdCutoff(now) } }],
    },
  });
}

/** Inscription du membre connecté à une rencontre, s'il en a une. Jamais mise en cache. */
export async function getMemberRegistration(eventId: string, userId: string) {
  return prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true, status: true },
  });
}

/** Inscriptions à venir d'un membre (page /member). */
/** Rencontres où le membre a été pointé présent, de la plus récente à la plus ancienne. */
export async function getMyAttendance(userId: string) {
  return prisma.eventRegistration.findMany({
    where: { userId, attendedAt: { not: null } },
    orderBy: { event: { startsAt: "desc" } },
    take: 100,
    select: {
      id: true,
      attendedAt: true,
      event: { select: { slug: true, title: true, type: true, activities: true, startsAt: true } },
      payments: {
        where: { kind: "SESSION_FEE", cancelledAt: null },
        select: { id: true },
        take: 1,
      },
    },
  });
}

export async function getMyUpcomingRegistrations(userId: string, now: Date) {
  return prisma.eventRegistration.findMany({
    where: { userId, status: "CONFIRMED", event: { startsAt: { gte: now }, archivedAt: null } },
    orderBy: { event: { startsAt: "asc" } },
    select: {
      id: true,
      event: {
        select: {
          slug: true,
          title: true,
          type: true,
          activities: true,
          status: true,
          location: true,
          startsAt: true,
          cancellationDeadlineHours: true,
        },
      },
    },
  });
}

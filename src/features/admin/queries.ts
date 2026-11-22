import { holdCutoff } from "@/features/events/rules";
import type { CurrentUser } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Chiffres du tableau de bord, tous comptés en base au moment de l'affichage.
 * Chaque bloc n'est calculé que si l'utilisateur a la permission de la rubrique.
 */
export async function getDashboard(user: CurrentUser, now: Date) {
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const members = can(user, "members.read");
  const requests = can(user, "memberships.review");
  const events = can(user, "events.manage");
  const books = can(user, "books.manage");
  const articles = can(user, "articles.manage");

  const [
    activeMembers,
    pendingActivation,
    expiringSoon,
    pendingRequests,
    latestRequests,
    upcomingEvents,
    registrations30d,
    publishedBooks,
    publishedArticles,
    draftArticles,
  ] = await Promise.all([
    members
      ? prisma.membership.count({
          where: { status: "ACTIVE", endsAt: { gte: now }, user: { status: "ACTIVE" } },
        })
      : null,
    members
      ? prisma.user.count({ where: { status: "PENDING_ACTIVATION", memberNumber: { not: null } } })
      : null,
    members
      ? prisma.membership.count({
          where: {
            status: "ACTIVE",
            endsAt: { gte: now, lt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          },
        })
      : null,
    requests ? prisma.membershipRequest.count({ where: { status: "PENDING" } }) : null,
    requests
      ? prisma.membershipRequest.findMany({
          where: { status: "PENDING" },
          orderBy: { createdAt: "asc" },
          take: 5,
          select: { id: true, firstName: true, lastName: true, createdAt: true, ageRange: true },
        })
      : [],
    events
      ? prisma.event.findMany({
          where: {
            archivedAt: null,
            status: { in: ["PUBLISHED", "CLOSED"] },
            startsAt: { gte: now },
          },
          orderBy: { startsAt: "asc" },
          take: 5,
          select: {
            id: true,
            title: true,
            startsAt: true,
            capacity: true,
            registrations: {
              where: {
                OR: [
                  { status: "CONFIRMED" },
                  { status: "PENDING", updatedAt: { gt: holdCutoff(now) } },
                ],
              },
              select: { id: true },
            },
          },
        })
      : [],
    events
      ? prisma.eventRegistration.count({
          where: { status: "CONFIRMED", confirmedAt: { gte: monthAgo } },
        })
      : null,
    books ? prisma.book.count({ where: { isPublished: true, archivedAt: null } }) : null,
    articles
      ? prisma.article.count({
          where: { status: "PUBLISHED", archivedAt: null, publishedAt: { lte: now } },
        })
      : null,
    articles ? prisma.article.count({ where: { status: "DRAFT", archivedAt: null } }) : null,
  ]);

  return {
    activeMembers,
    pendingActivation,
    expiringSoon,
    pendingRequests,
    latestRequests,
    upcomingEvents: upcomingEvents.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      capacity: event.capacity,
      taken: event.registrations.length,
    })),
    registrations30d,
    publishedBooks,
    publishedArticles,
    draftArticles,
  };
}

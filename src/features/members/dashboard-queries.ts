import { getMyUpcomingRegistrations } from "@/features/events/queries";
import { levelStanding } from "@/features/gamification/levels";
import { prisma } from "@/lib/prisma";

/**
 * Données du tableau de bord d'un membre. Toutes les requêtes sont bornées à `userId`,
 * qui vient de la session : un membre ne lit que ses propres données.
 */
export async function getMemberDashboard(userId: string, now: Date) {
  const [profile, membership, card, registrations, readings, points, badges, levels] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { image: true } }),
      prisma.membership.findFirst({
        where: { userId },
        orderBy: { endsAt: "desc" },
        select: { status: true, startsAt: true, endsAt: true },
      }),
      getMembershipCardPayment(userId),
      getMyUpcomingRegistrations(userId, now),
      prisma.reading.findMany({
        where: { userId, status: "READING" },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          progress: true,
          book: {
            select: {
              slug: true,
              title: true,
              authors: { select: { name: true }, take: 2 },
            },
          },
        },
      }),
      prisma.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } }),
      prisma.userBadge.findMany({
        where: { userId },
        orderBy: { awardedAt: "desc" },
        select: { id: true, awardedAt: true, badge: { select: { name: true, description: true } } },
      }),
      prisma.level.findMany({
        orderBy: { minPoints: "asc" },
        select: { code: true, name: true, minPoints: true },
      }),
    ]);
  const total = points._sum.points ?? 0;

  return {
    image: profile?.image ?? null,
    membership,
    card,
    registrations,
    readings,
    points: total,
    level: levelStanding(levels, total),
    badges,
  };
}

/** Paiement actif de la carte de membre (le plus récent), ou `null` si elle reste à régler. */
export function getMembershipCardPayment(userId: string) {
  return prisma.payment.findFirst({
    where: { userId, kind: "MEMBERSHIP_CARD", cancelledAt: null },
    orderBy: { paidAt: "desc" },
    select: { paidAt: true },
  });
}

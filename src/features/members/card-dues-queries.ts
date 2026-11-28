import { cardDue, type CardDue } from "@/features/members/card-dues";
import { prisma, type Db } from "@/lib/prisma";

/** État de la carte d'un membre : réglée ou non, acceptation, date limite, retard. */
export async function getCardDue(
  userId: string,
  graceDays: number,
  now: Date,
  db: Db = prisma,
): Promise<CardDue> {
  const [paid, memberships] = await Promise.all([
    db.payment.count({ where: { userId, kind: "MEMBERSHIP_CARD", cancelledAt: null } }),
    db.membership.findMany({ where: { userId }, select: { startsAt: true } }),
  ]);
  return cardDue({ paid: paid > 0, memberships }, graceDays, now);
}

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

/** États des cartes de plusieurs membres, en deux requêtes (rappels de rencontre en lot). */
export async function cardDuesFor(
  userIds: string[],
  graceDays: number,
  now: Date,
  db: Db = prisma,
): Promise<Map<string, CardDue>> {
  if (userIds.length === 0) return new Map();
  const [payments, memberships] = await Promise.all([
    db.payment.findMany({
      where: { userId: { in: userIds }, kind: "MEMBERSHIP_CARD", cancelledAt: null },
      select: { userId: true },
    }),
    db.membership.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, startsAt: true },
    }),
  ]);
  const paid = new Set(payments.map((p) => p.userId));
  return new Map(
    userIds.map((id) => [
      id,
      cardDue(
        { paid: paid.has(id), memberships: memberships.filter((m) => m.userId === id) },
        graceDays,
        now,
      ),
    ]),
  );
}

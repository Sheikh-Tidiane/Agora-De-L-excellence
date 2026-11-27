import type { BadgeCriterion } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import {
  AUTOMATIC_CRITERIA,
  badgesDue,
  isAutomaticCriterion,
  type AutomaticCriterion,
  type CriterionCounts,
} from "@/features/gamification/rules";
import { assertMember, runInTransaction } from "@/features/gamification/ledger";

/**
 * Badges : automatiques (critère et seuil en base, réévalués après chaque transaction de points
 * ou chaque fait qui compte) et manuel (« Ambassadeur du savoir », attribué avec un motif).
 * Un badge obtenu n'est **jamais retiré automatiquement** : une correction de points ou une
 * présence décochée ne le reprend pas (docs/DECISIONS.md, section 11).
 */

/** Mesure les critères demandés pour un membre, à partir des faits validés (pas des intentions). */
export async function measureCriteria(
  userId: string,
  criteria: Iterable<AutomaticCriterion>,
  db: Db = prisma,
): Promise<CriterionCounts> {
  const counts = Object.fromEntries(AUTOMATIC_CRITERIA.map((c) => [c, 0])) as CriterionCounts;
  const attended = { userId, status: "CONFIRMED" as const, attendedAt: { not: null } };
  const measures: Record<AutomaticCriterion, () => Promise<number>> = {
    BOOKS_FINISHED: () => db.reading.count({ where: { userId, completionStatus: "APPROVED" } }),
    REVIEWS_APPROVED: () => db.review.count({ where: { userId, status: "APPROVED" } }),
    EVENTS_ATTENDED: () => db.eventRegistration.count({ where: attended }),
    DEBATES_ATTENDED: () =>
      // Rencontres dont le débat est l'une des activités, principale ou non.
      db.eventRegistration.count({
        where: { ...attended, event: { activities: { has: "DEBAT_IDEES" } } },
      }),
    TOURNAMENTS_PLAYED: () =>
      db.tournamentParticipant.count({
        where: { userId, withdrawnAt: null, tournament: { status: "COMPLETED" } },
      }),
    // Une victoire = une ligne de points de tournoi encore active (la correction l'annule).
    TOURNAMENTS_WON: () =>
      db.pointTransaction.count({
        where: { userId, sourceType: "TOURNAMENT", points: { gt: 0 }, reversedBy: { is: null } },
      }),
    TOTAL_POINTS: async () =>
      (await db.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } }))._sum
        .points ?? 0,
    QUIZZES_COMPLETED: () => db.quizAttempt.count({ where: { userId, finishedAt: { not: null } } }),
  };
  for (const criterion of new Set(criteria)) counts[criterion] = await measures[criterion]();
  return counts;
}

/**
 * Attribue les badges automatiques dus. Idempotent : l'unicité (membre, badge) en base empêche
 * le doublon, même entre deux évaluations simultanées. Renvoie les codes nouvellement obtenus.
 */
export async function evaluateBadges(userId: string, db: Db = prisma): Promise<string[]> {
  // Lectures l'une après l'autre : la fonction tourne souvent dans la transaction de l'appelant,
  // dont la connexion ne traite qu'une requête à la fois.
  const badges = await db.badge.findMany({
    where: { isActive: true, criterion: { not: "MANUAL" } },
    select: { id: true, code: true, criterion: true, threshold: true, isActive: true },
  });
  const held = await db.userBadge.findMany({
    where: { userId },
    select: { badge: { select: { code: true } } },
  });
  const heldCodes = new Set(held.map((row) => row.badge.code));
  const pending = badges.filter((badge) => !heldCodes.has(badge.code));
  if (pending.length === 0) return [];
  const criteria = pending
    .map((badge) => badge.criterion)
    .filter((c: BadgeCriterion): c is AutomaticCriterion => isAutomaticCriterion(c));
  const counts = await measureCriteria(userId, criteria, db);
  const due = new Set(badgesDue(pending, counts, heldCodes));
  const awarded: string[] = [];
  for (const badge of pending.filter((b) => due.has(b.code))) {
    const { count } = await db.userBadge.createMany({
      data: [{ userId, badgeId: badge.id }],
      skipDuplicates: true,
    });
    if (count === 0) continue;
    awarded.push(badge.code);
    await audit(
      {
        actorId: null,
        action: "badge.awarded",
        entityType: "User",
        entityId: userId,
        metadata: {
          badge: badge.code,
          automatic: true,
          criterion: badge.criterion,
          threshold: badge.threshold,
          measured: isAutomaticCriterion(badge.criterion) ? counts[badge.criterion] : null,
        },
      },
      db,
    );
  }
  return awarded;
}

/** Badge manuel (critère `MANUAL`), attribué par un responsable avec un motif. */
export async function awardManualBadge(
  input: { userId: string; badgeCode: string; reason: string },
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { reason: "Indiquez le motif de l’attribution." },
    });
  }
  if (actorId === input.userId) {
    throw new AppError("FORBIDDEN", "Vous ne pouvez pas vous attribuer un badge.");
  }
  return runInTransaction(db, async (tx) => {
    const badge = await tx.badge.findUnique({
      where: { code: input.badgeCode },
      select: { id: true, code: true, criterion: true, isActive: true },
    });
    if (!badge || !badge.isActive) throw new AppError("NOT_FOUND", "Badge introuvable.");
    if (badge.criterion !== "MANUAL") {
      throw new AppError("CONFLICT", "Ce badge s’obtient automatiquement, selon son critère.");
    }
    await assertMember(tx, input.userId);
    const { count } = await tx.userBadge.createMany({
      data: [{ userId: input.userId, badgeId: badge.id, awardedById: actorId, reason }],
      skipDuplicates: true,
    });
    if (count === 0) throw new AppError("CONFLICT", "Ce membre a déjà ce badge.");
    const row = await tx.userBadge.findUniqueOrThrow({
      where: { userId_badgeId: { userId: input.userId, badgeId: badge.id } },
      select: { id: true },
    });
    await audit(
      {
        actorId,
        action: "badge.awarded",
        entityType: "User",
        entityId: input.userId,
        metadata: { badge: badge.code, automatic: false, reason },
      },
      tx,
    );
    return row;
  });
}

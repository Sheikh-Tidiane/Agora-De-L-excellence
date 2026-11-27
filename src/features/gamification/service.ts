import { randomUUID } from "node:crypto";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { evaluateBadges } from "@/features/gamification/badges-service";
import {
  awardForSource,
  lockSource,
  memberStatus,
  sourceLockKey,
  reverseInTx,
  runInTransaction,
  skipped,
  type AwardResult,
  type Tx,
} from "@/features/gamification/ledger";
import {
  attendanceRuleTypes,
  combineOutcomes,
  MAX_MANUAL_POINTS,
  MAX_RULE_POINTS,
  parseAttendancePointMode,
  RULE_CODES,
  type AttendancePointMode,
} from "@/features/gamification/rules";

/**
 * Moteur de points et badges (docs/REGLES-METIER.md, « Points et badges ») :
 * - barème en table `PointRule` ; une règle inactive ou à zéro ne rapporte rien ;
 * - un membre ne s'attribue jamais de points (le responsable bénéficiaire est ignoré ou refusé) ;
 * - une transaction = une ligne, jamais modifiée ; une correction = ligne inverse motivée ;
 * - anti-doublon par la contrainte unique (membre, règle, type, source) : un second appel
 *   renvoie « déjà attribué », sans erreur ;
 * - chaque écriture passe dans `AuditLog`, dans la même transaction ;
 * - les badges automatiques sont réévalués après chaque attribution ou correction.
 * Toutes les fonctions acceptent une transaction (`db`) pour s'inscrire dans celle de l'appelant.
 */
export type { AwardResult } from "@/features/gamification/ledger";
export { awardManualBadge, evaluateBadges } from "@/features/gamification/badges-service";
export { getMemberRewards, getPointRankings } from "@/features/gamification/rewards-service";

type RuleRow = { id: string; code: string; label: string; points: number; isActive: boolean };

function ruleSkip(rule: RuleRow | null): AwardResult | null {
  if (!rule) return skipped("no_rule");
  if (!rule.isActive) return skipped("inactive_rule");
  if (rule.points <= 0) return skipped("zero_points");
  return null;
}

/** Attribution commune : membre, règle, bénéficiaire ≠ responsable, ligne, puis badges. */
async function award(
  tx: Tx,
  input: {
    userId: string;
    rule: RuleRow | null;
    sourceType: "EVENT_ATTENDANCE" | "READING" | "REVIEW";
    sourceId: string;
    actorId: string | null;
  },
): Promise<AwardResult> {
  if ((await memberStatus(tx, input.userId)) !== "member") return skipped("not_member");
  let result = ruleSkip(input.rule);
  if (!result && input.actorId === input.userId) result = skipped("self_award");
  result ??= await awardForSource(tx, { ...input, rule: input.rule! });
  // Le fait compte pour les badges même sans points (règle inactive, responsable bénéficiaire).
  return { ...result, badges: await evaluateBadges(input.userId, tx) };
}

const eventRuleSelect = { id: true, code: true, label: true, points: true, isActive: true };

/** Réglage « points de présence » : toutes les activités (défaut) ou la principale seulement. */
export const ATTENDANCE_MODE_KEY = "points.attendance";

export async function getAttendancePointMode(db: Db = prisma): Promise<AttendancePointMode> {
  const row = await db.setting.findUnique({ where: { key: ATTENDANCE_MODE_KEY } });
  return parseAttendancePointMode(row?.value ?? null);
}

/** Détail d'une présence payée : une ligne par règle (activité) examinée. */
export type AttendanceAward = AwardResult & {
  rules: {
    eventType: string;
    code: string | null;
    status: AwardResult["status"];
    reason: AwardResult["reason"];
    points: number;
    transactionId: string | null;
  }[];
};

/**
 * Présence pointée à une rencontre, au membre inscrit (rien pour un invité). Selon le réglage
 * `points.attendance`, paie la règle de chaque activité de la rencontre (défaut) ou celle de
 * l'activité principale seulement : une ligne par règle, jamais deux fois la même (voir
 * `awardForSource`). Le réglage vaut au moment du pointage : ce qui est payé reste payé.
 */
export async function awardAttendancePoints(
  registrationId: string,
  actorId: string | null,
  db: Db = prisma,
): Promise<AttendanceAward> {
  return runInTransaction(db, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: registrationId },
      select: {
        userId: true,
        status: true,
        attendedAt: true,
        event: { select: { type: true, activities: true } },
      },
    });
    if (!registration) throw new AppError("NOT_FOUND", "Inscription introuvable.");
    const none = (result: AwardResult): AttendanceAward => ({ ...result, rules: [] });
    if (!registration.userId) return none(skipped("guest"));
    if (registration.status !== "CONFIRMED" || !registration.attendedAt) {
      return none(skipped("not_eligible"));
    }
    const userId = registration.userId;
    if ((await memberStatus(tx, userId)) !== "member") return none(skipped("not_member"));

    const types = attendanceRuleTypes(registration.event, await getAttendancePointMode(tx));
    const rules = await tx.pointRule.findMany({
      where: { eventType: { in: types } },
      select: { ...eventRuleSelect, eventType: true },
    });
    // Un seul verrou pour toutes les règles de la présence (le même que le retrait).
    await lockSource(tx, sourceLockKey(userId, "EVENT_ATTENDANCE", registrationId));
    const details: AttendanceAward["rules"] = [];
    for (const type of types) {
      const rule = rules.find((r) => r.eventType === type) ?? null;
      let result = ruleSkip(rule);
      if (!result && actorId === userId) result = skipped("self_award");
      result ??= await awardForSource(tx, {
        userId,
        rule: rule!,
        sourceType: "EVENT_ATTENDANCE",
        sourceId: registrationId,
        actorId,
      });
      details.push({
        eventType: type,
        code: rule?.code ?? null,
        status: result.status,
        reason: result.reason,
        points: result.status === "awarded" ? result.points : 0,
        transactionId: result.transactionId,
      });
    }
    const combined = combineOutcomes(details);
    // Le fait compte pour les badges même sans points (règle inactive, responsable bénéficiaire).
    const badges = await evaluateBadges(userId, tx);
    return { ...combined, badges, rules: details };
  });
}

/** Présence décochée : chaque ligne encore active pour cette inscription reçoit son inverse. */
export async function revokeAttendancePoints(
  registrationId: string,
  actorId: string | null,
  reason: string,
  db: Db = prisma,
): Promise<{ reversed: number }> {
  return runInTransaction(db, async (tx) => {
    const registration = await tx.eventRegistration.findUnique({
      where: { id: registrationId },
      select: { userId: true },
    });
    if (!registration) throw new AppError("NOT_FOUND", "Inscription introuvable.");
    if (!registration.userId) return { reversed: 0 };
    // Même verrou que l'attribution : un pointage simultané ne peut pas glisser une ligne entre
    // la lecture et les corrections (des points resteraient actifs sur une présence décochée).
    await lockSource(tx, sourceLockKey(registration.userId, "EVENT_ATTENDANCE", registrationId));
    const active = await tx.pointTransaction.findMany({
      where: {
        userId: registration.userId,
        sourceType: "EVENT_ATTENDANCE",
        sourceId: registrationId,
        points: { gt: 0 },
        reversedBy: { is: null },
      },
      select: { id: true },
    });
    for (const line of active) {
      await reverseInTx(tx, line.id, actorId, reason || "Présence décochée", { forbidSelf: false });
    }
    if (active.length > 0) await evaluateBadges(registration.userId, tx);
    return { reversed: active.length };
  });
}

/** Lecture validée « terminée » par un responsable. */
export async function awardReadingPoints(
  readingId: string,
  actorId: string | null,
  db: Db = prisma,
): Promise<AwardResult> {
  return runInTransaction(db, async (tx) => {
    const reading = await tx.reading.findUnique({
      where: { id: readingId },
      select: { userId: true, status: true, completionStatus: true },
    });
    if (!reading) throw new AppError("NOT_FOUND", "Lecture introuvable.");
    if (reading.status !== "FINISHED" || reading.completionStatus !== "APPROVED") {
      return skipped("not_eligible");
    }
    const rule = await tx.pointRule.findUnique({
      where: { code: RULE_CODES.bookFinished },
      select: eventRuleSelect,
    });
    return award(tx, {
      userId: reading.userId,
      rule,
      sourceType: "READING",
      sourceId: readingId,
      actorId,
    });
  });
}

/** Critique approuvée par un modérateur. */
export async function awardReviewPoints(
  reviewId: string,
  actorId: string | null,
  db: Db = prisma,
): Promise<AwardResult> {
  return runInTransaction(db, async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      select: { userId: true, status: true },
    });
    if (!review) throw new AppError("NOT_FOUND", "Critique introuvable.");
    if (review.status !== "APPROVED") return skipped("not_eligible");
    const rule = await tx.pointRule.findUnique({
      where: { code: RULE_CODES.reviewApproved },
      select: eventRuleSelect,
    });
    return award(tx, {
      userId: review.userId,
      rule,
      sourceType: "REVIEW",
      sourceId: reviewId,
      actorId,
    });
  });
}

/** Correction manuelle d'une ligne : une seule inverse par ligne, jamais l'inverse d'une inverse. */
export async function reversePointTransaction(
  transactionId: string,
  actorId: string,
  reason: string,
  db: Db = prisma,
): Promise<{ id: string; points: number }> {
  const motive = reason.trim();
  if (motive.length < 3) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { reason: "Indiquez le motif de la correction." },
    });
  }
  return runInTransaction(db, async (tx) => {
    const reversal = await reverseInTx(tx, transactionId, actorId, motive, { forbidSelf: true });
    await evaluateBadges(reversal.userId, tx);
    return { id: reversal.id, points: reversal.points };
  });
}

/** Ajustement manuel motivé, positif ou négatif (source `MANUAL`). */
export async function grantManualPoints(
  input: { userId: string; points: number; reason: string },
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string; badges: string[] }> {
  const reason = input.reason.trim();
  const { points } = input;
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > MAX_MANUAL_POINTS) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: {
        points: `Un nombre entier non nul, entre −${MAX_MANUAL_POINTS} et ${MAX_MANUAL_POINTS}.`,
      },
    });
  }
  if (reason.length < 3) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { reason: "Indiquez le motif de l’ajustement." },
    });
  }
  if (actorId === input.userId) {
    throw new AppError("FORBIDDEN", "Vous ne pouvez pas vous attribuer de points.");
  }
  return runInTransaction(db, async (tx) => {
    if ((await memberStatus(tx, input.userId)) !== "member") {
      throw new AppError("NOT_FOUND", "Membre introuvable.");
    }
    // Une ligne manuelle est sa propre source : elle n'entre pas dans l'anti-doublon des règles.
    const id = randomUUID();
    await tx.pointTransaction.create({
      data: {
        id,
        userId: input.userId,
        points,
        sourceType: "MANUAL",
        sourceId: id,
        reason,
        createdById: actorId,
      },
    });
    await audit(
      {
        actorId,
        action: "points.granted",
        entityType: "PointTransaction",
        entityId: id,
        metadata: { userId: input.userId, points, reason },
      },
      tx,
    );
    return { id, badges: await evaluateBadges(input.userId, tx) };
  });
}

/** Barème : valeur (0 à 1 000) et activation d'une règle. Le passé n'est pas recalculé. */
export async function updatePointRule(
  input: { id: string; points: number; isActive: boolean },
  actorId: string,
  db: Db = prisma,
): Promise<{ changed: boolean }> {
  if (!Number.isInteger(input.points) || input.points < 0 || input.points > MAX_RULE_POINTS) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { points: `Un nombre entier entre 0 et ${MAX_RULE_POINTS}.` },
    });
  }
  return runInTransaction(db, async (tx) => {
    const rule = await tx.pointRule.findUnique({
      where: { id: input.id },
      select: { id: true, code: true, points: true, isActive: true },
    });
    if (!rule) throw new AppError("NOT_FOUND", "Règle introuvable.");
    if (rule.points === input.points && rule.isActive === input.isActive) return { changed: false };
    await tx.pointRule.update({
      where: { id: rule.id },
      data: { points: input.points, isActive: input.isActive },
    });
    await audit(
      {
        actorId,
        action: "points.rule_updated",
        entityType: "PointRule",
        entityId: rule.id,
        metadata: {
          rule: rule.code,
          before: { points: rule.points, isActive: rule.isActive },
          after: { points: input.points, isActive: input.isActive },
        },
      },
      tx,
    );
    return { changed: true };
  });
}

/**
 * Change la règle des points de présence. Vaut pour les pointages suivants : ce qui est déjà payé
 * n'est jamais annulé ; un nouveau pointage de la même présence (décochée puis recochée) paie les
 * règles attendues qui manquent (docs/REGLES-METIER.md).
 */
export async function setAttendancePointMode(
  mode: AttendancePointMode,
  actorId: string,
  db: Db = prisma,
): Promise<{ changed: boolean }> {
  return runInTransaction(db, async (tx) => {
    const before = await getAttendancePointMode(tx);
    if (before === mode) return { changed: false };
    await tx.setting.upsert({
      where: { key: ATTENDANCE_MODE_KEY },
      update: { value: { mode }, updatedById: actorId },
      create: { key: ATTENDANCE_MODE_KEY, value: { mode }, updatedById: actorId },
    });
    await audit(
      {
        actorId,
        action: "points.attendance_mode_updated",
        entityType: "Setting",
        entityId: ATTENDANCE_MODE_KEY,
        metadata: { before, after: mode },
      },
      tx,
    );
    return { changed: true };
  });
}

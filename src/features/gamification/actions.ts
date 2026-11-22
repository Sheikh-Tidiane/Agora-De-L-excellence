"use server";

import {
  grantPointsSchema,
  manualBadgeSchema,
  pointRuleSchema,
  reverseTransactionSchema,
} from "@/features/gamification/schemas";
import {
  awardManualBadge,
  grantManualPoints,
  reversePointTransaction,
  updatePointRule,
} from "@/features/gamification/service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/**
 * Administration des points et badges. Ordre : contrôle d'accès, validation Zod, service
 * (qui refuse de s'attribuer des points et écrit dans `AuditLog`).
 */

export async function grantManualPointsAction(input: {
  userId: string;
  points: number;
  reason: string;
}): Promise<ActionResult<{ id: string; badges: string[] }>> {
  return runAction("points.grant", async () => {
    const actor = await requirePermission("points.grant");
    return grantManualPoints(parseInput(grantPointsSchema, input), actor.id);
  });
}

export async function reversePointTransactionAction(input: {
  transactionId: string;
  reason: string;
}): Promise<ActionResult<{ id: string; points: number }>> {
  return runAction("points.reverse", async () => {
    const actor = await requirePermission("points.grant");
    const { transactionId, reason } = parseInput(reverseTransactionSchema, input);
    return reversePointTransaction(transactionId, actor.id, reason);
  });
}

export async function awardManualBadgeAction(input: {
  userId: string;
  badgeCode: string;
  reason: string;
}): Promise<ActionResult> {
  return runAction("badges.award", async () => {
    const actor = await requirePermission("badges.award");
    await awardManualBadge(parseInput(manualBadgeSchema, input), actor.id);
    return undefined;
  });
}

export async function updatePointRuleAction(input: {
  id: string;
  points: number;
  isActive: boolean;
}): Promise<ActionResult<{ changed: boolean }>> {
  return runAction("points.rules", async () => {
    const actor = await requirePermission("points.rules.manage");
    return updatePointRule(parseInput(pointRuleSchema, input), actor.id);
  });
}

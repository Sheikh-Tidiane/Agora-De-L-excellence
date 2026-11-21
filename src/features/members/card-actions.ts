"use server";

import { revokeCardToken } from "@/features/members/card-service";
import { regenerateCardSchema, revokeCardSchema } from "@/features/members/card-schemas";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";

/**
 * Carte de membre. Ordre : contrôle d'accès, validation Zod, limite de débit, puis service
 * (qui écrit dans `AuditLog`). Aucun identifiant n'est reçu pour sa propre carte : c'est celle de la session.
 */

/** Le membre remplace sa carte (téléphone perdu, capture partagée) : l'ancienne n'est plus acceptée. */
export async function regenerateMyCardAction(input: {
  confirm: true;
}): Promise<ActionResult<{ issuedAt: Date }>> {
  return runAction("members.card.regenerate", async () => {
    const actor = await requirePermission("member.access");
    parseInput(regenerateCardSchema, input);
    await enforceRateLimit("member.card.regenerate", actor.id);
    const { issuedAt } = await revokeCardToken(actor.id, actor.id, "Carte remplacée par le membre");
    return { issuedAt };
  });
}

/** Un responsable révoque la carte d'un membre, avec un motif. */
export async function revokeMemberCardAction(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult> {
  return runAction("members.card.revoke", async () => {
    const actor = await requirePermission("members.manage");
    const { userId, reason } = parseInput(revokeCardSchema, input);
    await revokeCardToken(userId, actor.id, reason);
    return undefined;
  });
}

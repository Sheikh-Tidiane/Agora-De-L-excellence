"use server";

import { rules } from "@/config/rules";
import {
  membershipRequestSchema,
  rejectRequestSchema,
  requestIdsSchema,
  type MembershipRequestInput,
} from "@/features/memberships/schemas";
import {
  approveMembershipRequest,
  purgeRejectedRequests,
  rejectMembershipRequest,
  submitMembershipRequest,
} from "@/features/memberships/service";
import { AppError, parseInput, runAction, toFailure, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/request";

/** Envoi d'une demande d'adhésion : action publique par nature, limitée en débit. */
export async function submitMembershipRequestAction(
  input: MembershipRequestInput,
): Promise<ActionResult> {
  return runAction("memberships.submit", async () => {
    const data = parseInput(membershipRequestSchema, input);
    // Par IP d'abord (large : une salle sur le même Wi-Fi), puis par adresse e-mail (3 par jour).
    await enforceRateLimit("membership.submit.ip", await clientAddress());
    await enforceRateLimit("membership.submit.email", data.email);
    await submitMembershipRequest(data);
    return undefined;
  });
}

export type BulkOutcome = {
  done: number;
  failed: { id: string; message: string }[];
  note?: string;
};

/** Valide une ou plusieurs demandes. Chaque demande est traitée séparément : une erreur n'annule pas les autres. */
export async function approveRequestsAction(input: {
  ids: string[];
}): Promise<ActionResult<BulkOutcome>> {
  return runAction("memberships.approve", async () => {
    const actor = await requirePermission("memberships.review");
    const { ids } = parseInput(requestIdsSchema, input);
    const outcome: BulkOutcome = { done: 0, failed: [] };
    let unsent = 0;
    for (const id of ids) {
      try {
        const result = await approveMembershipRequest(id, actor.id);
        outcome.done++;
        if (!result.emailSent) unsent++;
      } catch (error) {
        outcome.failed.push({ id, message: toFailure(error, "memberships.approve").message });
      }
    }
    if (outcome.done === 0 && outcome.failed.length === 1) {
      throw new AppError("CONFLICT", outcome.failed[0]!.message);
    }
    if (unsent > 0) {
      outcome.note =
        "L’e-mail d’activation n’a pas pu partir pour au moins un compte : renvoyez le lien depuis la fiche du membre.";
    }
    // Ménage opportuniste des demandes refusées trop anciennes.
    void purgeRejectedRequests(rules["membership.rejectedRetentionMonths"]).catch(() => undefined);
    return outcome;
  });
}

export async function rejectRequestAction(input: {
  id: string;
  reason: string;
}): Promise<ActionResult<{ emailSent: boolean }>> {
  return runAction("memberships.reject", async () => {
    const actor = await requirePermission("memberships.review");
    const data = parseInput(rejectRequestSchema, input);
    return rejectMembershipRequest(data.id, data.reason, actor.id);
  });
}

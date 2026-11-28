"use server";

import {
  feedbackSchema,
  guestFeedbackSchema,
  hideFeedbackSchema,
  restoreFeedbackSchema,
  type FeedbackInput,
  type GuestFeedbackInput,
} from "@/features/feedback/schemas";
import {
  hideFeedbackComment,
  restoreFeedbackComment,
  saveGuestFeedback,
  saveMemberFeedback,
} from "@/features/feedback/service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/request";

/** Avis après une rencontre. Le membre ne donne que le sien ; les responsables modèrent. */

export async function saveFeedbackAction(
  input: FeedbackInput,
): Promise<ActionResult<{ created: boolean }>> {
  return runAction("feedback.save", async () => {
    const user = await requirePermission("member.access");
    const data = parseInput(feedbackSchema, input);
    return saveMemberFeedback(user.id, data);
  });
}

/** Publique : l'invité présent donne son avis depuis le lien personnel reçu par e-mail. */
export async function saveGuestFeedbackAction(
  input: GuestFeedbackInput,
): Promise<ActionResult<{ created: boolean }>> {
  return runAction("feedback.saveGuest", async () => {
    const { token, ...data } = parseInput(guestFeedbackSchema, input);
    await enforceRateLimit("public.token.ip", await clientAddress());
    return saveGuestFeedback(token, data);
  });
}

export async function hideFeedbackCommentAction(input: {
  id: string;
  reason: string;
  version: string;
}): Promise<ActionResult> {
  return runAction("feedback.hide", async () => {
    const actor = await requirePermission("feedback.moderate");
    await hideFeedbackComment(actor.id, parseInput(hideFeedbackSchema, input));
    return undefined;
  });
}

export async function restoreFeedbackCommentAction(input: {
  id: string;
  version: string;
}): Promise<ActionResult> {
  return runAction("feedback.restore", async () => {
    const actor = await requirePermission("feedback.moderate");
    await restoreFeedbackComment(actor.id, parseInput(restoreFeedbackSchema, input));
    return undefined;
  });
}

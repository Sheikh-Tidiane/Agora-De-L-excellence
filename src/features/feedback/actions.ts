"use server";

import {
  feedbackSchema,
  hideFeedbackSchema,
  restoreFeedbackSchema,
  type FeedbackInput,
} from "@/features/feedback/schemas";
import {
  hideFeedbackComment,
  restoreFeedbackComment,
  saveMemberFeedback,
} from "@/features/feedback/service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

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

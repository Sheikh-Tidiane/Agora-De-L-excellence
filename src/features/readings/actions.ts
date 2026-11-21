"use server";

import { refresh, updateTag } from "next/cache";
import {
  addReadingSchema,
  decisionSchema,
  readingIdSchema,
  reviewDecisionSchema,
  reviewSchema,
  updateReadingSchema,
  type AddReadingInput,
  type DecisionInput,
  type ReviewDecisionInput,
  type ReviewInput,
  type UpdateReadingInput,
} from "@/features/readings/schemas";
import {
  addReading,
  decideReading,
  decideReview,
  removeReading,
  saveReview,
  submitReadingForValidation,
  updateReading,
} from "@/features/readings/service";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/**
 * Lectures. Côté membre : `member.access`, et le compte vient toujours de la session (le service
 * vérifie que la lecture lui appartient). Côté club : `readings.validate` et `reviews.moderate`.
 */

export async function addReadingAction(
  input: AddReadingInput,
): Promise<ActionResult<{ readingId: string }>> {
  return runAction("readings.add", async () => {
    const user = await requirePermission("member.access");
    const reading = await addReading(user.id, parseInput(addReadingSchema, input));
    refresh();
    return { readingId: reading.id };
  });
}

export async function updateReadingAction(input: UpdateReadingInput): Promise<ActionResult> {
  return runAction("readings.update", async () => {
    const user = await requirePermission("member.access");
    await updateReading(user.id, parseInput(updateReadingSchema, input));
    refresh();
    return undefined;
  });
}

export async function submitReadingAction(input: { readingId: string }): Promise<ActionResult> {
  return runAction("readings.submit", async () => {
    const user = await requirePermission("member.access");
    const { readingId } = parseInput(readingIdSchema, input);
    await submitReadingForValidation(user.id, readingId);
    refresh();
    return undefined;
  });
}

export async function removeReadingAction(input: { readingId: string }): Promise<ActionResult> {
  return runAction("readings.remove", async () => {
    const user = await requirePermission("member.access");
    const { readingId } = parseInput(readingIdSchema, input);
    await removeReading(user.id, readingId);
    return undefined;
  });
}

export async function saveReviewAction(input: ReviewInput): Promise<ActionResult> {
  return runAction("reviews.save", async () => {
    const user = await requirePermission("member.access");
    await saveReview(user.id, parseInput(reviewSchema, input));
    // Une critique publiée qui repasse en relecture quitte la fiche publique du livre.
    updateTag(cacheTags.books);
    refresh();
    return undefined;
  });
}

export async function decideReadingAction(input: DecisionInput): Promise<ActionResult> {
  return runAction("readings.decide", async () => {
    const actor = await requirePermission("readings.validate");
    await decideReading(actor, parseInput(decisionSchema, input));
    refresh();
    return undefined;
  });
}

export async function decideReviewAction(input: ReviewDecisionInput): Promise<ActionResult> {
  return runAction("reviews.decide", async () => {
    const actor = await requirePermission("reviews.moderate");
    await decideReview(actor, parseInput(reviewDecisionSchema, input));
    updateTag(cacheTags.books);
    refresh();
    return undefined;
  });
}

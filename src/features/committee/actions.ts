"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { committeeMemberSchema, type CommitteeMemberInput } from "@/features/committee/schemas";
import {
  moveCommitteeMember,
  removeCommitteeMember,
  saveCommitteeMember,
} from "@/features/committee/service";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Comité de pilotage : chaque action exige `settings.manage`, est tracée, et rafraîchit le site. */
const idSchema = z.object({ id: z.string().min(1).max(40) });
const moveSchema = idSchema.extend({ direction: z.enum(["up", "down"]) });

export async function saveCommitteeMemberAction(
  input: CommitteeMemberInput,
): Promise<ActionResult<{ id: string }>> {
  return runAction("committee.save", async () => {
    const actor = await requirePermission("settings.manage");
    const saved = await saveCommitteeMember(parseInput(committeeMemberSchema, input), actor.id);
    updateTag(cacheTags.committee);
    return saved;
  });
}

export async function removeCommitteeMemberAction(input: { id: string }): Promise<ActionResult> {
  return runAction("committee.remove", async () => {
    const actor = await requirePermission("settings.manage");
    await removeCommitteeMember(parseInput(idSchema, input).id, actor.id);
    updateTag(cacheTags.committee);
    return undefined;
  });
}

export async function moveCommitteeMemberAction(input: {
  id: string;
  direction: "up" | "down";
}): Promise<ActionResult> {
  return runAction("committee.move", async () => {
    const actor = await requirePermission("settings.manage");
    const { id, direction } = parseInput(moveSchema, input);
    await moveCommitteeMember(id, direction, actor.id);
    updateTag(cacheTags.committee);
    return undefined;
  });
}

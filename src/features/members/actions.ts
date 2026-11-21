"use server";

import { updateTag } from "next/cache";
import { sendActivationEmail } from "@/features/auth/service";
import {
  memberIdSchema,
  memberUpdateSchema,
  suspendSchema,
  type MemberUpdateInput,
} from "@/features/members/schemas";
import {
  archiveMember,
  reactivateMember,
  renewMembership,
  suspendMember,
  updateMember,
} from "@/features/members/service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { cacheTags } from "@/lib/cache-tags";
import { requirePermission } from "@/lib/permissions";

/** Gestion des membres. Chaque action exige `members.manage` ; le service trace l'opération. */

export async function updateMemberAction(input: MemberUpdateInput): Promise<ActionResult> {
  return runAction("members.update", async () => {
    const actor = await requirePermission("members.manage");
    const { userId, ...data } = parseInput(memberUpdateSchema, input);
    await updateMember(userId, data, actor);
    // Nom affiché dans les résultats publics du Scrabble (en cache).
    updateTag(cacheTags.scrabble);
    return undefined;
  });
}

export async function suspendMemberAction(input: {
  userId: string;
  reason: string;
}): Promise<ActionResult> {
  return runAction("members.suspend", async () => {
    const actor = await requirePermission("members.manage");
    const { userId, reason } = parseInput(suspendSchema, input);
    await suspendMember(userId, reason, actor);
    return undefined;
  });
}

export async function reactivateMemberAction(input: { userId: string }): Promise<ActionResult> {
  return runAction("members.reactivate", async () => {
    const actor = await requirePermission("members.manage");
    const { userId } = parseInput(memberIdSchema, input);
    await reactivateMember(userId, actor);
    return undefined;
  });
}

export async function renewMembershipAction(input: {
  userId: string;
}): Promise<ActionResult<{ endsAt: Date }>> {
  return runAction("members.renew", async () => {
    const actor = await requirePermission("members.manage");
    const { userId } = parseInput(memberIdSchema, input);
    return renewMembership(userId, actor);
  });
}

export async function archiveMemberAction(input: { userId: string }): Promise<ActionResult> {
  return runAction("members.archive", async () => {
    const actor = await requirePermission("members.manage");
    const { userId } = parseInput(memberIdSchema, input);
    await archiveMember(userId, actor);
    // Anonymisation : le nom ne doit plus rester dans les résultats publics du Scrabble.
    updateTag(cacheTags.scrabble);
    return undefined;
  });
}

/** Renvoie le lien d'activation à un compte qui n'a pas encore choisi son mot de passe. */
export async function resendActivationAction(input: { userId: string }): Promise<ActionResult> {
  return runAction("members.resendActivation", async () => {
    const actor = await requirePermission("members.manage");
    const { userId } = parseInput(memberIdSchema, input);
    await sendActivationEmail(userId, actor.id);
    return undefined;
  });
}

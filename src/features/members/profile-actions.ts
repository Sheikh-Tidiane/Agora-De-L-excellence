"use server";

import { refresh, updateTag } from "next/cache";
import { ownProfileSchema, type OwnProfileInput } from "@/features/members/profile-schemas";
import { updateOwnProfile } from "@/features/members/profile-service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { cacheTags } from "@/lib/cache-tags";
import { requirePermission } from "@/lib/permissions";

/** Le membre modifie son téléphone et sa présence dans les classements. Son compte vient de la session. */
export async function updateOwnProfileAction(input: OwnProfileInput): Promise<ActionResult> {
  return runAction("members.updateOwnProfile", async () => {
    const user = await requirePermission("member.access");
    const data = parseInput(ownProfileSchema, input);
    await updateOwnProfile(user.id, data);
    // Le retrait des classements masque aussi le nom dans les résultats publics du Scrabble (en cache).
    updateTag(cacheTags.scrabble);
    refresh();
    return undefined;
  });
}

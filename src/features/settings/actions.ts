"use server";

import { updateTag } from "next/cache";
import { charterSchema, updateCharter, type CharterInput } from "@/features/settings/charter";
import { updateClubSettings } from "@/features/settings/club";
import { clubSettingsSchema, type ClubSettingsInput } from "@/features/settings/schemas";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Paramètres du club : exige `settings.manage`, trace les clés modifiées, rafraîchit le site. */
export async function saveClubSettingsAction(
  input: ClubSettingsInput,
): Promise<ActionResult<{ changed: number }>> {
  return runAction("settings.save", async () => {
    const actor = await requirePermission("settings.manage");
    const changed = await updateClubSettings(parseInput(clubSettingsSchema, input), actor.id);
    if (changed.length > 0) updateTag(cacheTags.settings);
    return { changed: changed.length };
  });
}

/** Charte du club : exige `settings.manage`. La version n'augmente que si le texte change. */
export async function saveCharterAction(
  input: CharterInput,
): Promise<ActionResult<{ version: number; changed: boolean }>> {
  return runAction("charter.save", async () => {
    const actor = await requirePermission("settings.manage");
    const result = await updateCharter(parseInput(charterSchema, input), actor.id);
    if (result.changed) updateTag(cacheTags.settings);
    return result;
  });
}

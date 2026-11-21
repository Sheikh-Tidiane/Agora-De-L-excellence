"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { markAllRead, markRead } from "@/features/notifications/service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requireUser } from "@/lib/permissions";

/** Le membre ne touche qu'à ses propres notifications : le compte vient de la session. */

const idSchema = z.object({ id: z.string().trim().min(1).max(40) });

export async function markNotificationReadAction(input: { id: string }): Promise<ActionResult> {
  return runAction("notifications.read", async () => {
    const user = await requireUser();
    const { id } = parseInput(idSchema, input);
    await markRead(user.id, id);
    revalidatePath("/member", "layout");
    return undefined;
  });
}

const emptySchema = z.object({}).strict();

export async function markAllNotificationsReadAction(
  input: Record<string, never>,
): Promise<ActionResult<{ count: number }>> {
  return runAction("notifications.read_all", async () => {
    const user = await requireUser();
    parseInput(emptySchema, input);
    const count = await markAllRead(user.id);
    revalidatePath("/member", "layout");
    return { count };
  });
}

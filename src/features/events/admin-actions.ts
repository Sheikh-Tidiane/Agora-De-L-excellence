"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import {
  eventReportSchema,
  eventSchema,
  eventStatusSchema,
  type EventReportInput,
  registrationIdSchema,
  type EventInput,
} from "@/features/events/schemas";
import {
  archiveEvent,
  createEvent,
  removeRegistration,
  saveEventReport,
  setEventStatus,
  updateEvent,
} from "@/features/events/service";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Gestion des événements. Chaque action exige `events.manage` et rafraîchit le site public. */
const idSchema = z.object({ id: z.string().min(1).max(40) });
/** Identifiant facultatif d'un enregistrement : absent ou vide = création. Toujours validé. */
const optionalIdSchema = z.object({ id: z.string().max(40).optional() });

export async function saveEventAction(
  input: EventInput & { id?: string },
): Promise<ActionResult<{ id: string }>> {
  return runAction("events.save", async () => {
    const actor = await requirePermission("events.manage");
    const data = parseInput(eventSchema, input);
    const id = parseInput(optionalIdSchema, input).id || null;
    if (id) await updateEvent(id, data);
    const saved = id ? { id } : await createEvent(data, actor.id);
    updateTag(cacheTags.events);
    return saved;
  });
}

export async function setEventStatusAction(input: {
  eventId: string;
  status: string;
}): Promise<ActionResult> {
  return runAction("events.setStatus", async () => {
    const actor = await requirePermission("events.manage");
    const { eventId, status } = parseInput(eventStatusSchema, input);
    await setEventStatus(eventId, status, actor.id);
    updateTag(cacheTags.events);
    return undefined;
  });
}

export async function saveEventReportAction(
  input: EventReportInput,
): Promise<ActionResult<{ published: boolean }>> {
  return runAction("events.report", async () => {
    const actor = await requirePermission("events.manage");
    const result = await saveEventReport(parseInput(eventReportSchema, input), actor.id);
    updateTag(cacheTags.events);
    return result;
  });
}

export async function archiveEventAction(input: { id: string }): Promise<ActionResult> {
  return runAction("events.archive", async () => {
    const actor = await requirePermission("events.manage");
    await archiveEvent(parseInput(idSchema, input).id, actor.id);
    updateTag(cacheTags.events);
    return undefined;
  });
}

export async function removeRegistrationAction(input: {
  registrationId: string;
}): Promise<ActionResult> {
  return runAction("events.removeRegistration", async () => {
    const actor = await requirePermission("events.manage");
    await removeRegistration(parseInput(registrationIdSchema, input).registrationId, actor.id);
    return undefined;
  });
}

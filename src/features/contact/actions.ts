"use server";

import { rules } from "@/config/rules";
import {
  contactSchema,
  contactStatusSchema,
  type ContactInput,
  type ContactStatusInput,
} from "@/features/contact/schemas";
import {
  purgeHandledContactMessages,
  recordContactMessage,
  setContactMessageStatus,
} from "@/features/contact/service";
import { contactRecipient, loadClubSettings } from "@/features/settings/club";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/request";

/**
 * Formulaire de contact : action publique par nature, limitée en débit. Le message est enregistré
 * en base (administration, rubrique Messages), puis part par e-mail au club. Si l'e-mail échoue,
 * le message reste enregistré et le visiteur reçoit quand même sa confirmation.
 */
export async function sendContactMessageAction(input: ContactInput): Promise<ActionResult> {
  return runAction("contact.send", async () => {
    const data = parseInput(contactSchema, input);
    await enforceRateLimit("contact.ip", await clientAddress());
    // Champ piège rempli : un robot. On répond comme si tout allait bien, sans rien enregistrer.
    if (data.website) return undefined;
    const recipient = await loadClubSettings()
      .then(contactRecipient)
      .catch((error: unknown) => {
        logger.error("Adresse de contact du club illisible", error);
        return null;
      });
    await recordContactMessage(
      { name: data.name, email: data.email, subject: data.subject, message: data.message },
      recipient || null,
    );
    return undefined;
  });
}

/** Change le statut d'un message de contact (nouveau, lu, traité). */
export async function setContactMessageStatusAction(
  input: ContactStatusInput,
): Promise<ActionResult> {
  return runAction("contact.status", async () => {
    const actor = await requirePermission("contact.manage");
    const data = parseInput(contactStatusSchema, input);
    await prisma.$transaction((tx) => setContactMessageStatus(data.id, data.status, actor.id, tx));
    // Ménage opportuniste des messages traités trop anciens (même mécanisme que les adhésions refusées).
    void purgeHandledContactMessages(rules["contact.handledRetentionMonths"]).catch(
      () => undefined,
    );
    return undefined;
  });
}

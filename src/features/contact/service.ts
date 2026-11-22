import "server-only";
import { audit } from "@/lib/audit";
import { addMonths } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { contactEmail } from "@/lib/mail/club-templates";
import { prisma, type Db } from "@/lib/prisma";
import type { ContactStatus } from "@/features/contact/schemas";

export type ContactMessageInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

/**
 * Enregistre un message du formulaire de contact, puis prévient le club par e-mail.
 * Le message est conservé quoi qu'il arrive à l'e-mail : un échec d'envoi (ou l'absence
 * d'adresse du club) ne fait pas échouer l'envoi du visiteur, le message attend dans l'admin.
 */
export async function recordContactMessage(
  input: ContactMessageInput,
  recipient: string | null,
  db: Db = prisma,
): Promise<{ id: string; emailSent: boolean }> {
  const saved = await db.contactMessage.create({
    data: {
      name: input.name,
      email: input.email,
      subject: input.subject,
      message: input.message,
    },
    select: { id: true },
  });
  if (!recipient) {
    logger.warn("Message de contact enregistré sans adresse du club pour le prévenir", {
      messageId: saved.id,
    });
    return { id: saved.id, emailSent: false };
  }
  try {
    await sendMail(contactEmail({ to: recipient, ...input }));
  } catch (error) {
    logger.error("Message de contact enregistré, mais e-mail au club non envoyé", error, {
      messageId: saved.id,
    });
    return { id: saved.id, emailSent: false };
  }
  await db.contactMessage.update({ where: { id: saved.id }, data: { emailSent: true } });
  return { id: saved.id, emailSent: true };
}

/**
 * Change le statut d'un message. « Lu » et « traité » gardent leur première date ; revenir
 * en arrière efface la date de traitement, qui sert de point de départ à la conservation.
 */
export async function setContactMessageStatus(
  id: string,
  status: ContactStatus,
  actorId: string,
  db: Db = prisma,
  now = new Date(),
): Promise<void> {
  const current = await db.contactMessage.findUnique({
    where: { id },
    select: { status: true, readAt: true },
  });
  if (!current) throw new AppError("NOT_FOUND", "Ce message n’existe plus.");
  if (current.status === status) return;
  await db.contactMessage.update({
    where: { id },
    data: {
      status,
      readAt: status === "NEW" ? null : (current.readAt ?? now),
      handledAt: status === "HANDLED" ? now : null,
      handledById: status === "HANDLED" ? actorId : null,
    },
  });
  await audit(
    {
      actorId,
      action: "contact.status_changed",
      entityType: "ContactMessage",
      entityId: id,
      metadata: { from: current.status, to: status },
    },
    db,
  );
}

/** Messages traités depuis plus de `months` mois : supprimés (REGLES-METIER, données personnelles). */
export async function purgeHandledContactMessages(
  months: number,
  now = new Date(),
  db: Db = prisma,
): Promise<number> {
  const { count } = await db.contactMessage.deleteMany({
    where: { status: "HANDLED", handledAt: { lt: addMonths(now, -months) } },
  });
  return count;
}

export function countNewContactMessages(db: Db = prisma): Promise<number> {
  return db.contactMessage.count({ where: { status: "NEW" } });
}

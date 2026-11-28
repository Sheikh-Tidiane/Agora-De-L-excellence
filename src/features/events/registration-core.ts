import { cancellationDeadline, placeLabel } from "@/features/events/rules";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail, type MailMessage } from "@/lib/mail";
import type { Db } from "@/lib/prisma";

/**
 * Socle commun des inscriptions et de la liste d'attente. Toute écriture qui prend ou libère une
 * place commence par `lockEvent` : le verrou de la ligne de l'événement sérialise les inscriptions,
 * annulations et promotions d'une même rencontre (jamais deux personnes sur la dernière place).
 */
export async function lockEvent(tx: Db, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
  return tx.event.findFirst({ where: { id: eventId, archivedAt: null } });
}

export type LockedEvent = NonNullable<Awaited<ReturnType<typeof lockEvent>>>;

export const registrationUrl = (token: string) =>
  `${env.APP_URL}/events/registration?token=${token}`;

const whenOf = (event: { startsAt: Date }) =>
  `${formatFullDate(event.startsAt)}, ${formatTime(event.startsAt)}`;

export const eventInfo = (event: Pick<LockedEvent, "title" | "startsAt" | "location">) => ({
  title: event.title,
  when: whenOf(event),
  place: placeLabel(event.location),
});

/** Un e-mail qui ne part pas ne doit pas annuler une inscription déjà enregistrée. */
export async function sendSafely(message: MailMessage): Promise<boolean> {
  try {
    await sendMail(message);
    return true;
  } catch (error) {
    logger.error("E-mail d’inscription non envoyé", error);
    return false;
  }
}

export async function cancelBeforeLabel(
  event: Pick<LockedEvent, "startsAt" | "cancellationDeadlineHours">,
  now: Date,
) {
  const { cancellationDeadlineHours: hours } = await loadClubSettings();
  const deadline = cancellationDeadline(event, hours);
  return deadline.getTime() > now.getTime()
    ? `${formatFullDate(deadline)} à ${formatTime(deadline)}`
    : null;
}

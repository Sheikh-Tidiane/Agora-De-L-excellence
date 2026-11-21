import { randomBytes } from "node:crypto";
import { hashToken } from "@/features/auth/service";
import { countSeatsTaken } from "@/features/events/queries";
import {
  canCancel,
  cancellationDeadline,
  GUEST_HOLD_HOURS,
  refusalMessages,
  refuseRegistration,
  placeLabel,
} from "@/features/events/rules";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { notify } from "@/features/notifications/service";
import { sendMail, type MailMessage } from "@/lib/mail";
import { guestConfirmationEmail, registrationConfirmedEmail } from "@/lib/mail/club-templates";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Inscriptions aux rencontres : membre connecté, ou invité si la rencontre est ouverte au public.
 * La capacité est vérifiée dans une transaction qui verrouille la ligne de l'événement :
 * deux inscriptions simultanées ne peuvent pas prendre la même dernière place.
 */
type LockedEvent = NonNullable<Awaited<ReturnType<typeof lockEvent>>>;

async function lockEvent(tx: Db, eventId: string) {
  await tx.$queryRaw`SELECT id FROM "Event" WHERE id = ${eventId} FOR UPDATE`;
  return tx.event.findFirst({ where: { id: eventId, archivedAt: null } });
}

const whenOf = (event: { startsAt: Date }) =>
  `${formatFullDate(event.startsAt)}, ${formatTime(event.startsAt)}`;

const eventInfo = (event: LockedEvent) => ({
  title: event.title,
  when: whenOf(event),
  place: placeLabel(event.location),
});

/** Un e-mail qui ne part pas ne doit pas annuler une inscription déjà enregistrée. */
async function sendSafely(message: MailMessage) {
  try {
    await sendMail(message);
  } catch (error) {
    logger.error("E-mail d’inscription non envoyé", error);
  }
}

async function cancelBeforeLabel(event: LockedEvent, now: Date) {
  const { cancellationDeadlineHours: hours } = await loadClubSettings();
  const deadline = cancellationDeadline(event, hours);
  return deadline.getTime() > now.getTime()
    ? `${formatFullDate(deadline)} à ${formatTime(deadline)}`
    : null;
}

/** Inscription d'un membre connecté : confirmée tout de suite. */
export async function registerMember(
  eventId: string,
  member: { id: string; firstName: string; email: string },
): Promise<{ id: string }> {
  const now = new Date();
  const { event, registration } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const existing = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: member.id } },
    });
    if (existing?.status === "CONFIRMED") {
      throw new AppError("CONFLICT", "Vous êtes déjà inscrit à cette rencontre.");
    }
    const refusal = refuseRegistration(
      event,
      await countSeatsTaken(eventId, now, tx),
      now,
      "member",
    );
    if (refusal) throw new AppError("CONFLICT", refusalMessages[refusal]);
    const data = { status: "CONFIRMED" as const, confirmedAt: now, cancelledAt: null };
    const registration = existing
      ? await tx.eventRegistration.update({ where: { id: existing.id }, data })
      : await tx.eventRegistration.create({ data: { eventId, userId: member.id, ...data } });
    return { event, registration };
  });
  await sendSafely(
    registrationConfirmedEmail({
      to: member.email,
      name: member.firstName,
      event: eventInfo(event),
      url: `${env.APP_URL}/events/${event.slug}`,
      cancelBefore: await cancelBeforeLabel(event, now),
    }),
  );
  // L'e-mail de confirmation vient de partir : la notification reste dans l'espace.
  await notify({
    userId: member.id,
    type: "event.registered",
    title: `Inscription confirmée : ${event.title}`,
    body: "Votre place est réservée. Vous retrouvez la rencontre dans « Mes rencontres ».",
    href: "/member/events",
  });
  return { id: registration.id };
}

const registrationUrl = (token: string) => `${env.APP_URL}/events/registration?token=${token}`;

/**
 * Inscription d'un invité (rencontre ouverte au public) : en attente jusqu'au clic sur le lien
 * reçu par e-mail. La place est retenue 24 h. Seul le SHA-256 du jeton est stocké.
 */
export async function registerGuest(
  eventId: string,
  guest: { name: string; email: string },
): Promise<void> {
  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const event = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const existing = await tx.eventRegistration.findUnique({
      where: { eventId_guestEmail: { eventId, guestEmail: guest.email } },
    });
    if (existing?.status === "CONFIRMED") {
      throw new AppError("CONFLICT", "Cette adresse e-mail est déjà inscrite à cette rencontre.");
    }
    // Sa propre demande en attente ne compte pas contre lui s'il la renouvelle.
    const taken = await tx.eventRegistration.count({
      where: {
        eventId,
        id: existing ? { not: existing.id } : undefined,
        OR: [
          { status: "CONFIRMED" },
          {
            status: "PENDING",
            updatedAt: { gt: new Date(now.getTime() - GUEST_HOLD_HOURS * 3_600_000) },
          },
        ],
      },
    });
    const refusal = refuseRegistration(event, taken, now, "guest");
    if (refusal) throw new AppError("CONFLICT", refusalMessages[refusal]);
    const data = {
      guestName: guest.name,
      status: "PENDING" as const,
      tokenHash: hashToken(token),
      confirmedAt: null,
      cancelledAt: null,
    };
    if (existing) await tx.eventRegistration.update({ where: { id: existing.id }, data });
    else await tx.eventRegistration.create({ data: { eventId, guestEmail: guest.email, ...data } });
    return event;
  });
  // Ici l'e-mail est indispensable : sans lui, l'invité ne peut pas confirmer. Son échec remonte.
  await sendMail(
    guestConfirmationEmail({
      to: guest.email,
      name: guest.name,
      event: eventInfo(event),
      url: registrationUrl(token),
      validHours: GUEST_HOLD_HOURS,
    }),
  );
}

/** Inscription invitée désignée par le jeton de son lien, avec sa rencontre. */
export async function getGuestRegistration(token: string) {
  if (!token || token.length < 16 || token.length > 200) return null;
  const registration = await prisma.eventRegistration.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      status: true,
      guestName: true,
      updatedAt: true,
      event: {
        select: {
          slug: true,
          title: true,
          status: true,
          location: true,
          startsAt: true,
          cancellationDeadlineHours: true,
          archivedAt: true,
        },
      },
    },
  });
  return registration && !registration.event.archivedAt ? registration : null;
}

/** L'invité confirme sa place depuis le lien reçu par e-mail. */
export async function confirmGuestRegistration(token: string): Promise<void> {
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const found = await tx.eventRegistration.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!found) throw new AppError("INVALID_TOKEN", "Ce lien d’inscription n’est plus valable.");
    const event = await lockEvent(tx, found.eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    if (found.status === "CONFIRMED") return null;
    if (found.status === "CANCELLED") {
      throw new AppError("CONFLICT", "Cette inscription a été annulée. Inscrivez-vous à nouveau.");
    }
    const taken = await tx.eventRegistration.count({
      where: {
        eventId: event.id,
        id: { not: found.id },
        OR: [
          { status: "CONFIRMED" },
          {
            status: "PENDING",
            updatedAt: { gt: new Date(now.getTime() - GUEST_HOLD_HOURS * 3_600_000) },
          },
        ],
      },
    });
    const refusal = refuseRegistration(event, taken, now, "guest");
    if (refusal) throw new AppError("CONFLICT", refusalMessages[refusal]);
    await tx.eventRegistration.update({
      where: { id: found.id },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    return { event, registration: found };
  });
  if (!result) return;
  await sendSafely(
    registrationConfirmedEmail({
      to: result.registration.guestEmail!,
      name: result.registration.guestName ?? "",
      event: eventInfo(result.event),
      url: registrationUrl(token),
      cancelBefore: await cancelBeforeLabel(result.event, now),
    }),
  );
}

async function assertCancellable(
  event: {
    status: LockedEvent["status"];
    startsAt: Date;
    cancellationDeadlineHours: number | null;
  },
  now: Date,
) {
  const { cancellationDeadlineHours } = await loadClubSettings();
  if (!canCancel(event, now, cancellationDeadlineHours)) {
    throw new AppError(
      "CONFLICT",
      "Le délai d’annulation est dépassé. Prévenez le club si vous ne pouvez pas venir.",
    );
  }
}

/** Annulation par l'invité, depuis son lien. */
export async function cancelGuestRegistration(token: string): Promise<void> {
  const registration = await prisma.eventRegistration.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { event: true },
  });
  if (!registration)
    throw new AppError("INVALID_TOKEN", "Ce lien d’inscription n’est plus valable.");
  if (registration.status === "CANCELLED") return;
  const now = new Date();
  await assertCancellable(registration.event, now);
  await prisma.eventRegistration.update({
    where: { id: registration.id },
    data: { status: "CANCELLED", cancelledAt: now },
  });
}

/** Annulation par un membre : uniquement sa propre inscription. */
export async function cancelMemberRegistration(
  registrationId: string,
  userId: string,
): Promise<{ eventSlug: string }> {
  const registration = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    include: { event: true },
  });
  // Même réponse que l'inscription n'existe pas ou appartienne à quelqu'un d'autre.
  if (!registration || registration.userId !== userId) {
    throw new AppError("NOT_FOUND", "Inscription introuvable.");
  }
  if (registration.status !== "CANCELLED") {
    const now = new Date();
    await assertCancellable(registration.event, now);
    await prisma.eventRegistration.update({
      where: { id: registration.id },
      data: { status: "CANCELLED", cancelledAt: now },
    });
  }
  return { eventSlug: registration.event.slug };
}

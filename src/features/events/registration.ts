import { randomBytes } from "node:crypto";
import { hashToken } from "@/features/auth/service";
import { countSeatsTaken } from "@/features/events/queries";
import {
  canCancel,
  GUEST_HOLD_HOURS,
  refusalMessages,
  refuseRegistration,
} from "@/features/events/rules";
import { loadClubSettings } from "@/features/settings/club";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { notify } from "@/features/notifications/service";
import { sendMail } from "@/lib/mail";
import { guestConfirmationEmail, registrationConfirmedEmail } from "@/lib/mail/club-templates";
import { prisma, type Db } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import {
  catchUpWaitlist,
  fillFreedSeats,
  sendPromotionMessages,
  type Promotion,
} from "@/features/events/waitlist";
import {
  cancelBeforeLabel,
  eventInfo,
  lockEvent,
  registrationUrl,
  sendSafely,
  type LockedEvent,
} from "@/features/events/registration-core";

/**
 * Inscriptions aux rencontres : membre connecté, ou invité si la rencontre est ouverte au public.
 * La capacité est vérifiée dans une transaction qui verrouille la ligne de l'événement :
 * deux inscriptions simultanées ne peuvent pas prendre la même dernière place.
 */
/**
 * Inscription directe d'une ligne existante : depuis la liste d'attente (place libre après le
 * seuil), le rang est gardé et la promotion notée ; après une annulation, l'historique repart à zéro.
 */
function waitlistFields(
  existing: { status: string; waitlistedAt: Date | null } | null,
  now: Date,
): { waitlistedAt?: Date | null; promotedAt?: Date | null } {
  if (!existing) return {};
  if (existing.status === "WAITLISTED" && existing.waitlistedAt) return { promotedAt: now };
  return { waitlistedAt: null, promotedAt: null };
}

/** Inscription d'un membre connecté : confirmée tout de suite. */
export async function registerMember(
  eventId: string,
  member: { id: string; firstName: string; email: string },
): Promise<{ id: string }> {
  const now = new Date();
  // Une place rendue (invité qui n'a pas confirmé à temps) revient d'abord à la liste d'attente.
  await catchUpWaitlist(eventId, now);
  const { event, registration, promotions } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const promotions: Promotion[] = [];
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
    const data = {
      status: "CONFIRMED" as const,
      confirmedAt: now,
      cancelledAt: null,
      ...waitlistFields(existing, now),
    };
    const registration = existing
      ? await tx.eventRegistration.update({ where: { id: existing.id }, data })
      : await tx.eventRegistration.create({ data: { eventId, userId: member.id, ...data } });
    return { event, registration, promotions };
  });
  await sendPromotionMessages(event, promotions, now);
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

export { registrationUrl };

/**
 * Inscription invitée désignée par un jeton : celui du lien de confirmation, ou celui joint à un
 * e-mail automatique (rappel la veille). Les deux restent valables ; seuls leurs SHA-256 sont
 * gardés. Deux recherches par index unique (pas de `OR` sur une relation, qui parcourrait la table).
 */
async function registrationIdByGuestToken(token: string, db: Db = prisma): Promise<string | null> {
  if (!token || token.length < 16 || token.length > 200) return null;
  const hash = hashToken(token);
  const direct = await db.eventRegistration.findUnique({
    where: { tokenHash: hash },
    select: { id: true },
  });
  if (direct) return direct.id;
  const mail = await db.registrationMail.findUnique({
    where: { tokenHash: hash },
    select: { registrationId: true },
  });
  return mail?.registrationId ?? null;
}

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
  await catchUpWaitlist(eventId, now);
  const { event, promotions } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const promotions: Promotion[] = [];
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
      ...waitlistFields(existing, now),
    };
    if (existing) {
      await tx.eventRegistration.update({ where: { id: existing.id }, data });
      // Nouvelle demande : les liens des rappels de l'inscription précédente ne valent plus.
      await tx.registrationMail.updateMany({
        where: { registrationId: existing.id },
        data: { tokenHash: null },
      });
    } else
      await tx.eventRegistration.create({ data: { eventId, guestEmail: guest.email, ...data } });
    return { event, promotions };
  });
  await sendPromotionMessages(event, promotions, now);
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
  const id = await registrationIdByGuestToken(token);
  if (!id) return null;
  const registration = await prisma.eventRegistration.findUnique({
    where: { id },
    select: {
      id: true,
      eventId: true,
      status: true,
      guestName: true,
      updatedAt: true,
      waitlistedAt: true,
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

/**
 * L'invité confirme depuis le lien reçu par e-mail : sa place (inscription en attente de
 * confirmation), ou son adresse pour la liste d'attente (il prend alors son rang).
 */
export async function confirmGuestRegistration(token: string): Promise<void> {
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const first = await prisma.eventRegistration.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { eventId: true, status: true },
  });
  if (!first) throw new AppError("INVALID_TOKEN", "Ce lien d’inscription n’est plus valable.");
  // Confirmation d'une place : les places rendues reviennent d'abord à la liste d'attente.
  if (first.status === "PENDING") await catchUpWaitlist(first.eventId, now);
  const result = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, first.eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    // Relue sous le verrou : son état a pu changer (annulée, réinscrite) depuis la première lecture.
    const found = await tx.eventRegistration.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!found) throw new AppError("INVALID_TOKEN", "Ce lien d’inscription n’est plus valable.");
    if (found.status === "CONFIRMED") return null;
    if (found.status === "CANCELLED") {
      throw new AppError("CONFLICT", "Cette inscription a été annulée. Inscrivez-vous à nouveau.");
    }
    if (found.status === "WAITLISTED") {
      if (found.waitlistedAt) return null;
      await tx.eventRegistration.update({
        where: { id: found.id },
        data: { waitlistedAt: now },
      });
      await audit(
        {
          actorId: null,
          action: "event.waitlist_joined",
          entityType: "EventRegistration",
          entityId: found.id,
          metadata: { eventId: event.id, guest: true },
        },
        tx,
      );
      // Une place s'est peut-être libérée entre-temps : la file avance (lui compris).
      const promotions = await fillFreedSeats(tx, event, now, waitlistCutoffHours, "catch-up");
      return { event, registration: found, promotions, confirmed: false };
    }
    const promotions: Promotion[] = [];
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
    return { event, registration: found, promotions, confirmed: true };
  });
  if (!result) return;
  await sendPromotionMessages(result.event, result.promotions, now);
  if (!result.confirmed) return;
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

/**
 * Annule une inscription (ou une place sur la liste d'attente) sous le verrou de l'événement ;
 * une place libérée va aussitôt à la première personne en attente. Quitter la liste d'attente
 * reste possible après le délai d'annulation.
 */
async function cancelRegistration(
  registrationId: string,
  eventId: string,
  canCancelNow: (event: LockedEvent) => Promise<void>,
  actorId: string | null,
): Promise<void> {
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const result = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const registration = await tx.eventRegistration.findUnique({ where: { id: registrationId } });
    if (!registration || registration.status === "CANCELLED") return null;
    const waiting = registration.status === "WAITLISTED";
    if (!waiting) await canCancelNow(event);
    await tx.eventRegistration.update({
      where: { id: registrationId },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    if (waiting) {
      await audit(
        {
          actorId,
          action: "event.waitlist_left",
          entityType: "EventRegistration",
          entityId: registrationId,
          metadata: { eventId, guest: registration.userId === null },
        },
        tx,
      );
      return null;
    }
    return {
      event,
      promotions: await fillFreedSeats(tx, event, now, waitlistCutoffHours, "cancellation"),
    };
  });
  if (result) await sendPromotionMessages(result.event, result.promotions, now);
}

/** Annulation par l'invité, depuis son lien (inscription ou liste d'attente). */
export async function cancelGuestRegistration(token: string): Promise<void> {
  const id = await registrationIdByGuestToken(token);
  const registration = id
    ? await prisma.eventRegistration.findUnique({
        where: { id },
        select: { id: true, eventId: true },
      })
    : null;
  if (!registration)
    throw new AppError("INVALID_TOKEN", "Ce lien d’inscription n’est plus valable.");
  await cancelRegistration(
    registration.id,
    registration.eventId,
    (event) => assertCancellable(event, new Date()),
    null,
  );
}

/** Annulation par un membre : uniquement sa propre inscription (ou sa place sur la liste). */
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
  await cancelRegistration(
    registration.id,
    registration.eventId,
    (event) => assertCancellable(event, new Date()),
    userId,
  );
  return { eventSlug: registration.event.slug };
}

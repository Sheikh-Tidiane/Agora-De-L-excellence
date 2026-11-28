import { randomBytes, randomUUID } from "node:crypto";
import { hashToken } from "@/features/auth/service";
import { calendarLinks } from "@/features/events/calendar";
import { countSeatsTaken } from "@/features/events/queries";
import {
  cancelBeforeLabel,
  eventInfo,
  lockEvent,
  registrationUrl,
  type LockedEvent,
} from "@/features/events/registration-core";
import {
  holdCutoff,
  promotionOpen,
  refusalMessages,
  refuseRegistration,
  registrationWindow,
  waitlistOpen,
} from "@/features/events/rules";
import { createNotifications } from "@/features/notifications/service";
import { loadClubSettings } from "@/features/settings/club";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { guestWaitlistConfirmEmail, waitlistPromotedEmail } from "@/lib/mail/club-templates";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Liste d'attente des rencontres complètes (docs/REGLES-METIER.md, « Liste d'attente »).
 *
 * - Une personne en attente est une inscription `WAITLISTED` dont `waitlistedAt` donne le rang
 *   (invité : posé quand il a confirmé son adresse ; avant, il n'a pas de rang).
 * - Une place libérée (annulation, capacité augmentée, invité qui n'a pas confirmé à temps) va
 *   d'office à la première personne, dans la transaction qui la libère, après `lockEvent` :
 *   le verrou de l'événement sérialise annulations, inscriptions et promotions.
 * - Promotion automatique jusqu'au seuil réglé (2 h avant le début) ; ensuite la place est libre
 *   pour tous, et un responsable peut encore inscrire quelqu'un à la main.
 * - Les e-mails partent après la transaction ; un e-mail non parti est renvoyé par la tâche horaire.
 */

export type Promotion = {
  registrationId: string;
  mailId: string;
  email: string;
  name: string;
  /** Lien personnel de l'invité (jeton en clair, jamais stocké) ; `null` pour un membre. */
  guestToken: string | null;
  manual: boolean;
};

export type FillReason =
  "cancellation" | "removal" | "capacity" | "republished" | "expiry" | "catch-up";

/** Au plus autant de promotions par passage (capacité supprimée avec une longue liste). */
const MAX_PER_PASS = 200;
const CLAIM_LEASE_MS = 30 * 60_000;
const MAX_ATTEMPTS = 3;

const rankOrder = [{ waitlistedAt: "asc" as const }, { id: "asc" as const }];

/** Personnes en attente qui peuvent recevoir une place (membre actif ; invité si ouvert au public). */
function eligibleWhere(event: Pick<LockedEvent, "id" | "isPublic">) {
  return {
    eventId: event.id,
    status: "WAITLISTED" as const,
    waitlistedAt: { not: null },
    OR: [
      ...(event.isPublic ? [{ userId: null }] : []),
      { user: { status: "ACTIVE" as const, archivedAt: null } },
    ],
  };
}

/**
 * Inscrit la personne en attente et prépare son e-mail (ligne `RegistrationMail` réservée, avec
 * un jeton propre pour un invité). Dans la transaction de l'appelant.
 */
async function promote(
  tx: Db,
  event: LockedEvent,
  registration: {
    id: string;
    userId: string | null;
    guestEmail: string | null;
    guestName: string | null;
    user: { firstName: string; email: string } | null;
  },
  now: Date,
  manual: boolean,
): Promise<Promotion> {
  await tx.eventRegistration.update({
    where: { id: registration.id },
    data: { status: "CONFIRMED", confirmedAt: now, promotedAt: now, cancelledAt: null },
  });
  const guestToken = registration.userId ? null : randomBytes(32).toString("base64url");
  const mail = await tx.registrationMail.upsert({
    where: {
      registrationId_kind_eventStartsAt: {
        registrationId: registration.id,
        kind: "WAITLIST_PROMOTED",
        eventStartsAt: event.startsAt,
      },
    },
    create: {
      id: randomUUID(),
      registrationId: registration.id,
      kind: "WAITLIST_PROMOTED",
      eventStartsAt: event.startsAt,
      claimedAt: now,
      tokenHash: guestToken && hashToken(guestToken),
    },
    update: {
      claimedAt: now,
      sentAt: null,
      attempts: 1,
      tokenHash: guestToken && hashToken(guestToken),
    },
    select: { id: true },
  });
  if (registration.userId) {
    await createNotifications(
      [
        {
          userId: registration.userId,
          type: "event.waitlist_promoted",
          title: `Une place s’est libérée : ${event.title}`,
          body: "Vous étiez sur la liste d’attente : vous êtes maintenant inscrit.",
          href: "/member/events",
        },
      ],
      tx,
    );
  }
  return {
    registrationId: registration.id,
    mailId: mail.id,
    email: registration.user?.email ?? registration.guestEmail!,
    name: registration.user?.firstName ?? registration.guestName ?? "",
    guestToken,
    manual,
  };
}

const promotedSelect = {
  id: true,
  userId: true,
  guestEmail: true,
  guestName: true,
  user: { select: { firstName: true, email: true } },
} as const;

/**
 * Donne les places libres aux premières personnes en attente. Précondition : `lockEvent` pris dans
 * cette transaction. Rend les promotions, dont les e-mails partent après le commit.
 */
export async function fillFreedSeats(
  tx: Db,
  event: LockedEvent,
  now: Date,
  cutoffHours: number,
  reason: FillReason,
): Promise<Promotion[]> {
  if (!promotionOpen(event, now, cutoffHours)) return [];
  const free =
    event.capacity === null
      ? MAX_PER_PASS
      : Math.min(MAX_PER_PASS, event.capacity - (await countSeatsTaken(event.id, now, tx)));
  if (free <= 0) return [];
  const candidates = await tx.eventRegistration.findMany({
    where: eligibleWhere(event),
    orderBy: rankOrder,
    take: free,
    select: promotedSelect,
  });
  const promotions: Promotion[] = [];
  for (const candidate of candidates) {
    promotions.push(await promote(tx, event, candidate, now, false));
    await audit(
      {
        actorId: null,
        action: "event.waitlist_promoted",
        entityType: "EventRegistration",
        entityId: candidate.id,
        metadata: { eventId: event.id, mode: "auto", reason, guest: candidate.userId === null },
      },
      tx,
    );
  }
  return promotions;
}

/** E-mails « une place s'est libérée », après la transaction. Échec : renvoyé par la tâche. */
export async function sendPromotionMessages(
  event: LockedEvent,
  promotions: readonly Promotion[],
  now: Date = new Date(),
): Promise<number> {
  if (promotions.length === 0) return 0;
  const cancelBefore = await cancelBeforeLabel(event, now);
  let sent = 0;
  for (const promotion of promotions) {
    try {
      await sendMail(
        waitlistPromotedEmail({
          to: promotion.email,
          name: promotion.name,
          event: eventInfo(event),
          url: promotion.guestToken
            ? registrationUrl(promotion.guestToken)
            : `${env.APP_URL}/events/${event.slug}#inscription`,
          calendar: calendarLinks(event, env.APP_URL),
          cancelBefore,
          manual: promotion.manual,
        }),
      );
    } catch (error) {
      logger.error("E-mail de place obtenue non envoyé", error);
      await prisma.registrationMail
        .update({ where: { id: promotion.mailId }, data: { claimedAt: null } })
        .catch((release) => logger.error("Réservation d’e-mail non libérée", release));
      continue;
    }
    sent += 1;
    await prisma.registrationMail
      .update({ where: { id: promotion.mailId }, data: { sentAt: new Date() } })
      .catch((mark) => logger.error("E-mail de place obtenue envoyé mais non marqué", mark));
  }
  return sent;
}

/** Rang (1 = la prochaine personne servie) d'une inscription en attente. */
export async function waitlistPosition(
  registration: { id: string; eventId: string; waitlistedAt: Date },
  db: Db = prisma,
): Promise<number> {
  const ahead = await db.eventRegistration.count({
    where: {
      eventId: registration.eventId,
      status: "WAITLISTED",
      OR: [
        { waitlistedAt: { lt: registration.waitlistedAt } },
        { waitlistedAt: registration.waitlistedAt, id: { lt: registration.id } },
      ],
    },
  });
  return ahead + 1;
}

/** Nombre de personnes en attente (avec un rang). */
export function countWaitlisted(eventId: string, db: Db = prisma): Promise<number> {
  return db.eventRegistration.count({
    where: { eventId, status: "WAITLISTED", waitlistedAt: { not: null } },
  });
}

/** Liste d'attente d'une rencontre, dans l'ordre (fiche d'administration). */
export async function getWaitlist(eventId: string) {
  const rows = await prisma.eventRegistration.findMany({
    where: { eventId, status: "WAITLISTED" },
    orderBy: rankOrder,
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestEmail: true,
      waitlistedAt: true,
      createdAt: true,
      user: { select: { name: true, email: true, memberNumber: true, status: true } },
    },
  });
  // Les invités qui n'ont pas encore confirmé leur adresse viennent après, sans rang.
  const ranked = rows.filter((r) => r.waitlistedAt !== null);
  const unverified = rows.filter((r) => r.waitlistedAt === null);
  return [
    ...ranked.map((r, index) => ({ ...r, position: (index + 1) as number | null })),
    ...unverified.map((r) => ({ ...r, position: null as number | null })),
  ];
}

export type JoinOutcome =
  | { outcome: "waitlisted"; position: number }
  | { outcome: "verify" }
  /** Une place est libre : l'appelant inscrit directement. */
  | { outcome: "register" };

/** Refus d'entrée : rencontre passée, annulée, réservée aux membres, ou liste close. */
function assertCanJoin(
  event: LockedEvent,
  taken: number,
  now: Date,
  cutoffHours: number,
  kind: "member" | "guest",
) {
  const refusal = refuseRegistration(event, taken, now, kind);
  if (refusal === null) return "free" as const;
  if (refusal !== "FULL") throw new AppError("CONFLICT", refusalMessages[refusal]);
  if (!waitlistOpen(event, now, cutoffHours)) {
    throw new AppError("CONFLICT", "Cette rencontre est complète et sa liste d’attente est close.");
  }
  return "full" as const;
}

/** Un membre rejoint la liste d'attente d'une rencontre complète. */
export async function joinWaitlistAsMember(
  eventId: string,
  memberId: string,
): Promise<JoinOutcome> {
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const { outcome, promotions, event } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const promotions = await fillFreedSeats(tx, event, now, waitlistCutoffHours, "catch-up");
    const existing = await tx.eventRegistration.findUnique({
      where: { eventId_userId: { eventId, userId: memberId } },
    });
    if (existing?.status === "CONFIRMED") {
      throw new AppError("CONFLICT", "Vous êtes déjà inscrit à cette rencontre.");
    }
    if (existing?.status === "WAITLISTED" && existing.waitlistedAt) {
      const position = await waitlistPosition(
        { ...existing, waitlistedAt: existing.waitlistedAt },
        tx,
      );
      return { outcome: { outcome: "waitlisted", position } as JoinOutcome, promotions, event };
    }
    const taken = await countSeatsTaken(eventId, now, tx);
    if (assertCanJoin(event, taken, now, waitlistCutoffHours, "member") === "free") {
      return { outcome: { outcome: "register" } as JoinOutcome, promotions, event };
    }
    const data = {
      status: "WAITLISTED" as const,
      waitlistedAt: now,
      promotedAt: null,
      confirmedAt: null,
      cancelledAt: null,
    };
    const registration = existing
      ? await tx.eventRegistration.update({ where: { id: existing.id }, data })
      : await tx.eventRegistration.create({ data: { eventId, userId: memberId, ...data } });
    await audit(
      {
        actorId: memberId,
        action: "event.waitlist_joined",
        entityType: "EventRegistration",
        entityId: registration.id,
        metadata: { eventId },
      },
      tx,
    );
    const position = await waitlistPosition({ ...registration, waitlistedAt: now }, tx);
    return { outcome: { outcome: "waitlisted", position } as JoinOutcome, promotions, event };
  });
  await sendPromotionMessages(event, promotions, now);
  return outcome;
}

/**
 * Un visiteur demande une place sur la liste d'attente : il reçoit un lien pour confirmer son
 * adresse (sans quoi il n'a pas de rang). Le même lien permet ensuite de quitter la liste.
 */
export async function joinWaitlistAsGuest(
  eventId: string,
  guest: { name: string; email: string },
): Promise<JoinOutcome> {
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const token = randomBytes(32).toString("base64url");
  const { outcome, promotions, event } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, eventId);
    if (!event) throw new AppError("NOT_FOUND", "Cette rencontre est introuvable.");
    const promotions = await fillFreedSeats(tx, event, now, waitlistCutoffHours, "catch-up");
    const existing = await tx.eventRegistration.findUnique({
      where: { eventId_guestEmail: { eventId, guestEmail: guest.email } },
    });
    if (
      existing?.status === "CONFIRMED" ||
      (existing?.status === "PENDING" && existing.updatedAt > holdCutoff(now))
    ) {
      throw new AppError("CONFLICT", "Cette adresse e-mail est déjà inscrite à cette rencontre.");
    }
    const taken = await countSeatsTaken(eventId, now, tx);
    if (assertCanJoin(event, taken, now, waitlistCutoffHours, "guest") === "free") {
      return { outcome: { outcome: "register" } as JoinOutcome, promotions, event };
    }
    // Déjà sur la liste : nouveau lien, rang conservé ; les liens des anciens e-mails ne valent plus.
    const keepRank = existing?.status === "WAITLISTED" ? existing.waitlistedAt : null;
    const data = {
      guestName: guest.name,
      status: "WAITLISTED" as const,
      tokenHash: hashToken(token),
      waitlistedAt: keepRank,
      promotedAt: null,
      confirmedAt: null,
      cancelledAt: null,
    };
    if (existing) {
      await tx.eventRegistration.update({ where: { id: existing.id }, data });
      await tx.registrationMail.updateMany({
        where: { registrationId: existing.id },
        data: { tokenHash: null },
      });
    } else {
      await tx.eventRegistration.create({ data: { eventId, guestEmail: guest.email, ...data } });
    }
    return { outcome: { outcome: "verify" } as JoinOutcome, promotions, event };
  });
  await sendPromotionMessages(event, promotions, now);
  if (outcome.outcome === "verify") {
    // Indispensable : sans ce lien, l'invité ne peut pas prendre son rang. Son échec remonte.
    await sendMail(
      guestWaitlistConfirmEmail({
        to: guest.email,
        name: guest.name,
        event: eventInfo(event),
        url: registrationUrl(token),
      }),
    );
  }
  return outcome;
}

/**
 * Un responsable inscrit une personne en attente, quel que soit son rang. Au-delà de la capacité,
 * seulement avec `force` (confirmation explicite dans l'interface).
 */
export async function promoteFromWaitlist(
  registrationId: string,
  actorId: string,
  force: boolean,
): Promise<void> {
  const now = new Date();
  const found = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { eventId: true },
  });
  if (!found) throw new AppError("NOT_FOUND", "Inscription introuvable.");
  const { event, promotion } = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, found.eventId);
    if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
    const registration = await tx.eventRegistration.findUnique({
      where: { id: registrationId },
      select: {
        ...promotedSelect,
        status: true,
        waitlistedAt: true,
        user: { select: { firstName: true, email: true, status: true, archivedAt: true } },
      },
    });
    if (!registration || registration.status !== "WAITLISTED") {
      throw new AppError("CONFLICT", "Cette personne n’est plus sur la liste d’attente.");
    }
    if (!registration.waitlistedAt) {
      throw new AppError("CONFLICT", "Cet invité n’a pas encore confirmé son adresse e-mail.");
    }
    if (
      registration.user &&
      (registration.user.status !== "ACTIVE" || registration.user.archivedAt)
    ) {
      throw new AppError("CONFLICT", "Ce compte n’est pas actif.");
    }
    if (registrationWindow(event, now) !== "open") {
      throw new AppError("CONFLICT", "Les inscriptions à cette rencontre sont fermées.");
    }
    const taken = await countSeatsTaken(event.id, now, tx);
    const overCapacity = event.capacity !== null && taken >= event.capacity;
    if (overCapacity && !force) {
      throw new AppError(
        "CONFLICT",
        `Rencontre complète (${taken}/${event.capacity}) : confirmez l’inscription au-delà de la capacité.`,
      );
    }
    const position = await waitlistPosition(
      { id: registrationId, eventId: event.id, waitlistedAt: registration.waitlistedAt },
      tx,
    );
    const promotion = await promote(tx, event, registration, now, true);
    await audit(
      {
        actorId,
        action: "event.waitlist_promoted",
        entityType: "EventRegistration",
        entityId: registrationId,
        metadata: {
          eventId: event.id,
          mode: "manual",
          position,
          overCapacity,
          guest: registration.userId === null,
        },
      },
      tx,
    );
    return { event, promotion };
  });
  await sendPromotionMessages(event, [promotion], now);
}

/**
 * Tâche horaire « liste-attente » : places rendues par les invités qui n'ont pas confirmé à temps
 * (aucun geste ne les libère), puis e-mails de place obtenue restés en échec. Idempotente.
 */
export async function runWaitlistTask(now: Date = new Date()): Promise<string> {
  const { waitlistCutoffHours } = await loadClubSettings();
  const events = await prisma.event.findMany({
    where: {
      status: "PUBLISHED",
      archivedAt: null,
      startsAt: { gt: new Date(now.getTime() + waitlistCutoffHours * 3_600_000) },
      registrations: { some: { status: "WAITLISTED", waitlistedAt: { not: null } } },
    },
    select: { id: true },
  });
  let promoted = 0;
  for (const { id } of events) {
    const result = await prisma.$transaction(async (tx) => {
      const event = await lockEvent(tx, id);
      if (!event) return null;
      return { event, list: await fillFreedSeats(tx, event, now, waitlistCutoffHours, "expiry") };
    });
    if (!result) continue;
    promoted += result.list.length;
    await sendPromotionMessages(result.event, result.list, now);
  }
  const resent = await resendPromotionMessages(now);
  return `${events.length} rencontre(s) avec une liste d’attente ; ${promoted} promotion(s) ; ${resent} e-mail(s) renvoyé(s).`;
}

/** E-mails de place obtenue non partis (échec, ou programme arrêté) : 3 tentatives au plus. */
async function resendPromotionMessages(now: Date): Promise<number> {
  const stale = await prisma.registrationMail.findMany({
    where: {
      kind: "WAITLIST_PROMOTED",
      sentAt: null,
      attempts: { lt: MAX_ATTEMPTS },
      OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - CLAIM_LEASE_MS) } }],
      registration: { status: "CONFIRMED", event: { archivedAt: null, startsAt: { gt: now } } },
    },
    select: {
      id: true,
      claimedAt: true,
      registration: { select: { ...promotedSelect, eventId: true } },
    },
    take: 100,
  });
  let resent = 0;
  for (const mail of stale) {
    const registration = mail.registration;
    const guestToken = registration.userId ? null : randomBytes(32).toString("base64url");
    // Réservation : un seul passage reprend cet e-mail.
    const { count } = await prisma.registrationMail.updateMany({
      where: {
        id: mail.id,
        sentAt: null,
        claimedAt: mail.claimedAt,
      },
      data: {
        claimedAt: now,
        attempts: { increment: 1 },
        tokenHash: guestToken && hashToken(guestToken),
      },
    });
    if (count === 0) continue;
    const event = await prisma.event.findUnique({ where: { id: registration.eventId } });
    if (!event) continue;
    resent += await sendPromotionMessages(
      event,
      [
        {
          registrationId: registration.id,
          mailId: mail.id,
          email: registration.user?.email ?? registration.guestEmail!,
          name: registration.user?.firstName ?? registration.guestName ?? "",
          guestToken,
          manual: false,
        },
      ],
      now,
    );
  }
  return resent;
}

/** Listes d'attente d'un membre pour les rencontres à venir, avec son rang (espace membre). */
export async function getMyWaitlist(userId: string, now: Date) {
  const rows = await prisma.eventRegistration.findMany({
    where: {
      userId,
      status: "WAITLISTED",
      waitlistedAt: { not: null },
      event: { startsAt: { gte: now }, archivedAt: null, status: { not: "DRAFT" } },
    },
    orderBy: { event: { startsAt: "asc" } },
    select: {
      id: true,
      eventId: true,
      waitlistedAt: true,
      event: { select: { slug: true, title: true, startsAt: true } },
    },
  });
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      position: await waitlistPosition({ ...row, waitlistedAt: row.waitlistedAt! }),
    })),
  );
}

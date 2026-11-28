import { randomBytes, randomUUID } from "node:crypto";

import { hashToken } from "@/features/auth/service";
import { calendarLinks } from "@/features/events/calendar";
import { registrationUrl } from "@/features/events/registration";
import {
  alreadyReminded,
  CLAIM_LEASE_MINUTES,
  dayWord,
  MAX_ATTEMPTS,
  REMINDER_CLOSE_HOURS,
  reminderDue,
} from "@/features/events/reminder-rules";
import { cancellationDeadline, placeLabel } from "@/features/events/rules";
import { hideVideoLink } from "@/features/members/card-dues";
import { cardDuesFor } from "@/features/members/card-dues-queries";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { eventReminderEmail } from "@/lib/mail/club-templates";
import { prisma } from "@/lib/prisma";

/**
 * Rappels la veille des rencontres (docs/REGLES-METIER.md, « Rappels la veille ») : un e-mail à
 * chaque inscrit confirmé — membre actif qui n'a pas désactivé les rappels, ou invité —, dans la
 * fenêtre de `reminder-rules.ts`. Lancé chaque heure par les tâches planifiées (scripts/taches.ts).
 *
 * Sans doublon : chaque rappel est d'abord réservé dans `RegistrationMail` par une seule instruction
 * SQL (unique par inscription, sorte et horaire annoncé), qui revérifie l'inscription et la
 * rencontre. Deux passages simultanés : le second ne réserve rien. Envoi réussi : `sentAt` ; échec :
 * la réservation est libérée et le passage suivant réessaie (3 tentatives au plus). Un processus
 * tombé entre l'envoi et le marquage laisse une réservation reprise après 30 min (doublon rare,
 * préféré à un rappel perdu ; un envoi réussi dont seul le marquage échoue n'est pas relancé avant).
 */
export type EventReminderRun = { checked: number; sent: number; failed: number; skipped: number };

const HOUR = 3_600_000;
const BATCH = 500;

export async function sendEventReminders(
  now: Date = new Date(),
  scope: { eventIds?: string[] } = {},
): Promise<EventReminderRun> {
  const run: EventReminderRun = { checked: 0, sent: 0, failed: 0, skipped: 0 };
  const settings = await loadClubSettings();
  if (!settings.eventRemindersEnabled) return run;

  const candidates = await prisma.eventRegistration.findMany({
    where: {
      status: "CONFIRMED",
      ...(scope.eventIds ? { eventId: { in: scope.eventIds } } : {}),
      event: {
        status: { in: ["PUBLISHED", "CLOSED"] },
        archivedAt: null,
        startsAt: {
          gt: new Date(now.getTime() + REMINDER_CLOSE_HOURS * HOUR),
          lte: new Date(now.getTime() + 48 * HOUR),
        },
      },
      OR: [
        { userId: null, guestEmail: { not: null } },
        { user: { status: "ACTIVE", archivedAt: null, eventReminders: true } },
      ],
    },
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestEmail: true,
      confirmedAt: true,
      createdAt: true,
      user: { select: { firstName: true, email: true } },
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          summary: true,
          location: true,
          startsAt: true,
          endsAt: true,
          status: true,
          updatedAt: true,
          videoLink: true,
          cancellationDeadlineHours: true,
        },
      },
      mails: {
        where: { kind: "EVENT_REMINDER", sentAt: { not: null } },
        select: { eventStartsAt: true },
      },
    },
    orderBy: { event: { startsAt: "asc" } },
  });
  const due = candidates
    .filter(
      (r) =>
        reminderDue({ ...r, startsAt: r.event.startsAt }, settings.eventReminderHour, now) &&
        !alreadyReminded(
          r.mails.map((m) => m.eventStartsAt),
          r.event.startsAt,
        ),
    )
    .slice(0, BATCH);
  run.checked = due.length;

  const memberIds = due.flatMap((r) => (r.userId ? [r.userId] : []));
  const dues = settings.hideVideoWhenCardUnpaid
    ? await cardDuesFor(memberIds, settings.cardGraceDays, now)
    : new Map();

  for (const registration of due) {
    const { event } = registration;
    const guest = registration.userId === null;
    const token = guest ? randomBytes(32).toString("base64url") : null;
    const claimed = await claim(registration.id, event.startsAt, token && hashToken(token), now);
    if (!claimed) {
      run.skipped += 1;
      continue;
    }
    const deadline = cancellationDeadline(event, settings.cancellationDeadlineHours);
    const card = registration.userId ? dues.get(registration.userId) : undefined;
    const message = eventReminderEmail({
      to: guest ? registration.guestEmail! : registration.user!.email,
      name: guest ? (registration.guestName ?? "") : registration.user!.firstName,
      event: {
        title: event.title,
        when: `${formatFullDate(event.startsAt)}, ${formatTime(event.startsAt)}`,
        place: placeLabel(event.location),
      },
      dayAndTime: `${dayWord(event.startsAt, now)} à ${formatTime(event.startsAt)}`,
      audience: guest ? "guest" : "member",
      manageUrl: guest
        ? registrationUrl(token!)
        : `${env.APP_URL}/events/${event.slug}#inscription`,
      videoLink: guest ? null : event.videoLink,
      videoHidden: card ? hideVideoLink(card, true) : false,
      cardUrl: `${env.APP_URL}/member/card`,
      calendar: calendarLinks(event, env.APP_URL),
      cancelBefore: deadline > now ? `${formatFullDate(deadline)} à ${formatTime(deadline)}` : null,
      rescheduled: registration.mails.length > 0,
      preferencesUrl: guest ? null : `${env.APP_URL}/member/profile`,
    });
    try {
      await sendMail(message);
    } catch (error) {
      // Pas parti : la réservation est libérée, le passage suivant réessaie.
      logger.error("Rappel de rencontre non envoyé", error);
      run.failed += 1;
      await prisma.registrationMail
        .update({ where: { id: claimed }, data: { claimedAt: null } })
        .catch((release) => logger.error("Réservation de rappel non libérée", release));
      continue;
    }
    run.sent += 1;
    try {
      await prisma.registrationMail.update({
        where: { id: claimed },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      // Parti, mais non marqué : la réservation reste (reprise seulement après le bail de 30 min).
      logger.error("Rappel de rencontre envoyé mais non marqué", error);
    }
  }
  logger.info("Rappels de rencontre", run);
  return run;
}

/**
 * Réserve le rappel d'une inscription pour l'horaire annoncé. Rend l'identifiant de la réservation,
 * ou `null` : déjà envoyé, réservé par un autre passage (bail en cours), tentatives épuisées, ou
 * inscription / rencontre qui ne remplit plus les conditions.
 */
async function claim(
  registrationId: string,
  startsAt: Date,
  tokenHash: string | null,
  now: Date,
): Promise<string | null> {
  const leaseEnd = new Date(now.getTime() - CLAIM_LEASE_MINUTES * 60_000);
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "RegistrationMail"
      ("id", "registrationId", "kind", "eventStartsAt", "claimedAt", "attempts", "tokenHash", "updatedAt")
    SELECT ${randomUUID()}, r."id", 'EVENT_REMINDER', e."startsAt", ${now}, 1, ${tokenHash}, ${now}
    FROM "EventRegistration" r JOIN "Event" e ON e."id" = r."eventId"
    WHERE r."id" = ${registrationId} AND r."status" = 'CONFIRMED'
      AND (r."userId" IS NULL OR EXISTS (
        SELECT 1 FROM "User" u WHERE u."id" = r."userId" AND u."status" = 'ACTIVE'
          AND u."archivedAt" IS NULL AND u."eventReminders"
      ))
      AND e."status" IN ('PUBLISHED', 'CLOSED') AND e."archivedAt" IS NULL
      AND e."startsAt" = ${startsAt}
    ON CONFLICT ("registrationId", "kind", "eventStartsAt") DO UPDATE
      SET "claimedAt" = EXCLUDED."claimedAt",
          "attempts" = "RegistrationMail"."attempts" + 1,
          "tokenHash" = EXCLUDED."tokenHash",
          "updatedAt" = EXCLUDED."updatedAt"
      WHERE "RegistrationMail"."sentAt" IS NULL
        AND "RegistrationMail"."attempts" < ${MAX_ATTEMPTS}
        AND ("RegistrationMail"."claimedAt" IS NULL OR "RegistrationMail"."claimedAt" < ${leaseEnd})
    RETURNING "id"`;
  return rows[0]?.id ?? null;
}

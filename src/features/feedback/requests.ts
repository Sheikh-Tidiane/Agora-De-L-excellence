import { randomBytes, randomUUID } from "node:crypto";
import { hashToken } from "@/features/auth/service";
import { feedbackWindow, requestDue } from "@/features/feedback/rules";
import { createNotifications } from "@/features/notifications/service";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { feedbackRequestEmail } from "@/lib/mail/club-templates";
import { prisma } from "@/lib/prisma";

/**
 * Le lendemain d'une rencontre, une invitation à donner son avis à chaque membre pointé présent
 * (e-mail + notification dans l'espace membre). Lancé chaque heure par les tâches planifiées.
 *
 * Sans doublon, comme les rappels la veille (src/features/events/reminders.ts) : l'invitation est
 * réservée dans `RegistrationMail` par une seule instruction SQL qui revérifie l'inscription, la
 * présence, le membre et l'absence d'avis ; envoi réussi : `sentAt`, sinon réservation libérée et
 * nouvel essai au passage suivant (3 tentatives au plus).
 */
export type FeedbackRequestRun = { checked: number; sent: number; failed: number; skipped: number };

const DAY = 86_400_000;
const BATCH = 500;
const LEASE_MINUTES = 30;
const MAX_ATTEMPTS = 3;

export async function sendFeedbackRequests(
  now: Date = new Date(),
  scope: { eventIds?: string[] } = {},
): Promise<FeedbackRequestRun> {
  const run: FeedbackRequestRun = { checked: 0, sent: 0, failed: 0, skipped: 0 };
  const settings = await loadClubSettings();
  if (!settings.feedbackRequestsEnabled) return run;

  const candidates = await prisma.eventRegistration.findMany({
    where: {
      status: "CONFIRMED",
      attendedAt: { not: null },
      feedback: null,
      // Membres actifs, et invités (lien personnel par e-mail).
      OR: [
        { user: { status: "ACTIVE", archivedAt: null } },
        { userId: null, guestEmail: { not: null } },
      ],
      ...(scope.eventIds ? { eventId: { in: scope.eventIds } } : {}),
      event: {
        status: { in: ["PUBLISHED", "CLOSED"] },
        archivedAt: null,
        startsAt: { lt: now, gt: new Date(now.getTime() - 10 * DAY) },
        // (La fenêtre exacte, calculée sur la fin de la rencontre, est vérifiée juste après.)
      },
      mails: { none: { kind: "FEEDBACK_REQUEST", sentAt: { not: null } } },
    },
    select: {
      id: true,
      userId: true,
      guestName: true,
      guestEmail: true,
      user: { select: { firstName: true, email: true } },
      event: { select: { slug: true, title: true, startsAt: true, endsAt: true } },
    },
    orderBy: { event: { startsAt: "asc" } },
  });
  const due = candidates
    .filter((r) => requestDue(feedbackWindow(r.event, settings.feedbackRequestHour), now))
    .slice(0, BATCH);
  run.checked = due.length;

  for (const registration of due) {
    const { event } = registration;
    const guest = registration.userId === null;
    const token = guest ? randomBytes(32).toString("base64url") : null;
    const claimed = await claim(registration.id, event.startsAt, now, token && hashToken(token));
    if (!claimed) {
      run.skipped += 1;
      continue;
    }
    const window = feedbackWindow(event, settings.feedbackRequestHour);
    const closesAt = `${formatFullDate(window.closesAt)} à ${formatTime(window.closesAt)}`;
    const url = token
      ? `${env.APP_URL}/events/avis?token=${token}`
      : `${env.APP_URL}/member/events/${event.slug}/avis`;
    // Notification dans l'espace membre, une seule fois (première tentative), même si l'e-mail
    // échoue : le membre est prévenu par au moins un canal.
    if (claimed.attempts === 1 && registration.userId) {
      await createNotifications([
        {
          userId: registration.userId!,
          type: "event.feedback_request",
          title: `Votre avis sur « ${event.title} »`,
          body: `Une note de 1 à 5 et un mot si vous le souhaitez, jusqu’au ${closesAt}.`,
          href: `/member/events/${event.slug}/avis`,
        },
      ]).catch((error) => logger.error("Notification de demande d’avis non créée", error));
    }
    try {
      await sendMail(
        feedbackRequestEmail({
          to: registration.user?.email ?? registration.guestEmail!,
          name: registration.user?.firstName ?? registration.guestName ?? "",
          title: event.title,
          date: formatFullDate(event.startsAt),
          url,
          closesAt,
          guest,
        }),
      );
    } catch (error) {
      logger.error("Invitation à donner son avis non envoyée", error);
      run.failed += 1;
      await prisma.registrationMail
        .update({ where: { id: claimed.id }, data: { claimedAt: null } })
        .catch((release) => logger.error("Réservation d’invitation non libérée", release));
      continue;
    }
    run.sent += 1;
    try {
      await prisma.registrationMail.update({
        where: { id: claimed.id },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      logger.error("Invitation à donner son avis envoyée mais non marquée", error);
    }
  }
  logger.info("Invitations à donner son avis", run);
  return run;
}

/** Réserve l'invitation d'une inscription ; `null` si déjà envoyée, en cours, ou plus valable. */
async function claim(
  registrationId: string,
  startsAt: Date,
  now: Date,
  tokenHash: string | null,
): Promise<{ id: string; attempts: number } | null> {
  const leaseEnd = new Date(now.getTime() - LEASE_MINUTES * 60_000);
  const rows = await prisma.$queryRaw<{ id: string; attempts: number }[]>`
    INSERT INTO "RegistrationMail"
      ("id", "registrationId", "kind", "eventStartsAt", "claimedAt", "attempts", "tokenHash", "updatedAt")
    SELECT ${randomUUID()}, r."id", 'FEEDBACK_REQUEST', e."startsAt", ${now}, 1, ${tokenHash}, ${now}
    FROM "EventRegistration" r
      JOIN "Event" e ON e."id" = r."eventId"
      LEFT JOIN "User" u ON u."id" = r."userId"
    WHERE r."id" = ${registrationId} AND r."status" = 'CONFIRMED' AND r."attendedAt" IS NOT NULL
      AND (
        (r."userId" IS NULL AND r."guestEmail" IS NOT NULL)
        OR (u."status" = 'ACTIVE' AND u."archivedAt" IS NULL)
      )
      AND e."status" IN ('PUBLISHED', 'CLOSED') AND e."archivedAt" IS NULL
      AND e."startsAt" = ${startsAt}
      AND NOT EXISTS (SELECT 1 FROM "EventFeedback" f WHERE f."registrationId" = r."id")
      -- Une seule invitation par participation, même si la rencontre a été déplacée depuis.
      AND NOT EXISTS (
        SELECT 1 FROM "RegistrationMail" m
        WHERE m."registrationId" = r."id" AND m."kind" = 'FEEDBACK_REQUEST'
          AND m."eventStartsAt" <> e."startsAt" AND m."sentAt" IS NOT NULL
      )
    ON CONFLICT ("registrationId", "kind", "eventStartsAt") DO UPDATE
      SET "claimedAt" = EXCLUDED."claimedAt",
          "attempts" = "RegistrationMail"."attempts" + 1,
          "tokenHash" = EXCLUDED."tokenHash",
          "updatedAt" = EXCLUDED."updatedAt"
      WHERE "RegistrationMail"."sentAt" IS NULL
        AND "RegistrationMail"."attempts" < ${MAX_ATTEMPTS}
        AND ("RegistrationMail"."claimedAt" IS NULL OR "RegistrationMail"."claimedAt" < ${leaseEnd})
    RETURNING "id", "attempts"`;
  return rows[0] ?? null;
}

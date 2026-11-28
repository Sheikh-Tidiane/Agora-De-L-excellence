import { hashToken } from "@/features/auth/service";
import { canSubmit, feedbackWindow } from "@/features/feedback/rules";
import { loadClubSettings } from "@/features/settings/club";
import { rules } from "@/config/rules";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Avis après une rencontre : dépôt et modification par le membre présent, masquage d'un
 * commentaire par un responsable, anonymisation après la durée de conservation.
 * Règles : src/features/feedback/rules.ts et docs/REGLES-METIER.md.
 */

/**
 * Dépose ou modifie l'avis du membre sur une rencontre où il a été pointé présent. Une seule ligne
 * par inscription (index unique) ; un commentaire masqué par un responsable ne peut plus être
 * changé (la note, si).
 */
export async function saveMemberFeedback(
  userId: string,
  input: { eventId: string; rating: number; comment: string | null },
  now: Date = new Date(),
): Promise<{ created: boolean }> {
  const found = await prisma.eventRegistration.findUnique({
    where: { eventId_userId: { eventId: input.eventId, userId } },
    select: { id: true },
  });
  if (!found) throw new AppError("NOT_FOUND", "Rencontre introuvable.");
  return saveRegistrationFeedback(found.id, input, now);
}

/**
 * Invité présent (sans compte) : avis depuis le lien personnel reçu par e-mail. Seul un jeton de
 * demande d'avis est accepté (jamais celui de l'inscription ou d'un rappel).
 */
export async function saveGuestFeedback(
  token: string,
  input: { rating: number; comment: string | null },
  now: Date = new Date(),
): Promise<{ created: boolean }> {
  const registrationId = await registrationIdByFeedbackToken(token);
  if (!registrationId) {
    throw new AppError("INVALID_TOKEN", "Ce lien n’est plus valable.");
  }
  return saveRegistrationFeedback(registrationId, input, now);
}

/** Inscription désignée par le jeton d'une demande d'avis (haché en base), ou `null`. */
export async function registrationIdByFeedbackToken(token: string): Promise<string | null> {
  if (!token || token.length < 16 || token.length > 200) return null;
  const mail = await prisma.registrationMail.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { kind: true, registrationId: true },
  });
  return mail?.kind === "FEEDBACK_REQUEST" ? mail.registrationId : null;
}

async function saveRegistrationFeedback(
  registrationId: string,
  input: { rating: number; comment: string | null },
  now: Date,
): Promise<{ created: boolean }> {
  const { feedbackRequestHour } = await loadClubSettings();
  return prisma.$transaction(async (tx) => {
    const found = { id: registrationId };
    // Verrou de l'inscription : deux envois simultanés ne créent jamais deux avis.
    await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${found.id} FOR UPDATE`;
    const registration = await tx.eventRegistration.findUniqueOrThrow({
      where: { id: found.id },
      select: {
        id: true,
        status: true,
        attendedAt: true,
        event: {
          select: { id: true, status: true, archivedAt: true, startsAt: true, endsAt: true },
        },
        feedback: { select: { id: true, comment: true, hiddenAt: true } },
      },
    });
    const { event } = registration;
    if (registration.status !== "CONFIRMED" || !registration.attendedAt) {
      throw new AppError("FORBIDDEN", "Seuls les participants présents peuvent donner leur avis.");
    }
    if (event.archivedAt || event.status === "CANCELLED" || event.status === "DRAFT") {
      throw new AppError("NOT_FOUND", "Rencontre introuvable.");
    }
    if (!canSubmit(feedbackWindow(event, feedbackRequestHour), now)) {
      throw new AppError("CONFLICT", "Les avis sur cette rencontre sont clos.");
    }
    // Verrou de l'avis (même verrou que le masquage) puis relecture : un commentaire masqué entre
    // l'affichage et l'envoi n'est jamais remplacé.
    if (registration.feedback) {
      await tx.$queryRaw`SELECT id FROM "EventFeedback" WHERE id = ${registration.feedback.id} FOR UPDATE`;
    }
    const existing = registration.feedback
      ? await tx.eventFeedback.findUniqueOrThrow({
          where: { id: registration.feedback.id },
          select: { id: true, comment: true, hiddenAt: true },
        })
      : null;
    if (existing?.hiddenAt && (input.comment ?? null) !== existing.comment) {
      throw new AppError("VALIDATION", undefined, {
        fieldErrors: {
          comment:
            "Votre commentaire a été masqué par un responsable : il ne peut plus être modifié. Vous pouvez encore changer votre note.",
        },
      });
    }
    if (existing) {
      await tx.eventFeedback.update({
        where: { id: existing.id },
        data: {
          rating: input.rating,
          comment: existing.hiddenAt ? existing.comment : input.comment,
        },
      });
      return { created: false };
    }
    await tx.eventFeedback.create({
      data: {
        eventId: event.id,
        registrationId: registration.id,
        rating: input.rating,
        comment: input.comment,
      },
    });
    return { created: true };
  });
}

/**
 * Masque le commentaire d'un avis (charte du club) : motif obligatoire, gardé avec l'avis ; le
 * journal consigne le masquage (jamais le texte ni le motif).
 */
export async function hideFeedbackComment(
  actorId: string,
  input: { id: string; reason: string; version: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "EventFeedback" WHERE id = ${input.id} FOR UPDATE`;
    const feedback = await tx.eventFeedback.findUnique({
      where: { id: input.id },
      select: { eventId: true, comment: true, hiddenAt: true, anonymizedAt: true },
    });
    if (!feedback || feedback.anonymizedAt || !feedback.comment) {
      throw new AppError("NOT_FOUND", "Commentaire introuvable.");
    }
    if (feedback.hiddenAt) throw new AppError("CONFLICT", "Ce commentaire est déjà masqué.");
    const { count } = await tx.eventFeedback.updateMany({
      where: { id: input.id, updatedAt: new Date(input.version) },
      data: { hiddenAt: new Date(), hiddenById: actorId, hiddenReason: input.reason },
    });
    if (count === 0) {
      throw new AppError("CONFLICT", "Cet avis vient d’être modifié : rechargez la page.");
    }
    await audit(
      {
        actorId,
        action: "feedback.comment_hidden",
        entityType: "EventFeedback",
        entityId: input.id,
        // Jamais le texte du commentaire ni le motif dans le journal.
        metadata: { eventId: feedback.eventId },
      },
      tx,
    );
  });
}

export async function restoreFeedbackComment(
  actorId: string,
  input: { id: string; version: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const feedback = await tx.eventFeedback.findUnique({
      where: { id: input.id },
      select: { eventId: true, hiddenAt: true },
    });
    if (!feedback) throw new AppError("NOT_FOUND", "Commentaire introuvable.");
    if (!feedback.hiddenAt) throw new AppError("CONFLICT", "Ce commentaire n’est pas masqué.");
    const { count } = await tx.eventFeedback.updateMany({
      where: { id: input.id, updatedAt: new Date(input.version) },
      data: { hiddenAt: null, hiddenById: null, hiddenReason: null },
    });
    if (count === 0) {
      throw new AppError("CONFLICT", "Cet avis vient d’être modifié : rechargez la page.");
    }
    await audit(
      {
        actorId,
        action: "feedback.comment_restored",
        entityType: "EventFeedback",
        entityId: input.id,
        metadata: { eventId: feedback.eventId },
      },
      tx,
    );
  });
}

/**
 * Durée de conservation : après 24 mois (à compter de la rencontre), le commentaire, le motif de
 * masquage et le lien avec l'auteur sont effacés ; la note reste, sans nom (statistiques).
 * Idempotente : relancée, elle ne trouve plus rien.
 */
export async function purgeFeedback(
  now: Date = new Date(),
  months: number = rules["feedback.retentionMonths"],
): Promise<{ anonymized: number }> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.eventFeedback.updateMany({
      where: { anonymizedAt: null, event: { startsAt: { lt: cutoff } } },
      data: {
        registrationId: null,
        comment: null,
        hiddenAt: null,
        hiddenById: null,
        hiddenReason: null,
        anonymizedAt: now,
      },
    });
    if (count > 0) {
      await audit(
        {
          actorId: null,
          action: "feedback.purged",
          entityType: "EventFeedback",
          entityId: null,
          metadata: { count, months },
        },
        tx,
      );
    }
    return { anonymized: count };
  });
}

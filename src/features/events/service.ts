import type { EventData } from "@/features/events/schemas";
import type { EventStatusCode } from "@/features/events/rules";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { lockEvent } from "@/features/events/registration-core";
import { fillFreedSeats, sendPromotionMessages, type Promotion } from "@/features/events/waitlist";
import { loadClubSettings } from "@/features/settings/club";
import { uniqueSlug } from "@/lib/slug";

/** Gestion des événements par un administrateur : créer, modifier, publier, clôturer, annuler. */

const values = (data: EventData) => ({
  title: data.title,
  type: data.type,
  activities: data.activities,
  summary: data.summary || null,
  description: data.description,
  location: data.location || null,
  isTentative: data.isTentative,
  program: data.program || null,
  speakerName: data.speakerName || null,
  speakerTitle: data.speakerName ? data.speakerTitle || null : null,
  speakerMode: data.speakerName && data.speakerMode ? data.speakerMode : null,
  videoLink: data.videoLink || null,
  startsAt: data.startsAt,
  endsAt: data.endsAt,
  capacity: data.capacity,
  isPublic: data.isPublic,
  cancellationDeadlineHours: data.cancellationDeadlineHours,
});

/** Crée un événement, toujours en brouillon : la publication est un geste séparé. */
export async function createEvent(data: EventData, actorId: string): Promise<{ id: string }> {
  const slug = await uniqueSlug(
    data.title,
    async (candidate) => (await prisma.event.count({ where: { slug: candidate } })) > 0,
    "rencontre",
  );
  return prisma.event.create({
    data: { ...values(data), slug, status: "DRAFT", createdById: actorId },
    select: { id: true },
  });
}

export async function updateEvent(id: string, data: EventData): Promise<void> {
  const event = await prisma.event.findFirst({ where: { id, archivedAt: null } });
  if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
  // Un quiz se rattache à une rencontre des Génies du soir, un tournoi à une rencontre de
  // Scrabble : l'activité qui justifie ce lien ne peut pas être retirée tant qu'il existe.
  const [quizzes, tournament] = await Promise.all([
    prisma.quiz.count({ where: { eventId: id, archivedAt: null } }),
    prisma.tournament.findUnique({ where: { eventId: id }, select: { id: true } }),
  ]);
  if (quizzes > 0 && !data.activities.includes("GENIES_DU_SOIR")) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: {
        activities:
          "Un quiz est lié à cette rencontre : gardez les Génies du soir parmi ses activités.",
      },
    });
  }
  if (tournament && !data.activities.some((code) => SCRABBLE_TYPES.includes(code))) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: {
        activities: "Un tournoi est lié à cette rencontre : gardez une activité Scrabble.",
      },
    });
  }
  // Sous le verrou de l'événement : une capacité augmentée (ou supprimée) donne aussitôt les
  // nouvelles places aux personnes en attente.
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const result = await prisma.$transaction(async (tx) => {
    const locked = await lockEvent(tx, id);
    if (!locked) throw new AppError("NOT_FOUND", "Événement introuvable.");
    if (data.capacity !== null) {
      const confirmed = await tx.eventRegistration.count({
        where: { eventId: id, status: "CONFIRMED" },
      });
      if (data.capacity < confirmed) {
        throw new AppError("VALIDATION", undefined, {
          fieldErrors: {
            capacity: `${confirmed} personnes sont déjà inscrites : la capacité ne peut pas descendre en dessous.`,
          },
        });
      }
    }
    const updated = await tx.event.update({ where: { id }, data: values(data) });
    return {
      event: updated,
      promotions: await fillFreedSeats(tx, updated, now, waitlistCutoffHours, "capacity"),
    };
  });
  await sendPromotionMessages(result.event, result.promotions, now);
}

const SCRABBLE_TYPES: readonly string[] = ["INITIATION_SCRABBLE", "TOURNOI_SCRABBLE"];

/** Transitions permises. Un événement annulé peut être republié ; un brouillon ne se clôture pas. */
const transitions: Record<EventStatusCode, EventStatusCode[]> = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["CLOSED", "CANCELLED", "DRAFT"],
  CLOSED: ["PUBLISHED", "CANCELLED"],
  CANCELLED: ["PUBLISHED", "DRAFT"],
};

export function canTransition(from: EventStatusCode, to: EventStatusCode): boolean {
  return transitions[from].includes(to);
}

export async function setEventStatus(
  id: string,
  status: EventStatusCode,
  actorId: string,
): Promise<void> {
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const result = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, id);
    if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
    if (event.status === status) return null;
    if (!canTransition(event.status, status)) {
      throw new AppError("CONFLICT", "Ce changement de statut n’est pas possible.");
    }
    if (status === "DRAFT") {
      const registered = await tx.eventRegistration.count({
        where: {
          eventId: id,
          OR: [
            { status: { in: ["CONFIRMED", "PENDING"] } },
            { status: "WAITLISTED", waitlistedAt: { not: null } },
          ],
        },
      });
      if (registered > 0) {
        throw new AppError(
          "CONFLICT",
          "Des personnes sont inscrites : annulez ou clôturez la rencontre plutôt que de la dépublier.",
        );
      }
    }
    const updated = await tx.event.update({
      where: { id },
      data: {
        status,
        publishedAt: status === "PUBLISHED" ? (event.publishedAt ?? new Date()) : event.publishedAt,
      },
    });
    await audit(
      {
        actorId,
        action: "event.status_changed",
        entityType: "Event",
        entityId: id,
        metadata: { from: event.status, to: status },
      },
      tx,
    );
    // Republiée : des places ont pu se libérer pendant qu'elle était clôturée ou annulée.
    const promotions: Promotion[] =
      status === "PUBLISHED"
        ? await fillFreedSeats(tx, updated, now, waitlistCutoffHours, "republished")
        : [];
    return { event: updated, promotions };
  });
  if (result) await sendPromotionMessages(result.event, result.promotions, now);
}

/**
 * Compte rendu d'une rencontre passée : enregistré en brouillon ou publié.
 * Un compte rendu vidé est retiré du site.
 */
export async function saveEventReport(
  input: { eventId: string; content: string; publish: boolean },
  actorId: string,
): Promise<{ published: boolean }> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id: input.eventId, archivedAt: null } });
    if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
    if (event.startsAt.getTime() > Date.now()) {
      throw new AppError("CONFLICT", "Le compte rendu se rédige une fois la rencontre passée.");
    }
    if (input.publish && event.status === "DRAFT") {
      throw new AppError(
        "CONFLICT",
        "Publiez d’abord la rencontre : un brouillon n’a pas de page publique.",
      );
    }
    const published = input.publish && input.content.length > 0;
    await tx.event.update({
      where: { id: event.id },
      data: {
        reportContent: input.content || null,
        reportPublishedAt: published ? (event.reportPublishedAt ?? new Date()) : null,
        reportAuthorId: actorId,
      },
    });
    await audit(
      {
        actorId,
        action: "event.report_saved",
        entityType: "Event",
        entityId: event.id,
        metadata: { published },
      },
      tx,
    );
    return { published };
  });
}

/** Archive un événement : il disparaît du site et des listes, ses inscriptions sont conservées. */
export async function archiveEvent(id: string, actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const event = await tx.event.findFirst({ where: { id, archivedAt: null } });
    if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
    await tx.event.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit(
      {
        actorId,
        action: "event.status_changed",
        entityType: "Event",
        entityId: id,
        metadata: { from: event.status, to: "ARCHIVED" },
      },
      tx,
    );
  });
}

/** Retire une inscription (désistement signalé au club, doublon…). La place est libérée. */
export async function removeRegistration(registrationId: string, actorId: string): Promise<void> {
  const found = await prisma.eventRegistration.findUnique({
    where: { id: registrationId },
    select: { eventId: true },
  });
  if (!found) throw new AppError("NOT_FOUND", "Inscription introuvable.");
  const now = new Date();
  const { waitlistCutoffHours } = await loadClubSettings();
  const result = await prisma.$transaction(async (tx) => {
    const event = await lockEvent(tx, found.eventId);
    if (!event) throw new AppError("NOT_FOUND", "Événement introuvable.");
    const registration = await tx.eventRegistration.findUnique({ where: { id: registrationId } });
    if (!registration) throw new AppError("NOT_FOUND", "Inscription introuvable.");
    const waiting = registration.status === "WAITLISTED";
    await tx.eventRegistration.update({
      where: { id: registrationId },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    await audit(
      {
        actorId,
        action: "event.registration_removed",
        entityType: "EventRegistration",
        entityId: registrationId,
        metadata: {
          eventId: registration.eventId,
          guest: registration.userId === null,
          ...(waiting ? { waitlisted: true } : {}),
        },
      },
      tx,
    );
    // Une place confirmée libérée va à la première personne en attente.
    return {
      event,
      promotions: waiting
        ? []
        : await fillFreedSeats(tx, event, now, waitlistCutoffHours, "removal"),
    };
  });
  await sendPromotionMessages(result.event, result.promotions, now);
}

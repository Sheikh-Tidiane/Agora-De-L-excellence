import type { z } from "zod";
import { awardReadingPoints, awardReviewPoints } from "@/features/gamification/service";
import type {
  addReadingSchema,
  decisionSchema,
  reviewDecisionSchema,
  reviewSchema,
  updateReadingSchema,
} from "@/features/readings/schemas";
import { notify } from "@/features/notifications/service";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Lectures et critiques des membres. Règles (docs/REGLES-METIER.md) :
 * - un membre ne touche qu'à ses propres lectures (le compte vient de la session) ;
 * - « livre terminé » rapporte des points seulement après validation par un responsable ;
 * - une critique n'est publique qu'approuvée ET avec l'accord du membre ; ses points arrivent à l'approbation ;
 * - une lecture validée ne peut plus revenir en arrière (les points sont acquis).
 * Chaque écriture est conditionnée à l'état lu (`updateMany` + `where` sur le statut) : une
 * décision du responsable et un geste du membre simultanés ne s'écrasent pas.
 */

/** L'état a changé entre la lecture et l'écriture (geste simultané) : on ne l'écrase pas. */
const changedMeanwhile = () =>
  new AppError("CONFLICT", "Cette lecture vient de changer : rechargez la page et recommencez.");

type Actor = { id: string };

/** Titre du livre, pour le texte de la notification envoyée au membre. */
async function bookTitle(tx: Pick<typeof prisma, "book">, bookId: string): Promise<string> {
  const book = await tx.book.findUnique({ where: { id: bookId }, select: { title: true } });
  return book?.title ?? "votre livre";
}

async function ownReading(userId: string, readingId: string) {
  const reading = await prisma.reading.findUnique({
    where: { id: readingId },
    select: { id: true, userId: true, status: true, completionStatus: true, startedAt: true },
  });
  // Même réponse pour « n'existe pas » et « appartient à un autre » : rien n'est révélé.
  if (!reading || reading.userId !== userId) {
    throw new AppError("NOT_FOUND", "Lecture introuvable.");
  }
  return reading;
}

/**
 * Ajoute un livre du catalogue à ses lectures. S'il y est déjà, renvoie la lecture existante
 * sans la modifier (le statut se change ensuite depuis la fiche de lecture).
 */
export async function addReading(userId: string, data: z.output<typeof addReadingSchema>) {
  const book = await prisma.book.findFirst({
    where: { id: data.bookId, isPublished: true, archivedAt: null },
    select: { id: true },
  });
  if (!book) throw new AppError("NOT_FOUND", "Livre introuvable.");
  const now = new Date();
  const existing = await prisma.reading.findUnique({
    where: { userId_bookId: { userId, bookId: book.id } },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.reading.create({
    data: {
      userId,
      bookId: book.id,
      status: data.status,
      progress: data.status === "FINISHED" ? 100 : 0,
      startedAt: data.status === "TO_READ" ? null : now,
      finishedAt: data.status === "FINISHED" ? now : null,
    },
    select: { id: true },
  });
}

export async function updateReading(userId: string, data: z.output<typeof updateReadingSchema>) {
  const reading = await ownReading(userId, data.readingId);
  const locked = reading.completionStatus === "APPROVED";
  if (locked && data.status !== "FINISHED") {
    throw new AppError("CONFLICT", "Cette lecture est validée par le club : elle reste terminée.");
  }
  const now = new Date();
  const finished = data.status === "FINISHED";
  // Quitter « terminé » retire la demande de validation en attente (ou refusée).
  const leavesFinished = !finished && reading.status === "FINISHED";
  const { count } = await prisma.reading.updateMany({
    where: { id: reading.id, status: reading.status, completionStatus: reading.completionStatus },
    data: {
      status: data.status,
      progress: finished ? 100 : data.status === "TO_READ" ? 0 : data.progress,
      personalNote: data.personalNote,
      isFavorite: data.isFavorite,
      startedAt: data.status === "TO_READ" ? null : (reading.startedAt ?? now),
      finishedAt: finished ? (reading.status === "FINISHED" ? undefined : now) : null,
      ...(leavesFinished
        ? { completionStatus: "NONE", submittedAt: null, validationNote: null }
        : {}),
    },
  });
  if (count === 0) throw changedMeanwhile();
}

/** Le membre demande la validation de « livre terminé » (condition des points). */
export async function submitReadingForValidation(userId: string, readingId: string) {
  const reading = await ownReading(userId, readingId);
  if (reading.status !== "FINISHED") {
    throw new AppError("CONFLICT", "Marquez d’abord ce livre comme terminé.");
  }
  if (reading.completionStatus === "PENDING" || reading.completionStatus === "APPROVED") {
    return;
  }
  const { count } = await prisma.reading.updateMany({
    where: { id: reading.id, status: "FINISHED", completionStatus: reading.completionStatus },
    data: { completionStatus: "PENDING", submittedAt: new Date(), validationNote: null },
  });
  if (count === 0) throw changedMeanwhile();
}

/** Retire un livre de ses lectures, tant qu'aucune validation n'est en cours ou acquise. */
export async function removeReading(userId: string, readingId: string) {
  const reading = await ownReading(userId, readingId);
  if (reading.completionStatus === "PENDING" || reading.completionStatus === "APPROVED") {
    throw new AppError(
      "CONFLICT",
      "Cette lecture est en validation ou validée : elle reste dans votre historique.",
    );
  }
  const { count } = await prisma.reading.deleteMany({
    where: { id: reading.id, completionStatus: { in: ["NONE", "REJECTED"] } },
  });
  if (count === 0) throw changedMeanwhile();
}

/**
 * Écrit (ou réécrit) sa critique d'un livre terminé. Toute modification repasse en modération ;
 * les points déjà acquis ne sont pas redonnés (anti-doublon du moteur).
 */
export async function saveReview(userId: string, data: z.output<typeof reviewSchema>) {
  const reading = await prisma.reading.findUnique({
    where: { userId_bookId: { userId, bookId: data.bookId } },
    select: { status: true },
  });
  if (reading?.status !== "FINISHED") {
    throw new AppError("CONFLICT", "On écrit sa critique d’un livre terminé.");
  }
  const fields = {
    rating: data.rating,
    content: data.content,
    publishWithFirstName: data.publishWithFirstName,
    status: "PENDING" as const,
    moderatedById: null,
    moderatedAt: null,
    moderationNote: null,
  };
  await prisma.review.upsert({
    where: { userId_bookId: { userId, bookId: data.bookId } },
    create: { userId, bookId: data.bookId, ...fields },
    update: fields,
  });
}

/** Décision d'un responsable sur un « livre terminé » : validée (points) ou refusée (avec un mot). */
export async function decideReading(actor: Actor, data: z.output<typeof decisionSchema>) {
  const decided = await prisma.$transaction(async (tx) => {
    const reading = await tx.reading.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        userId: true,
        completionStatus: true,
        status: true,
        bookId: true,
      },
    });
    if (!reading) throw new AppError("NOT_FOUND", "Lecture introuvable.");
    if (reading.completionStatus !== "PENDING" || reading.status !== "FINISHED") {
      throw new AppError("CONFLICT", "Cette lecture n’attend plus de validation.");
    }
    if (reading.userId === actor.id) {
      throw new AppError("FORBIDDEN", "Un responsable ne valide pas ses propres lectures.");
    }
    const approve = data.decision === "approve";
    // Conditionnée à « en attente » : deux décisions simultanées (valider et refuser) ou un
    // membre qui quitte « terminé » au même moment ne laissent pas une lecture refusée payée.
    const { count } = await tx.reading.updateMany({
      where: { id: reading.id, completionStatus: "PENDING", status: "FINISHED" },
      data: {
        completionStatus: approve ? "APPROVED" : "REJECTED",
        validatedById: actor.id,
        validatedAt: new Date(),
        validationNote: approve ? null : data.note,
      },
    });
    if (count === 0) throw new AppError("CONFLICT", "Cette lecture n’attend plus de validation.");
    if (approve) await awardReadingPoints(reading.id, actor.id, tx);
    await audit(
      {
        actorId: actor.id,
        action: approve ? "reading.validated" : "reading.rejected",
        entityType: "Reading",
        entityId: reading.id,
        metadata: { memberId: reading.userId, note: data.note },
      },
      tx,
    );
    return {
      userId: reading.userId,
      readingId: reading.id,
      title: await bookTitle(tx, reading.bookId),
      approve,
    };
  });
  // Hors transaction : une notification manquée n'annule jamais la décision.
  await notify(
    decided.approve
      ? {
          userId: decided.userId,
          type: "reading.validated",
          title: `Lecture validée : ${decided.title}`,
          body: "Un responsable a validé votre lecture. Les points sont ajoutés à votre total.",
          href: `/member/readings/${decided.readingId}`,
        }
      : {
          userId: decided.userId,
          type: "reading.rejected",
          title: `Lecture à compléter : ${decided.title}`,
          body: data.note
            ? `Un responsable n’a pas validé votre lecture : « ${data.note} »`
            : "Un responsable n’a pas validé votre lecture. Vous pouvez la compléter et la soumettre à nouveau.",
          href: `/member/readings/${decided.readingId}`,
        },
    { email: true },
  );
}

/** Modération d'une critique : approuvée (points, publication si le membre l'accepte) ou refusée. */
export async function decideReview(actor: Actor, data: z.output<typeof reviewDecisionSchema>) {
  const reviewChanged = () =>
    new AppError(
      "CONFLICT",
      "Le membre a modifié sa critique pendant votre relecture : relisez la nouvelle version.",
    );
  const version = new Date(data.version);
  const decided = await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: data.id },
      select: {
        id: true,
        userId: true,
        status: true,
        updatedAt: true,
        bookId: true,
      },
    });
    if (!review) throw new AppError("NOT_FOUND", "Critique introuvable.");
    if (review.status !== "PENDING") {
      throw new AppError("CONFLICT", "Cette critique a déjà été modérée.");
    }
    if (review.userId === actor.id) {
      throw new AppError("FORBIDDEN", "Un responsable ne modère pas ses propres critiques.");
    }
    if (review.updatedAt.getTime() !== version.getTime()) throw reviewChanged();
    const approve = data.decision === "approve";
    // La décision vaut pour le texte lu : conditionnée au statut ET à la version affichée.
    const { count } = await tx.review.updateMany({
      where: { id: review.id, status: "PENDING", updatedAt: version },
      data: {
        status: approve ? "APPROVED" : "REJECTED",
        moderatedById: actor.id,
        moderatedAt: new Date(),
        moderationNote: approve ? null : data.note,
      },
    });
    if (count === 0) throw reviewChanged();
    if (approve) await awardReviewPoints(review.id, actor.id, tx);
    await audit(
      {
        actorId: actor.id,
        action: approve ? "review.approved" : "review.rejected",
        entityType: "Review",
        entityId: review.id,
        metadata: { memberId: review.userId, note: data.note },
      },
      tx,
    );
    const reading = await tx.reading.findUnique({
      where: { userId_bookId: { userId: review.userId, bookId: review.bookId } },
      select: { id: true },
    });
    return {
      userId: review.userId,
      title: await bookTitle(tx, review.bookId),
      approve,
      readingId: reading?.id,
    };
  });
  const href = decided.readingId ? `/member/readings/${decided.readingId}` : "/member/readings";
  await notify(
    decided.approve
      ? {
          userId: decided.userId,
          type: "review.approved",
          title: `Critique approuvée : ${decided.title}`,
          body: "Votre critique a été approuvée par un modérateur. Les points sont ajoutés à votre total.",
          href,
        }
      : {
          userId: decided.userId,
          type: "review.rejected",
          title: `Critique à revoir : ${decided.title}`,
          body: data.note
            ? `Votre critique n’a pas été approuvée : « ${data.note} »`
            : "Votre critique n’a pas été approuvée. Vous pouvez la reprendre et la soumettre à nouveau.",
          href,
        },
    { email: true },
  );
}

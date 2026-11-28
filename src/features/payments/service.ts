import {
  needsReference,
  paymentMethodLabels,
  type PaymentMethodCode,
} from "@/features/payments/methods";
import { loadClubSettings } from "@/features/settings/club";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { Tx } from "@/features/gamification/ledger";
import { awardAttendancePoints, revokeAttendancePoints } from "@/features/gamification/service";

/**
 * Cotisations (docs/REGLES-METIER.md) : pas de paiement en ligne intégré. La carte se règle en
 * espèces, ou à distance par Wave ou Orange Money (référence de la transaction obligatoire) ; un
 * responsable enregistre l'encaissement. La participation à une séance est cochée au pointage
 * (espèces, sur place). Les montants viennent des réglages du club, jamais du code. Rien n'est supprimé :
 * une erreur s'annule, et chaque geste passe dans `AuditLog` dans la même transaction.
 */

/** Carte de membre : versée une fois. `paidAt` permet de saisir un encaissement fait la veille. */
export async function recordCardPayment(
  input: {
    userId: string;
    method: PaymentMethodCode;
    reference: string;
    paidAt: Date;
    note: string;
  },
  actorId: string,
): Promise<{ id: string; amount: number }> {
  const { membershipCardFee } = await loadClubSettings();
  if (needsReference(input.method) && !input.reference.trim()) {
    throw new AppError("VALIDATION", "Indiquez la référence de la transaction.", {
      fieldErrors: { reference: "Indiquez la référence de la transaction." },
    });
  }
  // `paidAt` est un jour (minuit, heure de Dakar = UTC) : aujourd'hui au plus tard.
  if (input.paidAt.getTime() > Date.now()) {
    throw new AppError("VALIDATION", "La date d’encaissement ne peut pas être dans le futur.", {
      fieldErrors: { paidAt: "La date d’encaissement ne peut pas être dans le futur." },
    });
  }
  try {
    return await saveCardPayment(input, actorId, membershipCardFee);
  } catch (error) {
    // Deux saisies simultanées de la même référence : la base refuse la seconde. On relit alors
    // l'encaissement gagnant pour dire à qui la référence est attribuée.
    if ((error as { code?: string } | null)?.code === "P2002" && needsReference(input.method)) {
      throw (
        (await referenceConflict(input.method, input.reference.trim())) ??
        new AppError("CONFLICT", "Cette référence de transaction est déjà enregistrée.", {
          fieldErrors: { reference: "Cette référence de transaction est déjà enregistrée." },
        })
      );
    }
    throw error;
  }
}

/**
 * Une référence de transaction est unique pour un même moyen de paiement (casse et espaces autour
 * ignorés ; un encaissement annulé la libère). Si elle est déjà prise : l'erreur à afficher, avec
 * le membre (nom et numéro) à qui elle est attribuée ; sinon `null`.
 * Même règle en base : index unique partiel « Payment_method_reference_active_key ».
 */
export async function referenceConflict(
  method: PaymentMethodCode,
  reference: string,
  db: Pick<Tx, "payment"> = prisma,
): Promise<AppError | null> {
  if (!needsReference(method) || !reference) return null;
  const taken = await db.payment.findFirst({
    where: { method, reference: { equals: reference, mode: "insensitive" }, cancelledAt: null },
    select: {
      user: { select: { firstName: true, lastName: true, memberNumber: true } },
      registration: { select: { guestName: true } },
    },
  });
  if (!taken) return null;
  const holder = taken.user
    ? `${taken.user.firstName} ${taken.user.lastName}${
        taken.user.memberNumber ? ` (n° ${taken.user.memberNumber})` : ""
      }`
    : taken.registration?.guestName
      ? `${taken.registration.guestName} (invité)`
      : "un autre encaissement";
  const message = `Cette référence ${paymentMethodLabels[method]} est déjà attribuée à ${holder}.`;
  return new AppError("CONFLICT", message, { fieldErrors: { reference: message } });
}

async function saveCardPayment(
  input: Parameters<typeof recordCardPayment>[0],
  actorId: string,
  membershipCardFee: number,
): Promise<{ id: string; amount: number }> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { id: true, status: true, memberNumber: true },
    });
    if (!user || user.status === "ARCHIVED" || !user.memberNumber) {
      throw new AppError("NOT_FOUND", "Membre introuvable.");
    }
    const existing = await tx.payment.findFirst({
      where: { userId: user.id, kind: "MEMBERSHIP_CARD", cancelledAt: null },
      select: { id: true },
    });
    if (existing) throw new AppError("CONFLICT", "La carte de ce membre est déjà réglée.");
    const reference = needsReference(input.method) ? input.reference.trim() : null;
    if (reference) {
      // Même transaction déjà enregistrée : la base le refuserait aussi ; ici, avec le nom du membre.
      const conflict = await referenceConflict(input.method, reference, tx);
      if (conflict) throw conflict;
    }
    const payment = await tx.payment.create({
      data: {
        kind: "MEMBERSHIP_CARD",
        amount: membershipCardFee,
        userId: user.id,
        method: input.method,
        reference,
        paidAt: input.paidAt,
        receivedById: actorId,
        note: input.note || null,
      },
      select: { id: true, amount: true },
    });
    await audit(
      {
        actorId,
        action: "payment.recorded",
        entityType: "Payment",
        entityId: payment.id,
        metadata: {
          kind: "MEMBERSHIP_CARD",
          amount: payment.amount,
          userId: user.id,
          method: input.method,
          reference,
        },
      },
      tx,
    );
    return payment;
  });
}

/** Annule un encaissement saisi par erreur. Le motif est obligatoire et reste au journal. */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError("NOT_FOUND", "Encaissement introuvable.");
    if (payment.cancelledAt) throw new AppError("CONFLICT", "Cet encaissement est déjà annulé.");
    await tx.payment.update({
      where: { id: paymentId },
      data: { cancelledAt: new Date(), cancelledById: actorId, cancelReason: reason },
    });
    await audit(
      {
        actorId,
        action: "payment.cancelled",
        entityType: "Payment",
        entityId: paymentId,
        metadata: { kind: payment.kind, amount: payment.amount, reason },
      },
      tx,
    );
  });
}

/** Le pointage ouvre le jour de la séance (heure de Dakar = UTC), à minuit. */
export function checkInOpensAt(startsAt: Date): Date {
  const dayStart = new Date(startsAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  return dayStart;
}

export type AttendanceState = {
  registrationId: string;
  eventId: string;
  userId: string | null;
  present: boolean;
  attendedAt: Date | null;
  checkInMethod: "QR_SCAN" | "MANUAL" | null;
  paid: boolean;
  /** Points attribués par ce pointage (0 s'il n'en rapporte pas ou s'ils l'étaient déjà). */
  pointsAwarded: number;
  /** Badges obtenus grâce à ce pointage. */
  badges: string[];
};

/**
 * Cœur du pointage, dans la transaction de l'appelant : présence, participation, points.
 * Verrouille l'inscription. Partagé par le pointage manuel et le scan de la carte de membre.
 * Cocher la présence attribue les points du type de rencontre ; la décocher les corrige
 * (transaction inverse) : voir features/gamification/service.ts.
 */
export async function applyAttendance(
  tx: Tx,
  input: { registrationId: string; present: boolean; paid: boolean; method: "QR_SCAN" | "MANUAL" },
  actorId: string,
  rights: { attendance: boolean; payments: boolean },
  context: { now: Date; sessionFee: number },
): Promise<AttendanceState> {
  const { now, sessionFee } = context;
  await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${input.registrationId} FOR UPDATE`;
  const registration = await tx.eventRegistration.findUnique({
    where: { id: input.registrationId },
    include: {
      event: { select: { id: true, startsAt: true, status: true } },
      payments: { where: { kind: "SESSION_FEE", cancelledAt: null }, select: { id: true } },
    },
  });
  if (!registration) throw new AppError("NOT_FOUND", "Inscription introuvable.");
  if (registration.status !== "CONFIRMED") {
    throw new AppError("CONFLICT", "Cette inscription n’est pas confirmée.");
  }
  if (now.getTime() < checkInOpensAt(registration.event.startsAt).getTime()) {
    throw new AppError("CONFLICT", "Le pointage ouvre le jour de la rencontre.");
  }
  const wasPresent = registration.attendedAt !== null;
  const activePayment = registration.payments[0] ?? null;
  const wasPaid = activePayment !== null;
  const state: AttendanceState = {
    registrationId: registration.id,
    eventId: registration.eventId,
    userId: registration.userId,
    present: wasPresent,
    attendedAt: registration.attendedAt,
    checkInMethod: registration.checkInMethod,
    paid: wasPaid,
    pointsAwarded: 0,
    badges: [],
  };

  if (input.paid && !input.present) {
    throw new AppError("CONFLICT", "Une participation réglée suppose la présence à la séance.");
  }
  if (input.present !== wasPresent) {
    if (!rights.attendance) throw new AppError("FORBIDDEN");
    await tx.eventRegistration.update({
      where: { id: registration.id },
      data: input.present
        ? { attendedAt: now, checkInMethod: input.method, checkedInById: actorId }
        : { attendedAt: null, checkInMethod: null, checkedInById: null },
    });
    await audit(
      {
        actorId,
        action: input.method === "QR_SCAN" ? "attendance.scanned" : "attendance.recorded",
        entityType: "EventRegistration",
        entityId: registration.id,
        metadata: { eventId: registration.eventId, present: input.present, method: input.method },
      },
      tx,
    );
    Object.assign(state, {
      present: input.present,
      attendedAt: input.present ? now : null,
      checkInMethod: input.present ? input.method : null,
    });
    if (input.present) {
      const award = await awardAttendancePoints(registration.id, actorId, tx);
      state.pointsAwarded = award.status === "awarded" ? award.points : 0;
      state.badges = award.badges;
    } else {
      await revokeAttendancePoints(registration.id, actorId, "Présence décochée", tx);
    }
  }
  if (input.paid !== wasPaid) {
    if (!rights.payments) throw new AppError("FORBIDDEN");
    if (input.paid) {
      const payment = await tx.payment.create({
        data: {
          kind: "SESSION_FEE",
          amount: sessionFee,
          userId: registration.userId,
          registrationId: registration.id,
          eventId: registration.eventId,
          paidAt: now,
          receivedById: actorId,
        },
        select: { id: true, amount: true },
      });
      await audit(
        {
          actorId,
          action: "payment.recorded",
          entityType: "Payment",
          entityId: payment.id,
          metadata: {
            kind: "SESSION_FEE",
            amount: payment.amount,
            eventId: registration.eventId,
            registrationId: registration.id,
          },
        },
        tx,
      );
    } else if (activePayment) {
      await tx.payment.update({
        where: { id: activePayment.id },
        data: {
          cancelledAt: now,
          cancelledById: actorId,
          cancelReason: "Case « payé » décochée",
        },
      });
      await audit(
        {
          actorId,
          action: "payment.cancelled",
          entityType: "Payment",
          entityId: activePayment.id,
          metadata: { kind: "SESSION_FEE", eventId: registration.eventId },
        },
        tx,
      );
    }
    state.paid = input.paid;
  }
  return state;
}

/**
 * Pointage manuel d'un inscrit à une séance : présence et participation (« payé »).
 * Décocher « payé » annule l'encaissement ; décocher la présence est refusé tant qu'il est réglé.
 */
export async function recordAttendance(
  input: { registrationId: string; present: boolean; paid: boolean },
  actorId: string,
  rights: { attendance: boolean; payments: boolean },
): Promise<void> {
  const { sessionFee } = await loadClubSettings();
  const now = new Date();
  await prisma.$transaction(
    (tx) =>
      applyAttendance(tx, { ...input, method: "MANUAL" }, actorId, rights, { now, sessionFee }),
    { timeout: 15_000 },
  );
}

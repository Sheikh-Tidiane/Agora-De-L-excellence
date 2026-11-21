import { createPendingUser, sendActivationEmail } from "@/features/auth/service";
import type { MembershipRequestData } from "@/features/memberships/schemas";
import { loadCharter } from "@/features/settings/charter";
import { loadClubSettings } from "@/features/settings/club";
import { audit } from "@/lib/audit";
import { addMonths } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { createNotifications } from "@/features/notifications/service";
import { sendMail } from "@/lib/mail";
import { membershipReceivedEmail, membershipRejectedEmail } from "@/lib/mail/club-templates";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Parcours d'adhésion : un visiteur envoie une demande sans créer de compte →
 * un responsable valide ou refuse → à la validation, le système crée le compte, le numéro de membre
 * et la période d'adhésion, puis envoie le lien d'activation.
 */
const MEMBER_NUMBER_PREFIX = "AE";

/** Numéro suivant : `AE-2026-0001`, `AE-2026-0002`… La numérotation repart à 1 chaque année. */
export function nextMemberNumber(year: number, last: string | null): string {
  const match = last ? /^[A-Z]+-(\d{4})-(\d+)$/.exec(last) : null;
  const sequence = match && Number(match[1]) === year ? Number(match[2]) + 1 : 1;
  return `${MEMBER_NUMBER_PREFIX}-${year}-${String(sequence).padStart(4, "0")}`;
}

async function allocateMemberNumber(tx: Db, now: Date): Promise<string> {
  // Verrou consultatif le temps de la transaction : deux validations simultanées ne tirent pas le même numéro.
  // `$executeRaw` : la fonction renvoie `void`, que `$queryRaw` ne sait pas lire.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('agora.member-number'))`;
  const year = now.getUTCFullYear();
  const last = await tx.user.findFirst({
    where: { memberNumber: { startsWith: `${MEMBER_NUMBER_PREFIX}-${year}-` } },
    orderBy: { memberNumber: "desc" },
    select: { memberNumber: true },
  });
  return nextMemberNumber(year, last?.memberNumber ?? null);
}

/** Enregistre une demande d'adhésion et envoie l'accusé de réception. */
export async function submitMembershipRequest(
  data: MembershipRequestData,
): Promise<{ id: string }> {
  const [account, pending] = await Promise.all([
    prisma.user.findUnique({ where: { email: data.email }, select: { id: true } }),
    prisma.membershipRequest.findFirst({
      where: { email: data.email, status: "PENDING" },
      select: { id: true },
    }),
  ]);
  if (account) {
    throw new AppError(
      "CONFLICT",
      "Cette adresse e-mail est déjà celle d’un compte du club. Connectez-vous à l’espace membre.",
    );
  }
  if (pending) {
    throw new AppError(
      "CONFLICT",
      "Une demande est déjà en cours d’examen pour cette adresse e-mail. Vous recevrez une réponse par e-mail.",
    );
  }
  // La version de la charte en vigueur est enregistrée avec la demande.
  const charter = await loadCharter();
  const now = new Date();
  const request = await prisma.membershipRequest.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      ageRange: data.ageRange,
      occupation: data.occupation,
      interests: data.interests,
      motivation: data.motivation || null,
      guardianName: data.guardianName || null,
      guardianPhone: data.guardianPhone,
      consentAt: now,
      charterVersion: charter.version,
      charterAcceptedAt: now,
    },
    select: { id: true },
  });
  // La demande est enregistrée : un accusé de réception qui ne part pas ne doit pas la faire échouer.
  try {
    await sendMail(membershipReceivedEmail({ to: data.email, firstName: data.firstName }));
  } catch (error) {
    logger.error("Accusé de réception d’adhésion non envoyé", error, { requestId: request.id });
  }
  return request;
}

export type ApprovalResult = { userId: string; memberNumber: string; emailSent: boolean };

/** Valide une demande : compte en attente d'activation, numéro de membre, adhésion, e-mail d'activation. */
export async function approveMembershipRequest(
  requestId: string,
  actorId: string,
): Promise<ApprovalResult> {
  const now = new Date();
  const { membershipDurationMonths } = await loadClubSettings();
  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MembershipRequest" WHERE id = ${requestId} FOR UPDATE`;
    const request = await tx.membershipRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new AppError("NOT_FOUND", "Demande introuvable.");
    if (request.status !== "PENDING") {
      throw new AppError("CONFLICT", "Cette demande a déjà été traitée.");
    }
    const memberNumber = await allocateMemberNumber(tx, now);
    const user = await createPendingUser(
      {
        firstName: request.firstName,
        lastName: request.lastName,
        email: request.email,
        phone: request.phone,
        roles: ["member"],
        isDemo: request.isDemo,
      },
      actorId,
      tx,
    );
    await tx.user.update({ where: { id: user.id }, data: { memberNumber } });
    await tx.membership.create({
      data: {
        userId: user.id,
        requestId: request.id,
        status: "ACTIVE",
        startsAt: now,
        endsAt: addMonths(now, membershipDurationMonths),
      },
    });
    await tx.membershipRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: actorId, reviewedAt: now, userId: user.id },
    });
    await audit(
      {
        actorId,
        action: "membership.approved",
        entityType: "MembershipRequest",
        entityId: request.id,
        metadata: { userId: user.id, memberNumber },
      },
      tx,
    );
    // Le membre la trouvera en se connectant (l'e-mail d'activation part juste après).
    await createNotifications(
      [
        {
          userId: user.id,
          type: "membership.welcome",
          title: `Bienvenue au club, membre n° ${memberNumber}`,
          body: "Votre adhésion est validée. Votre carte de membre et vos rencontres vous attendent dans votre espace.",
          href: "/member/card",
        },
      ],
      tx,
    );
    return { userId: user.id, memberNumber };
  });
  // Le compte existe : si l'e-mail ne part pas, le responsable peut renvoyer le lien depuis la fiche du membre.
  let emailSent = true;
  try {
    await sendActivationEmail(created.userId, actorId);
  } catch (error) {
    emailSent = false;
    logger.error("E-mail d’activation non envoyé après validation", error, created);
  }
  return { ...created, emailSent };
}

/** Refuse une demande, avec un mot facultatif transmis au demandeur. */
export async function rejectMembershipRequest(
  requestId: string,
  reason: string,
  actorId: string,
): Promise<{ emailSent: boolean }> {
  const request = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "MembershipRequest" WHERE id = ${requestId} FOR UPDATE`;
    const found = await tx.membershipRequest.findUnique({ where: { id: requestId } });
    if (!found) throw new AppError("NOT_FOUND", "Demande introuvable.");
    if (found.status !== "PENDING") {
      throw new AppError("CONFLICT", "Cette demande a déjà été traitée.");
    }
    await tx.membershipRequest.update({
      where: { id: found.id },
      data: {
        status: "REJECTED",
        reviewedById: actorId,
        reviewedAt: new Date(),
        rejectionReason: reason || null,
      },
    });
    await audit(
      {
        actorId,
        action: "membership.rejected",
        entityType: "MembershipRequest",
        entityId: found.id,
        metadata: { withReason: Boolean(reason) },
      },
      tx,
    );
    return found;
  });
  try {
    await sendMail(
      membershipRejectedEmail({ to: request.email, firstName: request.firstName, reason }),
    );
    return { emailSent: true };
  } catch (error) {
    logger.error("E-mail de refus non envoyé", error, { requestId });
    return { emailSent: false };
  }
}

/** Demandes refusées depuis plus de `months` mois : supprimées (REGLES-METIER n° 28). */
export async function purgeRejectedRequests(months: number, now = new Date()): Promise<number> {
  const { count } = await prisma.membershipRequest.deleteMany({
    where: { status: "REJECTED", reviewedAt: { lt: addMonths(now, -months) } },
  });
  return count;
}

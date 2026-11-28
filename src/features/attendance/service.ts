import type { EventTypeCode } from "@/config/activities";
import type { UserStatus } from "@/generated/prisma/client";
import {
  cardRejectionMessages,
  verifyCardToken,
  type CardRejection,
} from "@/features/members/card-service";
import { applyAttendance, checkInOpensAt } from "@/features/payments/service";
import { loadClubSettings } from "@/features/settings/club";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { avatarUrl } from "@/lib/storage-names";

/**
 * Scan des présences (carte de membre) et saisie de secours, pour la rencontre du jour.
 * Règles du pointage manuel (docs/REGLES-METIER.md, « Cotisations ») : inscription confirmée,
 * ouverture le jour de la rencontre. En plus, la rencontre doit être publiée ou clôturée.
 * Un membre non inscrit est refusé : les inscriptions ferment au début de la rencontre et
 * aucune règle ne prévoit l'inscription sur place (docs/DECISIONS.md, section 11).
 */

const DAY = 24 * 60 * 60 * 1000;

export type CheckInEvent = {
  id: string;
  title: string;
  /** Activité principale, puis toutes les activités de la rencontre. */
  type: EventTypeCode;
  activities: EventTypeCode[];
  startsAt: Date;
  confirmed: number;
  present: number;
};

/** Rencontres du jour (heure de Dakar) où l'on peut pointer, de la plus proche à la plus tardive. */
export async function listCheckInEvents(now: Date, db: Db = prisma): Promise<CheckInEvent[]> {
  const from = checkInOpensAt(now);
  const events = await db.event.findMany({
    where: {
      archivedAt: null,
      status: { in: ["PUBLISHED", "CLOSED"] },
      startsAt: { gte: from, lt: new Date(from.getTime() + DAY) },
    },
    orderBy: { startsAt: "asc" },
    select: { id: true, title: true, type: true, activities: true, startsAt: true },
  });
  const counts = await db.eventRegistration.groupBy({
    by: ["eventId"],
    where: { eventId: { in: events.map((e) => e.id) }, status: "CONFIRMED", userId: { not: null } },
    _count: { _all: true, attendedAt: true },
  });
  const byEvent = new Map(counts.map((row) => [row.eventId, row._count]));
  return events.map((event) => ({
    ...event,
    confirmed: byEvent.get(event.id)?._all ?? 0,
    present: byEvent.get(event.id)?.attendedAt ?? 0,
  }));
}

export type ScanRejection = CardRejection | "not_registered" | "registration_cancelled";

export const scanRejectionMessages: Record<ScanRejection, string> = {
  ...cardRejectionMessages,
  not_registered:
    "Ce membre n’est pas inscrit à cette rencontre. Les inscriptions ferment au début de la rencontre : il ne peut pas être pointé.",
  registration_cancelled: "Ce membre a annulé son inscription à cette rencontre.",
};

export type CheckInResult =
  | { ok: false; reason: ScanRejection; message: string }
  | {
      ok: true;
      member: {
        /** Pour encaisser la carte depuis l'écran du scan (responsable des paiements). */
        id: string;
        firstName: string;
        lastName: string;
        memberNumber: string | null;
        photoUrl: string | null;
        /** Carte de membre réglée (encaissement actif). */
        cardPaid: boolean;
      };
      registrationId: string;
      /** Déjà pointé avant ce geste : rien n'a changé côté présence ni points. */
      alreadyPresent: boolean;
      attendedAt: Date;
      method: "QR_SCAN" | "MANUAL";
      paid: boolean;
      pointsAwarded: number;
      badges: string[];
    };

type Rights = { attendance: boolean; payments: boolean };

/** Compte qui ne peut pas être pointé (mêmes raisons que le refus d'une carte au scan). */
function accountRefusal(status: UserStatus): ScanRejection | null {
  if (status === "ACTIVE") return null;
  if (status === "SUSPENDED") return "suspended";
  if (status === "ARCHIVED") return "archived";
  return "not_activated";
}

/** Rencontre ouverte au pointage, ou erreur claire. */
async function assertCheckInOpen(db: Db, eventId: string, now: Date): Promise<void> {
  const event = await db.event.findFirst({
    where: { id: eventId, archivedAt: null },
    select: { status: true, startsAt: true },
  });
  if (!event) throw new AppError("NOT_FOUND", "Rencontre introuvable.");
  if (event.status !== "PUBLISHED" && event.status !== "CLOSED") {
    throw new AppError("CONFLICT", "Cette rencontre n’est pas ouverte au pointage.");
  }
  if (now.getTime() < checkInOpensAt(event.startsAt).getTime()) {
    throw new AppError("CONFLICT", "Le pointage ouvre le jour de la rencontre.");
  }
}

/**
 * Pointe un membre (déjà identifié) à une rencontre. Idempotent : un second passage ne change
 * ni la présence ni les points ; il peut seulement ajouter la participation si elle manquait.
 * La case « payé » ne retire jamais un encaissement depuis le scan.
 */
async function checkIn(
  input: { eventId: string; userId: string; paid: boolean; method: "QR_SCAN" | "MANUAL" },
  actorId: string,
  rights: Rights,
  now: Date,
): Promise<CheckInResult> {
  if (!rights.attendance) throw new AppError("FORBIDDEN");
  if (input.paid && !rights.payments) throw new AppError("FORBIDDEN");
  await assertCheckInOpen(prisma, input.eventId, now);
  const { sessionFee } = await loadClubSettings();
  return prisma.$transaction(
    async (tx) => {
      // Mêmes contrôles de compte que la carte (`verifyCardToken`) : la saisie de secours ne doit
      // pas pointer, ni payer de points à, un compte suspendu, archivé ou pas encore activé.
      const account = await tx.user.findUnique({
        where: { id: input.userId },
        select: { status: true },
      });
      const refusal = account ? accountRefusal(account.status) : "not_registered";
      if (refusal) {
        return { ok: false, reason: refusal, message: scanRejectionMessages[refusal] };
      }
      const found = await tx.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: input.eventId, userId: input.userId } },
        select: { id: true },
      });
      if (!found) {
        return {
          ok: false,
          reason: "not_registered",
          message: scanRejectionMessages.not_registered,
        };
      }
      // Verrou d'abord, lecture ensuite : deux scans simultanés de la même carte se suivent, et
      // le second voit la présence et l'encaissement du premier (sans quoi il pourrait l'annuler).
      await tx.$queryRaw`SELECT id FROM "EventRegistration" WHERE id = ${found.id} FOR UPDATE`;
      const registration = await tx.eventRegistration.findUniqueOrThrow({
        where: { id: found.id },
        select: {
          id: true,
          status: true,
          attendedAt: true,
          payments: { where: { kind: "SESSION_FEE", cancelledAt: null }, select: { id: true } },
        },
      });
      if (registration.status !== "CONFIRMED") {
        return {
          ok: false,
          reason: "registration_cancelled",
          message: scanRejectionMessages.registration_cancelled,
        };
      }
      const alreadyPaid = registration.payments.length > 0;
      const state = await applyAttendance(
        tx,
        {
          registrationId: registration.id,
          present: true,
          paid: alreadyPaid || input.paid,
          method: input.method,
        },
        actorId,
        rights,
        { now, sessionFee },
      );
      const user = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: {
          firstName: true,
          lastName: true,
          memberNumber: true,
          image: true,
          payments: {
            where: { kind: "MEMBERSHIP_CARD", cancelledAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
      return {
        ok: true,
        member: {
          id: input.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          memberNumber: user.memberNumber,
          photoUrl: user.image ? avatarUrl(user.image) : null,
          cardPaid: user.payments.length > 0,
        },
        registrationId: registration.id,
        alreadyPresent: registration.attendedAt !== null,
        attendedAt: state.attendedAt!,
        method: state.checkInMethod ?? input.method,
        paid: state.paid,
        pointsAwarded: state.pointsAwarded,
        badges: state.badges,
      };
    },
    { timeout: 15_000 },
  );
}

/** Scan d'une carte : jeton vérifié (signature, version, compte actif), puis pointage `QR_SCAN`. */
export async function scanCardCheckIn(
  input: { eventId: string; token: string; paid: boolean },
  actorId: string,
  rights: Rights,
  now: Date = new Date(),
): Promise<CheckInResult> {
  if (!rights.attendance) throw new AppError("FORBIDDEN");
  const card = await verifyCardToken(input.token);
  if (!card.ok)
    return { ok: false, reason: card.reason, message: cardRejectionMessages[card.reason] };
  return checkIn({ ...input, userId: card.member.id, method: "QR_SCAN" }, actorId, rights, now);
}

/** Saisie de secours : membre choisi dans la liste des inscrits, pointage `MANUAL`. */
export async function manualCheckIn(
  input: { eventId: string; userId: string; paid: boolean },
  actorId: string,
  rights: Rights,
  now: Date = new Date(),
): Promise<CheckInResult> {
  return checkIn({ ...input, method: "MANUAL" }, actorId, rights, now);
}

export type RegistrantMatch = {
  userId: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  present: boolean;
};

/** Recherche d'un inscrit confirmé par nom, prénom ou numéro de membre (secours sans caméra). */
export async function searchRegistrants(
  eventId: string,
  query: string,
  db: Db = prisma,
): Promise<RegistrantMatch[]> {
  const words = query.trim().split(/\s+/).filter(Boolean).slice(0, 4);
  if (words.length === 0) return [];
  const rows = await db.eventRegistration.findMany({
    where: {
      eventId,
      status: "CONFIRMED",
      user: {
        is: {
          AND: words.map((word) => ({
            OR: [
              { firstName: { contains: word, mode: "insensitive" as const } },
              { lastName: { contains: word, mode: "insensitive" as const } },
              { memberNumber: { contains: word, mode: "insensitive" as const } },
            ],
          })),
        },
      },
    },
    take: 8,
    orderBy: { user: { lastName: "asc" } },
    select: {
      attendedAt: true,
      user: { select: { id: true, firstName: true, lastName: true, memberNumber: true } },
    },
  });
  return rows.flatMap((row) =>
    row.user
      ? [
          {
            userId: row.user.id,
            firstName: row.user.firstName,
            lastName: row.user.lastName,
            memberNumber: row.user.memberNumber,
            present: row.attendedAt !== null,
          },
        ]
      : [],
  );
}

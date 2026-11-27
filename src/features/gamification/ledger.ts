import { randomUUID } from "node:crypto";
import type { PointSourceType, PrismaClient } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import type { Db } from "@/lib/prisma";
import {
  canReverse,
  decideAward,
  reversalMessages,
  type SkipReason,
} from "@/features/gamification/rules";

/**
 * Grand livre des points (`PointTransaction`) : écriture seule. Une ligne n'est jamais modifiée
 * ni supprimée ; une correction est une ligne inverse (`reversesId`), une seule par ligne.
 * Fonctions internes au domaine : les points ne s'écrivent que par `service.ts`.
 */
export type Tx = Exclude<Db, PrismaClient>;

/** Exécute `fn` dans la transaction fournie, ou en ouvre une sur le client racine. */
export async function runInTransaction<T>(db: Db, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if ("$transaction" in db) return db.$transaction((tx) => fn(tx), { timeout: 15_000 });
  return fn(db);
}

/** Bénéficiaire possible : un compte de membre (numéro attribué) qui n'est pas archivé. */
export async function memberStatus(tx: Db, userId: string): Promise<"member" | "not_member"> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { status: true, memberNumber: true, archivedAt: true },
  });
  if (!user || !user.memberNumber || user.status === "ARCHIVED" || user.archivedAt) {
    return "not_member";
  }
  return "member";
}

export async function assertMember(tx: Db, userId: string): Promise<void> {
  if ((await memberStatus(tx, userId)) !== "member") {
    throw new AppError("NOT_FOUND", "Membre introuvable.");
  }
}

/**
 * Sérialise les attributions d'une même source (verrou consultatif de transaction) :
 * deux validations simultanées ne peuvent pas décider chacune qu'il faut payer.
 */
export async function lockSource(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}

export type AwardResult = {
  status: "awarded" | "already_awarded" | "skipped";
  reason: SkipReason | null;
  /** Ligne créée ou déjà active pour cette source. */
  transactionId: string | null;
  points: number;
  /** Badges obtenus grâce à cette attribution. */
  badges: string[];
};

export const skipped = (reason: SkipReason): AwardResult => ({
  status: "skipped",
  reason,
  transactionId: null,
  points: 0,
  badges: [],
});

const alreadyAwarded = (transactionId: string | null): AwardResult => ({
  status: "already_awarded",
  reason: null,
  transactionId,
  points: 0,
  badges: [],
});

/** Clé du verrou d'une source : partagée par l'attribution et le retrait des points. */
export const sourceLockKey = (userId: string, sourceType: PointSourceType, sourceId: string) =>
  `points:${userId}:${sourceType}:${sourceId}`;

/**
 * Paie une règle pour une source, une seule fois par rang. L'anti-doublon tient à deux niveaux :
 * le verrou de source, puis la contrainte unique (membre, règle, type, source, rang) en base,
 * écrite par `INSERT … ON CONFLICT DO NOTHING` (`skipDuplicates`) : une violation ne fait pas
 * échouer la transaction de l'appelant, elle se lit « déjà attribué ». Plusieurs règles peuvent
 * payer une même source (rencontre à plusieurs activités) : chacune a sa ligne.
 */
export async function awardForSource(
  tx: Tx,
  input: {
    userId: string;
    rule: { id: string; code: string; label: string; points: number };
    sourceType: PointSourceType;
    sourceId: string;
    actorId: string | null;
  },
): Promise<AwardResult> {
  const { userId, rule, sourceType, sourceId, actorId } = input;
  await lockSource(tx, sourceLockKey(userId, sourceType, sourceId));
  const lines = await tx.pointTransaction.findMany({
    where: { userId, sourceType, sourceId },
    select: {
      id: true,
      points: true,
      ruleId: true,
      grantSeq: true,
      reversedBy: { select: { id: true } },
    },
  });
  const decision = decideAward(
    lines.map((line) => ({ ...line, reversed: line.reversedBy !== null })),
    rule.id,
  );
  if (decision.kind === "already_awarded") {
    return alreadyAwarded(decision.transactionId);
  }
  const id = randomUUID();
  const regrant = decision.grantSeq > 0;
  const { count } = await tx.pointTransaction.createMany({
    data: [
      {
        id,
        userId,
        ruleId: rule.id,
        grantSeq: decision.grantSeq,
        points: rule.points,
        sourceType,
        sourceId,
        // Nouvelle attribution après une correction (présence décochée puis recochée).
        reason: regrant ? `Nouvelle attribution : ${rule.label}` : null,
        createdById: actorId,
      },
    ],
    skipDuplicates: true,
  });
  if (count === 0) {
    const existing = await tx.pointTransaction.findFirst({
      where: { userId, ruleId: rule.id, sourceType, sourceId, grantSeq: decision.grantSeq },
      select: { id: true },
    });
    return alreadyAwarded(existing?.id ?? null);
  }
  await audit(
    {
      actorId,
      action: "points.awarded",
      entityType: "PointTransaction",
      entityId: id,
      metadata: {
        userId,
        rule: rule.code,
        points: rule.points,
        sourceType,
        sourceId,
        regrant,
        grantSeq: decision.grantSeq,
      },
    },
    tx,
  );
  return { status: "awarded", reason: null, transactionId: id, points: rule.points, badges: [] };
}

/** Écrit la ligne inverse d'une transaction. Refuse l'inverse d'une inverse et la double inverse. */
export async function reverseInTx(
  tx: Tx,
  transactionId: string,
  actorId: string | null,
  reason: string,
  options: { forbidSelf: boolean },
): Promise<{ id: string; userId: string; points: number }> {
  await tx.$queryRaw`SELECT id FROM "PointTransaction" WHERE id = ${transactionId} FOR UPDATE`;
  const line = await tx.pointTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      userId: true,
      points: true,
      ruleId: true,
      reversesId: true,
      reversedBy: { select: { id: true } },
    },
  });
  if (!line) throw new AppError("NOT_FOUND", "Ligne de points introuvable.");
  if (options.forbidSelf && actorId === line.userId) {
    throw new AppError("FORBIDDEN", "Vous ne pouvez pas corriger vos propres points.");
  }
  const check = canReverse({ ...line, reversed: line.reversedBy !== null });
  if (!check.ok) throw new AppError("CONFLICT", reversalMessages[check.reason]);
  const id = randomUUID();
  await tx.pointTransaction.create({
    data: {
      id,
      userId: line.userId,
      ruleId: null,
      points: -line.points,
      sourceType: "CORRECTION",
      sourceId: line.id,
      reversesId: line.id,
      reason,
      createdById: actorId,
    },
  });
  await audit(
    {
      actorId,
      action: "points.reversed",
      entityType: "PointTransaction",
      entityId: id,
      metadata: { userId: line.userId, reverses: line.id, points: -line.points, reason },
    },
    tx,
  );
  return { id, userId: line.userId, points: -line.points };
}

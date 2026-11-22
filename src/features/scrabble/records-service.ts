import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { memberStatus, runInTransaction } from "@/features/gamification/ledger";
import type { RecordData } from "@/features/scrabble/schemas";

/**
 * Records du club (`ScrabbleRecord`). Catégories libres : le comité ne les a pas arrêtées.
 * Un record battu n'est pas effacé : `replaceRecord` le marque `supersededAt` et crée le nouveau,
 * dans la même catégorie. Rien n'est affiché tant qu'aucun record n'est en cours.
 */
async function checkRefs(tx: Db, data: RecordData) {
  if (data.userId && (await memberStatus(tx, data.userId)) !== "member") {
    throw new AppError("VALIDATION", undefined, { fieldErrors: { userId: "Membre introuvable." } });
  }
  if (data.tournamentId) {
    const exists = await tx.tournament.count({
      where: { id: data.tournamentId, archivedAt: null },
    });
    if (!exists) {
      throw new AppError("VALIDATION", undefined, {
        fieldErrors: { tournamentId: "Tournoi introuvable." },
      });
    }
  }
}

const trace = (actorId: string, id: string, metadata: Record<string, unknown>, tx: Db) =>
  audit(
    {
      actorId,
      action: "scrabble.record_saved",
      entityType: "ScrabbleRecord",
      entityId: id,
      metadata,
    },
    tx,
  );

export async function createRecord(
  data: RecordData,
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  return runInTransaction(db, async (tx) => {
    await checkRefs(tx, data);
    const row = await tx.scrabbleRecord.create({ data, select: { id: true } });
    await trace(actorId, row.id, { created: true, category: data.category, value: data.value }, tx);
    return row;
  });
}

async function loadCurrent(tx: Db, id: string) {
  const row = await tx.scrabbleRecord.findUnique({
    where: { id },
    select: { id: true, category: true, value: true, supersededAt: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Record introuvable.");
  return row;
}

/** Correction d'une saisie (faute de frappe). Pour un record battu : `replaceRecord`. */
export async function updateRecord(
  id: string,
  data: RecordData,
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const before = await loadCurrent(tx, id);
    await checkRefs(tx, data);
    await tx.scrabbleRecord.update({ where: { id }, data });
    await trace(
      actorId,
      id,
      {
        before: { category: before.category, value: before.value },
        after: { category: data.category, value: data.value },
      },
      tx,
    );
  });
}

/** Record battu : l'ancien est gardé (`supersededAt`), le nouveau prend sa place. */
export async function replaceRecord(
  id: string,
  data: RecordData,
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string }> {
  return runInTransaction(db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ScrabbleRecord" WHERE id = ${id} FOR UPDATE`;
    const old = await loadCurrent(tx, id);
    if (old.supersededAt) throw new AppError("CONFLICT", "Ce record a déjà été battu.");
    await checkRefs(tx, data);
    await tx.scrabbleRecord.update({ where: { id }, data: { supersededAt: new Date() } });
    const row = await tx.scrabbleRecord.create({ data, select: { id: true } });
    await trace(
      actorId,
      row.id,
      { replaces: id, before: old.value, after: data.value, category: data.category },
      tx,
    );
    return row;
  });
}

/** Suppression d'une saisie erronée (tracée). */
export async function deleteRecord(id: string, actorId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const old = await loadCurrent(tx, id);
    await tx.scrabbleRecord.delete({ where: { id } });
    await audit(
      {
        actorId,
        action: "scrabble.record_deleted",
        entityType: "ScrabbleRecord",
        entityId: id,
        metadata: { category: old.category, value: old.value },
      },
      tx,
    );
  });
}

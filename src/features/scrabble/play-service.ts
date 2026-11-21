import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { runInTransaction } from "@/features/gamification/ledger";
import {
  assertNotValidated,
  assertStatus,
  lockByMatch,
  lockByRound,
  lockTournament,
} from "@/features/scrabble/guards";
import { PLAY_STATUSES } from "@/features/scrabble/rules";

/**
 * Manches, parties (mode classique, appariements saisis à la main) et scores.
 * Un score par joueur et par manche (contrainte unique), entier de 0 à MAX_SCORE, forfait → 0
 * (contrainte CHECK). **Après validation des résultats, toute saisie est refusée** : il faut
 * d'abord dévalider (motif obligatoire, points de victoire repris), puis corriger, puis revalider.
 */
const notPlaying = "Les scores se saisissent quand le tournoi est ouvert, en cours ou terminé.";

export async function createRound(
  tournamentId: string,
  db: Db = prisma,
): Promise<{ id: string; number: number }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertNotValidated(tournament);
    if (tournament.status === "CANCELLED") throw new AppError("CONFLICT", "Ce tournoi est annulé.");
    const last = await tx.round.findFirst({
      where: { tournamentId },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    const number = (last?.number ?? 0) + 1;
    const row = await tx.round.create({ data: { tournamentId, number }, select: { id: true } });
    return { id: row.id, number };
  });
}

export async function setRoundStatus(
  roundId: string,
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED",
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    assertNotValidated(await lockByRound(tx, roundId));
    await tx.round.update({ where: { id: roundId }, data: { status } });
  });
}

/** Suppression d'une manche sans score (ses parties partent avec elle). */
export async function deleteRound(roundId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    assertNotValidated(await lockByRound(tx, roundId));
    if ((await tx.score.count({ where: { roundId } })) > 0) {
      throw new AppError("CONFLICT", "Cette manche a des scores : effacez-les d'abord.");
    }
    await tx.round.delete({ where: { id: roundId } });
  });
}

export async function createMatch(
  input: {
    roundId: string;
    participantAId: string;
    participantBId: string;
    tableNumber: number | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockByRound(tx, input.roundId);
    assertNotValidated(tournament);
    if (tournament.gameMode !== "CLASSIC") {
      throw new AppError(
        "CONFLICT",
        "En duplicate, il n'y a pas d'appariement : saisissez les scores de la manche.",
      );
    }
    const players = await tx.tournamentParticipant.findMany({
      where: {
        id: { in: [input.participantAId, input.participantBId] },
        tournamentId: tournament.id,
      },
      select: { id: true, withdrawnAt: true },
    });
    if (players.length !== 2)
      throw new AppError("NOT_FOUND", "Joueur introuvable dans ce tournoi.");
    if (players.some((p) => p.withdrawnAt)) {
      throw new AppError("CONFLICT", "Un joueur retiré ne peut plus être apparié.");
    }
    const busy = await tx.match.count({
      where: {
        roundId: input.roundId,
        OR: [
          { participantAId: { in: [input.participantAId, input.participantBId] } },
          { participantBId: { in: [input.participantAId, input.participantBId] } },
        ],
      },
    });
    if (busy > 0)
      throw new AppError("CONFLICT", "Un de ces joueurs a déjà une partie dans cette manche.");
    return tx.match.create({ data: input, select: { id: true } });
  });
}

export async function deleteMatch(matchId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    assertNotValidated(await lockByMatch(tx, matchId));
    if ((await tx.score.count({ where: { matchId } })) > 0) {
      throw new AppError("CONFLICT", "Cette partie a des scores : effacez-les d'abord.");
    }
    await tx.match.delete({ where: { id: matchId } });
  });
}

export type ScoreEntry = { participantId: string; points: number | null; isForfeit: boolean };

type Snapshot = { points: number; isForfeit: boolean } | null;

/**
 * Saisie ou correction des scores d'une manche (plusieurs joueurs à la fois, depuis un téléphone).
 * `points: null` sans forfait efface le score. Chaque changement est tracé avec l'avant et l'après.
 */
export async function saveScores(
  input: { roundId: string; entries: readonly ScoreEntry[] },
  actorId: string,
  db: Db = prisma,
): Promise<{ saved: number; removed: number }> {
  const ids = input.entries.map((e) => e.participantId);
  if (new Set(ids).size !== ids.length) {
    throw new AppError("VALIDATION", "Un joueur apparaît deux fois dans la saisie.");
  }
  return runInTransaction(db, async (tx) => {
    const tournament = await lockByRound(tx, input.roundId);
    assertStatus(tournament, PLAY_STATUSES, notPlaying);
    assertNotValidated(tournament);
    const classic = tournament.gameMode === "CLASSIC";
    const players = await tx.tournamentParticipant.findMany({
      where: { id: { in: ids }, tournamentId: tournament.id },
      select: { id: true },
    });
    if (players.length !== ids.length)
      throw new AppError("NOT_FOUND", "Joueur introuvable dans ce tournoi.");
    const matches = classic
      ? await tx.match.findMany({
          where: {
            roundId: input.roundId,
            OR: [{ participantAId: { in: ids } }, { participantBId: { in: ids } }],
          },
          select: { id: true, participantAId: true, participantBId: true },
        })
      : [];
    const matchOf = new Map(
      matches.flatMap(
        (m) =>
          [
            [m.participantAId, m.id],
            [m.participantBId, m.id],
          ] as const,
      ),
    );
    const existing = await tx.score.findMany({
      where: { roundId: input.roundId, participantId: { in: ids } },
      select: { id: true, participantId: true, points: true, isForfeit: true },
    });
    const before = new Map(existing.map((s) => [s.participantId, s]));
    const changes: { participantId: string; before: Snapshot; after: Snapshot }[] = [];
    let saved = 0;
    let removed = 0;
    for (const entry of input.entries) {
      const old = before.get(entry.participantId);
      const previous: Snapshot = old ? { points: old.points, isForfeit: old.isForfeit } : null;
      if (entry.points === null && !entry.isForfeit) {
        if (!old) continue;
        await tx.score.delete({ where: { id: old.id } });
        removed += 1;
        changes.push({ participantId: entry.participantId, before: previous, after: null });
        continue;
      }
      const matchId = classic ? (matchOf.get(entry.participantId) ?? null) : null;
      if (classic && !matchId) {
        throw new AppError(
          "CONFLICT",
          "Ce joueur n'a pas de partie dans cette manche : appariez-le d'abord.",
        );
      }
      const after = { points: entry.isForfeit ? 0 : entry.points!, isForfeit: entry.isForfeit };
      if (previous && previous.points === after.points && previous.isForfeit === after.isForfeit)
        continue;
      await tx.score.upsert({
        where: {
          roundId_participantId: { roundId: input.roundId, participantId: entry.participantId },
        },
        create: {
          roundId: input.roundId,
          participantId: entry.participantId,
          matchId,
          ...after,
          enteredById: actorId,
        },
        update: { matchId, ...after, enteredById: actorId },
      });
      saved += 1;
      changes.push({ participantId: entry.participantId, before: previous, after });
    }
    for (const match of matches) await refreshMatchStatus(tx, match.id);
    if (changes.length > 0) {
      await audit(
        {
          actorId,
          action: "scrabble.scores_saved",
          entityType: "Round",
          entityId: input.roundId,
          metadata: { tournamentId: tournament.id, changes },
        },
        tx,
      );
    }
    return { saved, removed };
  });
}

/** État d'une partie d'après ses scores : jouée, forfait, ou à jouer. */
async function refreshMatchStatus(tx: Db, matchId: string): Promise<void> {
  const scores = await tx.score.findMany({ where: { matchId }, select: { isForfeit: true } });
  const status =
    scores.length < 2 ? "SCHEDULED" : scores.some((s) => s.isForfeit) ? "FORFEIT" : "PLAYED";
  await tx.match.update({ where: { id: matchId }, data: { status } });
}

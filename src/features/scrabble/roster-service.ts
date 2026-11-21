import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { runInTransaction } from "@/features/gamification/ledger";
import {
  assertNotValidated,
  assertStatus,
  lockByParticipant,
  lockByTeam,
  lockTournament,
  type LockedTournament,
} from "@/features/scrabble/guards";
import { ROSTER_STATUSES } from "@/features/scrabble/rules";

/**
 * Joueurs et équipes d'un tournoi. Un joueur est un membre actif (compte avec numéro) OU un
 * participant extérieur (nom + club) ; la base l'impose par une contrainte CHECK. Pas de doublon :
 * un membre une fois par tournoi (contrainte unique), un extérieur une fois par nom.
 * Règle n° 15 : inscrire un membre à un tournoi lié à une rencontre l'inscrit aussi à la rencontre.
 */
const rosterClosed = "Les inscriptions à ce tournoi sont closes (terminé ou annulé).";

async function assertTeam(tx: Db, tournament: LockedTournament, teamId: string | null) {
  if (!teamId) return;
  if (tournament.format !== "TEAMS") {
    throw new AppError("CONFLICT", "Ce tournoi se joue en individuel : pas d'équipe.");
  }
  const team = await tx.team.findFirst({
    where: { id: teamId, tournamentId: tournament.id },
    select: { id: true },
  });
  if (!team) throw new AppError("NOT_FOUND", "Équipe introuvable.");
}

/**
 * Inscription d'un membre à la rencontre liée (règle n° 15), confirmée d'office : c'est un
 * responsable qui inscrit le joueur, la capacité de la rencontre n'est pas revérifiée.
 */
async function registerToEvent(tx: Db, eventId: string, userId: string): Promise<boolean> {
  const existing = await tx.eventRegistration.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: { id: true, status: true },
  });
  if (existing?.status === "CONFIRMED") return false;
  const data = { status: "CONFIRMED" as const, confirmedAt: new Date(), cancelledAt: null };
  if (existing) await tx.eventRegistration.update({ where: { id: existing.id }, data });
  else await tx.eventRegistration.create({ data: { eventId, userId, ...data } });
  return true;
}

export async function addParticipant(
  input: {
    tournamentId: string;
    userId: string | null;
    externalName: string | null;
    externalClub: string | null;
    teamId: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string; eventRegistered: boolean }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, input.tournamentId);
    assertStatus(tournament, ROSTER_STATUSES, rosterClosed);
    assertNotValidated(tournament);
    await assertTeam(tx, tournament, input.teamId);
    if (input.userId) {
      const user = await tx.user.findUnique({
        where: { id: input.userId },
        select: { status: true, memberNumber: true, archivedAt: true },
      });
      if (!user || !user.memberNumber || user.archivedAt || user.status !== "ACTIVE") {
        throw new AppError("NOT_FOUND", "Membre actif introuvable.");
      }
      const known = await tx.tournamentParticipant.findUnique({
        where: { tournamentId_userId: { tournamentId: tournament.id, userId: input.userId } },
        select: { id: true },
      });
      if (known) throw new AppError("CONFLICT", "Ce membre est déjà inscrit au tournoi.");
      const row = await tx.tournamentParticipant.create({
        data: { tournamentId: tournament.id, userId: input.userId, teamId: input.teamId },
        select: { id: true },
      });
      const eventRegistered = tournament.eventId
        ? await registerToEvent(tx, tournament.eventId, input.userId)
        : false;
      return { id: row.id, eventRegistered };
    }
    const name = input.externalName!.trim();
    const twin = await tx.tournamentParticipant.findFirst({
      where: { tournamentId: tournament.id, externalName: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (twin)
      throw new AppError("CONFLICT", "Un participant extérieur porte déjà ce nom dans ce tournoi.");
    const row = await tx.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        externalName: name,
        externalClub: input.externalClub,
        teamId: input.teamId,
      },
      select: { id: true },
    });
    return { id: row.id, eventRegistered: false };
  });
}

/**
 * Retrait de la liste : seulement pour un joueur sans score ni partie. Un joueur qui a joué se
 * marque « retiré » (`setParticipantWithdrawn`) : il garde ses manches. L'inscription à la
 * rencontre liée n'est pas annulée (geste distinct, depuis la rencontre).
 */
export async function removeParticipant(participantId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const tournament = await lockByParticipant(tx, participantId);
    assertNotValidated(tournament);
    const [scores, matches] = [
      await tx.score.count({ where: { participantId } }),
      await tx.match.count({
        where: { OR: [{ participantAId: participantId }, { participantBId: participantId }] },
      }),
    ];
    if (scores > 0 || matches > 0) {
      throw new AppError("CONFLICT", "Ce joueur a déjà joué : marquez-le plutôt comme retiré.");
    }
    await tx.tournamentParticipant.delete({ where: { id: participantId } });
  });
}

export async function setParticipantWithdrawn(
  participantId: string,
  withdrawn: boolean,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const tournament = await lockByParticipant(tx, participantId);
    assertNotValidated(tournament);
    await tx.tournamentParticipant.update({
      where: { id: participantId },
      data: { withdrawnAt: withdrawn ? new Date() : null },
    });
  });
}

export async function assignParticipantTeam(
  participantId: string,
  teamId: string | null,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const tournament = await lockByParticipant(tx, participantId);
    assertNotValidated(tournament);
    await assertTeam(tx, tournament, teamId);
    await tx.tournamentParticipant.update({ where: { id: participantId }, data: { teamId } });
  });
}

async function assertTeamNameFree(tx: Db, tournamentId: string, name: string, exceptId?: string) {
  const twin = await tx.team.findFirst({
    where: {
      tournamentId,
      name: { equals: name, mode: "insensitive" },
      id: exceptId ? { not: exceptId } : undefined,
    },
    select: { id: true },
  });
  if (twin) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { name: "Une équipe porte déjà ce nom." },
    });
  }
}

export async function createTeam(
  input: { tournamentId: string; name: string },
  db: Db = prisma,
): Promise<{ id: string }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, input.tournamentId);
    assertNotValidated(tournament);
    if (tournament.format !== "TEAMS") {
      throw new AppError("CONFLICT", "Ce tournoi se joue en individuel : pas d'équipe.");
    }
    await assertTeamNameFree(tx, tournament.id, input.name);
    return tx.team.create({
      data: { tournamentId: tournament.id, name: input.name },
      select: { id: true },
    });
  });
}

export async function renameTeam(
  input: { teamId: string; name: string },
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const tournament = await lockByTeam(tx, input.teamId);
    assertNotValidated(tournament);
    await assertTeamNameFree(tx, tournament.id, input.name, input.teamId);
    await tx.team.update({ where: { id: input.teamId }, data: { name: input.name } });
  });
}

/** Suppression d'une équipe : ses joueurs restent inscrits, sans équipe. */
export async function deleteTeam(teamId: string, db: Db = prisma): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const tournament = await lockByTeam(tx, teamId);
    assertNotValidated(tournament);
    await tx.team.delete({ where: { id: teamId } });
  });
}

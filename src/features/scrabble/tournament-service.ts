import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";
import { runInTransaction } from "@/features/gamification/ledger";
import { assertNotValidated, lockTournament } from "@/features/scrabble/guards";
import { canTransition, statusLabels, type TournamentStatusCode } from "@/features/scrabble/rules";
import type { TournamentData } from "@/features/scrabble/schemas";

/**
 * Tournois : création, modification, cycle de vie (DRAFT → REGISTRATION_OPEN → IN_PROGRESS →
 * COMPLETED, ou CANCELLED), archivage. Lien facultatif à une rencontre de Scrabble.
 */
const SCRABBLE_EVENT_TYPES = ["TOURNOI_SCRABBLE", "INITIATION_SCRABBLE"] as const;

async function checkEvent(tx: Db, eventId: string | null, tournamentId: string | null) {
  if (!eventId) return;
  const event = await tx.event.findFirst({
    where: { id: eventId, archivedAt: null },
    select: { activities: true, tournament: { select: { id: true } } },
  });
  if (!event) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { eventId: "Rencontre introuvable." },
    });
  }
  // Au moins une activité Scrabble parmi celles de la rencontre (principale ou non).
  if (
    !event.activities.some((code) => (SCRABBLE_EVENT_TYPES as readonly string[]).includes(code))
  ) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { eventId: "Choisissez une rencontre de Scrabble (tournoi ou initiation)." },
    });
  }
  if (event.tournament && event.tournament.id !== tournamentId) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { eventId: "Cette rencontre est déjà liée à un autre tournoi." },
    });
  }
}

function checkDates(data: TournamentData) {
  if (data.endsAt && data.endsAt.getTime() < data.startsAt.getTime()) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { endsAt: "La fin ne peut pas précéder le début." },
    });
  }
}

export async function createTournament(
  data: TournamentData,
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string; slug: string }> {
  checkDates(data);
  return runInTransaction(db, async (tx) => {
    await checkEvent(tx, data.eventId, null);
    const slug = await uniqueSlug(
      data.name,
      async (candidate) => (await tx.tournament.count({ where: { slug: candidate } })) > 0,
      "tournoi",
    );
    const row = await tx.tournament.create({
      data: { ...data, slug },
      select: { id: true, slug: true },
    });
    await audit(
      {
        actorId,
        action: "scrabble.status_changed",
        entityType: "Tournament",
        entityId: row.id,
        metadata: { created: true, status: "DRAFT" },
      },
      tx,
    );
    return row;
  });
}

/**
 * Modification. Format et mode de jeu ne changent plus une fois des manches créées ; rien ne
 * change après la validation des résultats (il faut d'abord dévalider). Le slug reste stable.
 */
export async function updateTournament(
  id: string,
  data: TournamentData,
  db: Db = prisma,
): Promise<void> {
  checkDates(data);
  await runInTransaction(db, async (tx) => {
    const current = await lockTournament(tx, id);
    assertNotValidated(current);
    if (current.format !== data.format || current.gameMode !== data.gameMode) {
      const rounds = await tx.round.count({ where: { tournamentId: id } });
      if (rounds > 0) {
        throw new AppError(
          "CONFLICT",
          "Le format et le mode de jeu ne se changent plus une fois des manches créées.",
        );
      }
    }
    await checkEvent(tx, data.eventId, id);
    await tx.tournament.update({ where: { id }, data });
  });
}

export async function setTournamentStatus(
  id: string,
  status: TournamentStatusCode,
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const current = await lockTournament(tx, id);
    if (current.status === status) return;
    if (!canTransition(current.status, status)) {
      throw new AppError(
        "CONFLICT",
        `Un tournoi « ${statusLabels[current.status]} » ne peut pas passer à « ${statusLabels[status]} ».`,
      );
    }
    // Rouvrir ou annuler un tournoi aux résultats validés : il faut d'abord les dévalider.
    if (current.status === "COMPLETED" || status === "CANCELLED") assertNotValidated(current);
    await tx.tournament.update({ where: { id }, data: { status } });
    await audit(
      {
        actorId,
        action: "scrabble.status_changed",
        entityType: "Tournament",
        entityId: id,
        metadata: { from: current.status, to: status },
      },
      tx,
    );
  });
}

/** Archivage (le tournoi disparaît des listes). Refusé si des résultats sont validés. */
export async function archiveTournament(
  id: string,
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const current = await lockTournament(tx, id);
    assertNotValidated(current);
    await tx.tournament.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit(
      {
        actorId,
        action: "scrabble.status_changed",
        entityType: "Tournament",
        entityId: id,
        metadata: { archived: true },
      },
      tx,
    );
  });
}

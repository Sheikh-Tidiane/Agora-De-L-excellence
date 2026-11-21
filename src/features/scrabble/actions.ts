"use server";

import { refresh, updateTag } from "next/cache";
import { z } from "zod";
import {
  addParticipantSchema,
  assignTeamSchema,
  createMatchSchema,
  createTeamSchema,
  invalidateResultsSchema,
  matchIdSchema,
  participantIdSchema,
  recordIdSchema,
  recordSchema,
  renameTeamSchema,
  replaceRecordSchema,
  roundIdSchema,
  roundStatusSchema,
  saveScoresSchema,
  teamIdSchema,
  tournamentIdSchema,
  tournamentSchema,
  tournamentStatusSchema,
  updateRecordSchema,
  updateTournamentSchema,
  withdrawParticipantSchema,
  type AddParticipantInput,
  type CreateMatchInput,
  type RecordInput,
  type SaveScoresInput,
  type TournamentInput,
} from "@/features/scrabble/schemas";
import * as scrabble from "@/features/scrabble/service";
import { searchMembersForTournament } from "@/features/scrabble/admin-read";
import { cacheTags } from "@/lib/cache-tags";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission, type PermissionCode } from "@/lib/permissions";

/**
 * Scrabble. Ordre : contrôle d'accès, validation Zod, service (verrou du tournoi, règles,
 * `AuditLog`). Permissions : `tournaments.manage` (tournois, joueurs, équipes, manches, parties,
 * records), `scores.enter` (scores), `results.publish` (validation, dévalidation, publication).
 */
function done(extraTags: string[] = []) {
  updateTag(cacheTags.scrabble);
  for (const tag of extraTags) updateTag(tag);
  refresh();
}

/** Contrôle d'accès, validation, service, puis invalidation du cache public. */
function guarded<S extends z.ZodType, T>(
  context: string,
  permission: PermissionCode,
  schema: S,
  input: unknown,
  run: (data: z.output<S>, actorId: string) => Promise<T>,
): Promise<ActionResult<T extends void ? undefined : T>> {
  return runAction(context, async () => {
    const actor = await requirePermission(permission);
    const data = parseInput(schema, input);
    const result = await run(data, actor.id);
    done();
    return result as T extends void ? undefined : T;
  });
}

// --- Tournois ---

export async function createTournamentAction(
  input: TournamentInput,
): Promise<ActionResult<{ id: string; slug: string }>> {
  return guarded(
    "scrabble.create",
    "tournaments.manage",
    tournamentSchema,
    input,
    (data, actorId) => scrabble.createTournament(data, actorId),
  );
}

export async function updateTournamentAction(
  input: TournamentInput & { id: string },
): Promise<ActionResult> {
  return guarded(
    "scrabble.update",
    "tournaments.manage",
    updateTournamentSchema,
    input,
    async ({ id, ...data }) => {
      await scrabble.updateTournament(id, data);
    },
  );
}

export async function setTournamentStatusAction(input: {
  tournamentId: string;
  status: string;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.status",
    "tournaments.manage",
    tournamentStatusSchema,
    input,
    (data, actorId) => scrabble.setTournamentStatus(data.tournamentId, data.status, actorId),
  );
}

export async function archiveTournamentAction(input: {
  tournamentId: string;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.archive",
    "tournaments.manage",
    tournamentIdSchema,
    input,
    (data, actorId) => scrabble.archiveTournament(data.tournamentId, actorId),
  );
}

// --- Joueurs et équipes ---

export async function addParticipantAction(
  input: AddParticipantInput,
): Promise<ActionResult<{ id: string; eventRegistered: boolean }>> {
  return runAction("scrabble.participant.add", async () => {
    await requirePermission("tournaments.manage");
    const result = await scrabble.addParticipant(parseInput(addParticipantSchema, input));
    // Règle n° 15 : une inscription à la rencontre liée change ses places restantes.
    done(result.eventRegistered ? [cacheTags.events] : []);
    return result;
  });
}

export async function removeParticipantAction(input: {
  participantId: string;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.participant.remove",
    "tournaments.manage",
    participantIdSchema,
    input,
    (data) => scrabble.removeParticipant(data.participantId),
  );
}

export async function setParticipantWithdrawnAction(input: {
  participantId: string;
  withdrawn: boolean;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.participant.withdraw",
    "tournaments.manage",
    withdrawParticipantSchema,
    input,
    (data) => scrabble.setParticipantWithdrawn(data.participantId, data.withdrawn),
  );
}

export async function assignParticipantTeamAction(input: {
  participantId: string;
  teamId: string | null;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.participant.team",
    "tournaments.manage",
    assignTeamSchema,
    input,
    (data) => scrabble.assignParticipantTeam(data.participantId, data.teamId),
  );
}

export async function searchMembersForTournamentAction(input: {
  tournamentId: string;
  q: string;
}): Promise<ActionResult<{ id: string; name: string; memberNumber: string }[]>> {
  return runAction("scrabble.members.search", async () => {
    await requirePermission("tournaments.manage");
    const { tournamentId, q } = parseInput(
      z.object({ tournamentId: z.string().min(1).max(40), q: z.string().trim().min(2).max(60) }),
      input,
    );
    return searchMembersForTournament(tournamentId, q);
  });
}

export async function createTeamAction(input: {
  tournamentId: string;
  name: string;
}): Promise<ActionResult<{ id: string }>> {
  return guarded("scrabble.team.create", "tournaments.manage", createTeamSchema, input, (data) =>
    scrabble.createTeam(data),
  );
}

export async function renameTeamAction(input: {
  teamId: string;
  name: string;
}): Promise<ActionResult> {
  return guarded("scrabble.team.rename", "tournaments.manage", renameTeamSchema, input, (data) =>
    scrabble.renameTeam(data),
  );
}

export async function deleteTeamAction(input: { teamId: string }): Promise<ActionResult> {
  return guarded("scrabble.team.delete", "tournaments.manage", teamIdSchema, input, (data) =>
    scrabble.deleteTeam(data.teamId),
  );
}

// --- Manches et parties ---

export async function createRoundAction(input: {
  tournamentId: string;
}): Promise<ActionResult<{ id: string; number: number }>> {
  return guarded("scrabble.round.create", "tournaments.manage", tournamentIdSchema, input, (data) =>
    scrabble.createRound(data.tournamentId),
  );
}

export async function setRoundStatusAction(input: {
  roundId: string;
  status: string;
}): Promise<ActionResult> {
  return guarded("scrabble.round.status", "tournaments.manage", roundStatusSchema, input, (data) =>
    scrabble.setRoundStatus(data.roundId, data.status),
  );
}

export async function deleteRoundAction(input: { roundId: string }): Promise<ActionResult> {
  return guarded("scrabble.round.delete", "tournaments.manage", roundIdSchema, input, (data) =>
    scrabble.deleteRound(data.roundId),
  );
}

export async function createMatchAction(
  input: CreateMatchInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded("scrabble.match.create", "tournaments.manage", createMatchSchema, input, (data) =>
    scrabble.createMatch(data),
  );
}

export async function deleteMatchAction(input: { matchId: string }): Promise<ActionResult> {
  return guarded("scrabble.match.delete", "tournaments.manage", matchIdSchema, input, (data) =>
    scrabble.deleteMatch(data.matchId),
  );
}

// --- Scores ---

export async function saveScoresAction(
  input: SaveScoresInput,
): Promise<ActionResult<{ saved: number; removed: number }>> {
  return guarded("scrabble.scores", "scores.enter", saveScoresSchema, input, (data, actorId) =>
    scrabble.saveScores(data, actorId),
  );
}

// --- Résultats ---

export async function validateResultsAction(input: {
  tournamentId: string;
}): Promise<ActionResult<{ winners: scrabble.WinnerAward[]; badges: Record<string, string[]> }>> {
  return guarded(
    "scrabble.validate",
    "results.publish",
    tournamentIdSchema,
    input,
    (data, actorId) => scrabble.validateResults(data.tournamentId, actorId),
  );
}

export async function invalidateResultsAction(input: {
  tournamentId: string;
  reason: string;
}): Promise<ActionResult<{ reversed: number }>> {
  return guarded(
    "scrabble.invalidate",
    "results.publish",
    invalidateResultsSchema,
    input,
    (data, actorId) => scrabble.invalidateResults(data.tournamentId, actorId, data.reason),
  );
}

export async function publishResultsAction(input: {
  tournamentId: string;
}): Promise<ActionResult<{ notified: number; emailed: number }>> {
  return guarded(
    "scrabble.publish",
    "results.publish",
    tournamentIdSchema,
    input,
    (data, actorId) => scrabble.publishResults(data.tournamentId, actorId),
  );
}

// --- Records ---

export async function createRecordAction(
  input: RecordInput,
): Promise<ActionResult<{ id: string }>> {
  return guarded(
    "scrabble.record.create",
    "tournaments.manage",
    recordSchema,
    input,
    (data, actorId) => scrabble.createRecord(data, actorId),
  );
}

export async function updateRecordAction(input: {
  id: string;
  record: RecordInput;
}): Promise<ActionResult> {
  return guarded(
    "scrabble.record.update",
    "tournaments.manage",
    updateRecordSchema,
    input,
    (data, actorId) => scrabble.updateRecord(data.id, data.record, actorId),
  );
}

export async function replaceRecordAction(input: {
  id: string;
  record: RecordInput;
}): Promise<ActionResult<{ id: string }>> {
  return guarded(
    "scrabble.record.replace",
    "tournaments.manage",
    replaceRecordSchema,
    input,
    (data, actorId) => scrabble.replaceRecord(data.id, data.record, actorId),
  );
}

export async function deleteRecordAction(input: { id: string }): Promise<ActionResult> {
  return guarded(
    "scrabble.record.delete",
    "tournaments.manage",
    recordIdSchema,
    input,
    (data, actorId) => scrabble.deleteRecord(data.id, actorId),
  );
}

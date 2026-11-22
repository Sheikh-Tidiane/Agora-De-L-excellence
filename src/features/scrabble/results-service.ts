import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { evaluateBadges } from "@/features/gamification/badges-service";
import {
  awardForSource,
  memberStatus,
  reverseInTx,
  runInTransaction,
  skipped,
  type AwardResult,
  type Tx,
} from "@/features/gamification/ledger";
import { RULE_CODES } from "@/features/gamification/rules";
import { createNotifications, sendNotificationEmails } from "@/features/notifications/service";
import { assertNotValidated, lockTournament } from "@/features/scrabble/guards";
import { winnersOf } from "@/features/scrabble/ranking";
import { placeLabel, tournamentPublicPath } from "@/features/scrabble/rules";
import { loadTournamentSheet } from "@/features/scrabble/standings";

/**
 * Validation, dévalidation et publication des résultats (permission `results.publish`).
 * - Valider fige `finalRank` (rang individuel, ou rang de l'équipe en format « équipes »), passe le
 *   tournoi à « terminé » et paie la règle `tournament_win` à chaque membre vainqueur (ex æquo :
 *   chacun ; extérieur : rien ; le responsable qui valide sa propre victoire : rien).
 * - Dévalider (motif obligatoire) reprend ces points par lignes inverses, efface les rangs et la
 *   publication. Les badges déjà obtenus restent (règle du moteur).
 * - Publier rend les résultats publics et prévient chaque membre participant (in-app + e-mail).
 */
export type WinnerAward = { participantId: string; userId: string | null; result: AwardResult };

async function payWinner(
  tx: Tx,
  userId: string,
  tournamentId: string,
  actorId: string,
): Promise<AwardResult> {
  if ((await memberStatus(tx, userId)) !== "member") return skipped("not_member");
  const rule = await tx.pointRule.findUnique({
    where: { code: RULE_CODES.tournamentWin },
    select: { id: true, code: true, label: true, points: true, isActive: true },
  });
  if (!rule) return skipped("no_rule");
  if (!rule.isActive) return skipped("inactive_rule");
  if (rule.points <= 0) return skipped("zero_points");
  if (userId === actorId) return skipped("self_award");
  return awardForSource(tx, {
    userId,
    rule,
    sourceType: "TOURNAMENT",
    sourceId: tournamentId,
    actorId,
  });
}

export async function validateResults(
  tournamentId: string,
  actorId: string,
  db: Db = prisma,
): Promise<{ winners: WinnerAward[]; badges: Record<string, string[]> }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    assertNotValidated(tournament);
    if (tournament.status !== "IN_PROGRESS" && tournament.status !== "COMPLETED") {
      throw new AppError("CONFLICT", "Seul un tournoi en cours ou terminé peut être validé.");
    }
    const sheet = await loadTournamentSheet(tx, tournament);
    if (sheet.rounds.length === 0) throw new AppError("CONFLICT", "Aucune manche n'a été jouée.");
    if (sheet.missingScores > 0) {
      throw new AppError(
        "CONFLICT",
        `Saisie incomplète : ${sheet.missingScores} score(s) manquant(s).`,
      );
    }
    const teams = tournament.format === "TEAMS";
    if (teams && sheet.participants.some((p) => !p.withdrawnAt && !p.teamId)) {
      throw new AppError("CONFLICT", "Chaque joueur doit appartenir à une équipe.");
    }
    if (!sheet.ranking.standings.some((s) => s.rank !== null)) {
      throw new AppError("CONFLICT", "Aucun joueur n'est classé.");
    }
    const teamRank = new Map(sheet.ranking.teams.map((t) => [t.teamId, t.rank]));
    for (const standing of sheet.ranking.standings) {
      const finalRank = teams
        ? standing.teamId
          ? (teamRank.get(standing.teamId) ?? null)
          : null
        : standing.rank;
      await tx.tournamentParticipant.update({
        where: { id: standing.participantId },
        data: { finalRank },
      });
    }
    const now = new Date();
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { status: "COMPLETED", resultsValidatedAt: now, resultsValidatedById: actorId },
    });
    const byId = new Map(sheet.participants.map((p) => [p.id, p]));
    const winners: WinnerAward[] = [];
    for (const participantId of winnersOf(sheet.ranking, { teams })) {
      const userId = byId.get(participantId)?.userId ?? null;
      const result = userId ? await payWinner(tx, userId, tournamentId, actorId) : skipped("guest");
      winners.push({ participantId, userId, result });
    }
    // Tournoi joué, victoire : les badges se réévaluent pour chaque membre participant.
    const badges: Record<string, string[]> = {};
    for (const userId of new Set(sheet.participants.flatMap((p) => (p.userId ? [p.userId] : [])))) {
      const earned = await evaluateBadges(userId, tx);
      if (earned.length > 0) badges[userId] = earned;
    }
    await audit(
      {
        actorId,
        action: "scrabble.results_validated",
        entityType: "Tournament",
        entityId: tournamentId,
        metadata: {
          ranks: sheet.ranking.standings.map((s) => ({
            participantId: s.participantId,
            rank: s.rank,
          })),
          winners: winners.map((w) => ({
            participantId: w.participantId,
            status: w.result.status,
            reason: w.result.reason,
          })),
        },
      },
      tx,
    );
    return { winners, badges };
  });
}

export async function invalidateResults(
  tournamentId: string,
  actorId: string,
  reason: string,
  db: Db = prisma,
): Promise<{ reversed: number }> {
  return runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament.resultsValidatedAt)
      throw new AppError("CONFLICT", "Les résultats ne sont pas validés.");
    const active = await tx.pointTransaction.findMany({
      where: {
        sourceType: "TOURNAMENT",
        sourceId: tournamentId,
        points: { gt: 0 },
        reversedBy: { is: null },
      },
      select: { id: true },
    });
    for (const line of active) {
      await reverseInTx(tx, line.id, actorId, `Résultats dévalidés : ${reason}`, {
        forbidSelf: false,
      });
    }
    await tx.tournamentParticipant.updateMany({
      where: { tournamentId },
      data: { finalRank: null },
    });
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { resultsValidatedAt: null, resultsValidatedById: null, resultsPublishedAt: null },
    });
    await audit(
      {
        actorId,
        action: "scrabble.results_invalidated",
        entityType: "Tournament",
        entityId: tournamentId,
        metadata: {
          reason,
          reversed: active.length,
          wasPublished: tournament.resultsPublishedAt !== null,
        },
      },
      tx,
    );
    return { reversed: active.length };
  });
}

/** Publication : visible du public, notification (et e-mail) à chaque membre participant. */
export async function publishResults(
  tournamentId: string,
  actorId: string,
  db: Db = prisma,
): Promise<{ notified: number; emailed: number }> {
  const { ids } = await runInTransaction(db, async (tx) => {
    const tournament = await lockTournament(tx, tournamentId);
    if (!tournament.resultsValidatedAt)
      throw new AppError("CONFLICT", "Validez les résultats avant de les publier.");
    if (tournament.resultsPublishedAt)
      throw new AppError("CONFLICT", "Les résultats sont déjà publiés.");
    await tx.tournament.update({
      where: { id: tournamentId },
      data: { resultsPublishedAt: new Date() },
    });
    const players = await tx.tournamentParticipant.findMany({
      where: { tournamentId, userId: { not: null } },
      select: { userId: true, finalRank: true },
    });
    const ranked = await tx.tournamentParticipant.count({
      where: { tournamentId, finalRank: { not: null } },
    });
    const teams = tournament.format === "TEAMS";
    const ids = await createNotifications(
      players.map((p) => ({
        userId: p.userId!,
        type: "tournament.results" as const,
        title: `Résultats publiés : ${tournament.name}`,
        body:
          p.finalRank === null
            ? "Les résultats du tournoi sont en ligne."
            : `${teams ? "Votre équipe termine" : "Vous terminez"} ${placeLabel(p.finalRank)}${teams ? "" : ` sur ${ranked}`}. Les résultats complets sont en ligne.`,
        href: tournamentPublicPath(tournament.slug),
      })),
      tx,
    );
    await audit(
      {
        actorId,
        action: "scrabble.results_published",
        entityType: "Tournament",
        entityId: tournamentId,
        metadata: { notified: ids.length },
      },
      tx,
    );
    return { ids };
  });
  // Hors transaction : un e-mail qui ne part pas n'annule pas la publication.
  const emailed = await sendNotificationEmails(ids);
  return { notified: ids.length, emailed };
}

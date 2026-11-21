import { describe, expect, it, vi } from "vitest";
import { databaseReachable, inRollback, realPrisma, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn(async () => undefined) }));

const svc = await import("@/features/scrabble/service");
const { readPublicTournament, readPalmares } = await import("@/features/scrabble/public-read");
const { readMemberTournamentHistory, readAdminTournament } =
  await import("@/features/scrabble/admin-read");
const { clearDemoData } = await import("@/lib/demo-data");

/**
 * Services du Scrabble contre la vraie base, chaque test dans une transaction annulée : aucune
 * donnée ne reste, et rien d'autre n'est touché (les autres tests tournent sur la même base).
 */
type Tx = Parameters<Parameters<typeof realPrisma.$transaction>[0]>[0];
const reachable = await databaseReachable();

async function member(tx: Tx, extra: { firstName?: string; hidden?: boolean } = {}) {
  const u = uniq();
  return tx.user.create({
    data: {
      name: `Test ${u}`,
      firstName: extra.firstName ?? "Test",
      lastName: `Joueur${u}`,
      email: `vitest-scr-${u}@test.localhost`,
      status: "ACTIVE",
      memberNumber: `VS-${u}`,
      hiddenFromRankings: extra.hidden ?? false,
      isDemo: true,
    },
  });
}

async function staff(tx: Tx) {
  const u = uniq();
  return tx.user.create({
    data: {
      name: "Resp",
      firstName: "Resp",
      lastName: u,
      email: `vitest-scr-staff-${u}@test.localhost`,
      status: "ACTIVE",
      isDemo: true,
    },
  });
}

async function tournament(
  tx: Tx,
  actorId: string,
  opts: { classic?: boolean; teams?: boolean; eventId?: string | null } = {},
) {
  const { id, slug } = await svc.createTournament(
    {
      name: `Tournoi test ${uniq()}`,
      description: null,
      rules: null,
      format: opts.teams ? "TEAMS" : "INDIVIDUAL",
      gameMode: opts.classic ? "CLASSIC" : "DUPLICATE",
      rankingRule: opts.classic ? "WINS_SCORE_SPREAD" : "CUMULATIVE_SCORE",
      isInterclub: false,
      countsForMonthly: true,
      location: null,
      reward: null,
      startsAt: new Date(),
      endsAt: null,
      eventId: opts.eventId ?? null,
    },
    actorId,
    tx,
  );
  await svc.setTournamentStatus(id, "IN_PROGRESS", actorId, tx);
  return { id, slug };
}

const add = (
  tx: Tx,
  tournamentId: string,
  who: { userId?: string; external?: string; teamId?: string },
) =>
  svc.addParticipant(
    {
      tournamentId,
      userId: who.userId ?? null,
      externalName: who.external ?? null,
      externalClub: who.external ? "Club de Thiès" : null,
      teamId: who.teamId ?? null,
    },
    tx,
  );

const winLines = (tx: Tx, tournamentId: string) =>
  tx.pointTransaction.findMany({ where: { sourceType: "TOURNAMENT", sourceId: tournamentId } });

describe.skipIf(!reachable)("Scrabble (base réelle, transaction annulée)", () => {
  it("duplicate : validation → rangs figés, 50 points et badge au vainqueur membre, rien à l'extérieur", async () => {
    await inRollback(async (tx) => {
      const [actor, awa, ibou] = [await staff(tx), await member(tx), await member(tx)];
      const t = await tournament(tx, actor.id);
      const pa = await add(tx, t.id, { userId: awa.id });
      const pb = await add(tx, t.id, { userId: ibou.id });
      const px = await add(tx, t.id, { external: "Moussa Ndiaye" });
      const r1 = await svc.createRound(t.id, tx);
      await svc.saveScores(
        {
          roundId: r1.id,
          entries: [
            { participantId: pa.id, points: 450, isForfeit: false },
            { participantId: pb.id, points: 300, isForfeit: false },
            { participantId: px.id, points: 400, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      const result = await svc.validateResults(t.id, actor.id, tx);
      expect(result.winners).toHaveLength(1);
      expect(result.winners[0].result).toMatchObject({ status: "awarded", points: 50 });
      const ranks = await tx.tournamentParticipant.findMany({
        where: { tournamentId: t.id },
        select: { id: true, finalRank: true },
      });
      expect(Object.fromEntries(ranks.map((r) => [r.id, r.finalRank]))).toEqual({
        [pa.id]: 1,
        [px.id]: 2,
        [pb.id]: 3,
      });
      const lines = await winLines(tx, t.id);
      expect(lines.map((l) => [l.userId, l.points])).toEqual([[awa.id, 50]]);
      expect(result.badges[awa.id]).toContain("maitre_des_lettres");
      const row = await tx.tournament.findUniqueOrThrow({ where: { id: t.id } });
      expect(row).toMatchObject({ status: "COMPLETED", resultsValidatedById: actor.id });
      expect(
        await tx.auditLog.count({
          where: { action: "scrabble.results_validated", entityId: t.id },
        }),
      ).toBe(1);
      expect(
        await tx.auditLog.count({ where: { action: "scrabble.scores_saved", entityId: r1.id } }),
      ).toBe(1);
    });
  });

  it("ex æquo : chacun des vainqueurs reçoit les points ; extérieur vainqueur : rien", async () => {
    await inRollback(async (tx) => {
      const [actor, a, b] = [await staff(tx), await member(tx), await member(tx)];
      const t = await tournament(tx, actor.id);
      const pa = await add(tx, t.id, { userId: a.id });
      const pb = await add(tx, t.id, { userId: b.id });
      const r1 = await svc.createRound(t.id, tx);
      await svc.saveScores(
        {
          roundId: r1.id,
          entries: [
            { participantId: pa.id, points: 400, isForfeit: false },
            { participantId: pb.id, points: 400, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      await svc.validateResults(t.id, actor.id, tx);
      expect((await winLines(tx, t.id)).map((l) => l.userId).sort()).toEqual([a.id, b.id].sort());

      const t2 = await tournament(tx, actor.id);
      const q1 = await add(tx, t2.id, { userId: a.id });
      const qx = await add(tx, t2.id, { external: "Fatou Sarr" });
      const r = await svc.createRound(t2.id, tx);
      await svc.saveScores(
        {
          roundId: r.id,
          entries: [
            { participantId: q1.id, points: 100, isForfeit: false },
            { participantId: qx.id, points: 500, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      const res = await svc.validateResults(t2.id, actor.id, tx);
      expect(res.winners.map((w) => w.result.reason)).toEqual(["guest"]);
      expect(await winLines(tx, t2.id)).toHaveLength(0);
    });
  });

  it("le responsable qui valide sa propre victoire ne reçoit rien", async () => {
    await inRollback(async (tx) => {
      const actor = await member(tx);
      const t = await tournament(tx, actor.id);
      const p = await add(tx, t.id, { userId: actor.id });
      const r = await svc.createRound(t.id, tx);
      await svc.saveScores(
        { roundId: r.id, entries: [{ participantId: p.id, points: 200, isForfeit: false }] },
        actor.id,
        tx,
      );
      const res = await svc.validateResults(t.id, actor.id, tx);
      expect(res.winners[0].result.reason).toBe("self_award");
    });
  });

  it("après validation, la saisie est refusée ; la dévalidation reprend les points ; la revalidation les rend", async () => {
    await inRollback(async (tx) => {
      const [actor, a, b] = [await staff(tx), await member(tx), await member(tx)];
      const t = await tournament(tx, actor.id);
      const pa = await add(tx, t.id, { userId: a.id });
      const pb = await add(tx, t.id, { userId: b.id });
      const r = await svc.createRound(t.id, tx);
      await svc.saveScores(
        {
          roundId: r.id,
          entries: [
            { participantId: pa.id, points: 500, isForfeit: false },
            { participantId: pb.id, points: 300, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      await svc.validateResults(t.id, actor.id, tx);
      await expect(
        svc.saveScores(
          { roundId: r.id, entries: [{ participantId: pb.id, points: 600, isForfeit: false }] },
          actor.id,
          tx,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });

      expect(await svc.invalidateResults(t.id, actor.id, "Score de B mal saisi", tx)).toEqual({
        reversed: 1,
      });
      const after = await tx.pointTransaction.aggregate({
        where: { userId: a.id },
        _sum: { points: true },
      });
      expect(after._sum.points).toBe(0);
      expect(
        await tx.tournamentParticipant.count({
          where: { tournamentId: t.id, finalRank: { not: null } },
        }),
      ).toBe(0);
      await svc.saveScores(
        { roundId: r.id, entries: [{ participantId: pb.id, points: 600, isForfeit: false }] },
        actor.id,
        tx,
      );
      const again = await svc.validateResults(t.id, actor.id, tx);
      expect(again.winners.map((w) => w.userId)).toEqual([b.id]);
      const totals = await tx.pointTransaction.groupBy({
        by: ["userId"],
        where: { userId: { in: [a.id, b.id] } },
        _sum: { points: true },
      });
      expect(Object.fromEntries(totals.map((x) => [x.userId, x._sum.points]))).toEqual({
        [a.id]: 0,
        [b.id]: 50,
      });
      expect(
        await tx.auditLog.count({
          where: { action: "scrabble.results_invalidated", entityId: t.id },
        }),
      ).toBe(1);
    });
  });

  it("validation refusée : score manquant, tournoi sans manche", async () => {
    await inRollback(async (tx) => {
      const [actor, a, b] = [await staff(tx), await member(tx), await member(tx)];
      const t = await tournament(tx, actor.id);
      const pa = await add(tx, t.id, { userId: a.id });
      await add(tx, t.id, { userId: b.id });
      await expect(svc.validateResults(t.id, actor.id, tx)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      const r = await svc.createRound(t.id, tx);
      await svc.saveScores(
        { roundId: r.id, entries: [{ participantId: pa.id, points: 200, isForfeit: false }] },
        actor.id,
        tx,
      );
      await expect(svc.validateResults(t.id, actor.id, tx)).rejects.toThrow(/1 score/);
    });
  });

  it("classique : appariement obligatoire, forfait, partie jouée", async () => {
    await inRollback(async (tx) => {
      const [actor, a, b, c] = [
        await staff(tx),
        await member(tx),
        await member(tx),
        await member(tx),
      ];
      const t = await tournament(tx, actor.id, { classic: true });
      const [pa, pb, pc] = [
        await add(tx, t.id, { userId: a.id }),
        await add(tx, t.id, { userId: b.id }),
        await add(tx, t.id, { userId: c.id }),
      ];
      const r = await svc.createRound(t.id, tx);
      await expect(
        svc.saveScores(
          { roundId: r.id, entries: [{ participantId: pc.id, points: 1, isForfeit: false }] },
          actor.id,
          tx,
        ),
      ).rejects.toThrow(/appariez/);
      const m = await svc.createMatch(
        { roundId: r.id, participantAId: pa.id, participantBId: pb.id, tableNumber: 1 },
        tx,
      );
      await expect(
        svc.createMatch(
          { roundId: r.id, participantAId: pb.id, participantBId: pc.id, tableNumber: 2 },
          tx,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await svc.saveScores(
        {
          roundId: r.id,
          entries: [
            { participantId: pa.id, points: 0, isForfeit: true },
            { participantId: pb.id, points: 320, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      expect((await tx.match.findUniqueOrThrow({ where: { id: m.id } })).status).toBe("FORFEIT");
      await svc.setParticipantWithdrawn(pc.id, true, tx);
      const res = await svc.validateResults(t.id, actor.id, tx);
      expect(res.winners.map((w) => w.userId)).toEqual([b.id]);
      // `pnpm db:clear-demo` retire un tournoi de démonstration malgré ses parties (`Restrict`).
      await tx.tournament.update({ where: { id: t.id }, data: { isDemo: true } });
      const client = {
        $transaction: (fn: (inner: Tx) => unknown) => fn(tx),
      } as unknown as typeof realPrisma;
      await clearDemoData(client);
      expect(await tx.tournament.count({ where: { id: t.id } })).toBe(0);
      expect(await tx.match.count({ where: { id: m.id } })).toBe(0);
    });
  });

  it("équipes : chaque membre non retiré de l'équipe gagnante reçoit les points", async () => {
    await inRollback(async (tx) => {
      const [actor, a1, a2, b1] = [
        await staff(tx),
        await member(tx),
        await member(tx),
        await member(tx),
      ];
      const t = await tournament(tx, actor.id, { teams: true });
      const ta = await svc.createTeam({ tournamentId: t.id, name: "Les Baobabs" }, tx);
      const tb = await svc.createTeam({ tournamentId: t.id, name: "Les Fromagers" }, tx);
      await expect(
        svc.createTeam({ tournamentId: t.id, name: "les baobabs" }, tx),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const p1 = await add(tx, t.id, { userId: a1.id, teamId: ta.id });
      const p2 = await add(tx, t.id, { userId: a2.id, teamId: ta.id });
      const p3 = await add(tx, t.id, { userId: b1.id, teamId: tb.id });
      const r = await svc.createRound(t.id, tx);
      await svc.saveScores(
        {
          roundId: r.id,
          entries: [
            { participantId: p1.id, points: 300, isForfeit: false },
            { participantId: p2.id, points: 300, isForfeit: false },
            { participantId: p3.id, points: 500, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      await svc.validateResults(t.id, actor.id, tx);
      expect((await winLines(tx, t.id)).map((l) => l.userId).sort()).toEqual([a1.id, a2.id].sort());
      const ranks = await tx.tournamentParticipant.findMany({
        where: { tournamentId: t.id },
        select: { userId: true, finalRank: true },
      });
      expect(Object.fromEntries(ranks.map((x) => [x.userId, x.finalRank]))).toEqual({
        [a1.id]: 1,
        [a2.id]: 1,
        [b1.id]: 2,
      });
    });
  });

  it("joueurs : pas de doublon, membre actif seulement, inscription à la rencontre liée", async () => {
    await inRollback(async (tx) => {
      const [actor, a] = [await staff(tx), await member(tx)];
      const event = await tx.event.create({
        data: {
          slug: `vs-${uniq()}`,
          title: "Tournoi",
          type: "TOURNOI_SCRABBLE",
          description: "Test",
          startsAt: new Date(),
          status: "PUBLISHED",
          isDemo: true,
        },
      });
      await expect(tournament(tx, actor.id, { eventId: event.id })).resolves.toBeTruthy();
      const t = await tx.tournament.findFirstOrThrow({ where: { eventId: event.id } });
      const res = await add(tx, t.id, { userId: a.id });
      expect(res.eventRegistered).toBe(true);
      expect(
        await tx.eventRegistration.count({
          where: { eventId: event.id, userId: a.id, status: "CONFIRMED" },
        }),
      ).toBe(1);
      await expect(add(tx, t.id, { userId: a.id })).rejects.toMatchObject({ code: "CONFLICT" });
      await add(tx, t.id, { external: "Awa Fall" });
      await expect(add(tx, t.id, { external: "awa fall" })).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(add(tx, t.id, { userId: actor.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });

  it("publication : refusée avant validation ; notifie chaque membre ; public, palmarès, historique, mensuel", async () => {
    await inRollback(async (tx) => {
      const [actor, a, hidden] = [
        await staff(tx),
        await member(tx, { firstName: "Awa" }),
        await member(tx, { hidden: true }),
      ];
      const t = await tournament(tx, actor.id);
      const pa = await add(tx, t.id, { userId: a.id });
      const ph = await add(tx, t.id, { userId: hidden.id });
      const px = await add(tx, t.id, { external: "Moussa Ndiaye" });
      const r = await svc.createRound(t.id, tx);
      await svc.saveScores(
        {
          roundId: r.id,
          entries: [
            { participantId: pa.id, points: 500, isForfeit: false },
            { participantId: ph.id, points: 400, isForfeit: false },
            { participantId: px.id, points: 300, isForfeit: false },
          ],
        },
        actor.id,
        tx,
      );
      await expect(svc.publishResults(t.id, actor.id, tx)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await svc.validateResults(t.id, actor.id, tx);
      expect((await readPublicTournament(t.slug, tx))?.results).toBeNull();
      const published = await svc.publishResults(t.id, actor.id, tx);
      expect(published.notified).toBe(2);
      const notes = await tx.notification.findMany({
        where: { userId: { in: [a.id, hidden.id] }, type: "tournament.results" },
      });
      expect(notes).toHaveLength(2);
      expect(notes.find((n) => n.userId === a.id)?.body).toContain("1re place sur 3");

      const page = await readPublicTournament(t.slug, tx);
      expect(page?.results?.standings.map((s) => [s.name.startsWith("Awa "), s.rank])).toEqual([
        [true, 1],
        [false, 2],
        [false, 3],
      ]);
      expect(page?.results?.standings[1].name).toBe("Membre de l’Agora");
      expect(page?.results?.standings[2]).toMatchObject({
        name: "Moussa Ndiaye",
        club: "Club de Thiès",
        isExternal: true,
      });
      expect((await readPalmares(tx)).find((e) => e.slug === t.slug)?.winners[0].name).toMatch(
        /^Awa /,
      );
      expect(await readMemberTournamentHistory(a.id, tx)).toEqual([
        expect.objectContaining({
          slug: t.slug,
          finalRank: 1,
          rankedCount: 3,
          resultsPublished: true,
        }),
      ]);
      const monthly = await svc.getMonthlyScrabbleRanking(
        { now: new Date(), viewerId: hidden.id },
        tx,
      );
      expect(monthly.top.find((row) => row.userId === a.id)).toMatchObject({
        points: 3,
        tournaments: 1,
      });
      expect(monthly.top.some((row) => row.userId === hidden.id)).toBe(false);
      expect(monthly.viewer).toEqual({ rank: null, points: 2, hidden: true });
      await expect(svc.publishResults(t.id, actor.id, tx)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect((await readAdminTournament(t.id, tx))?.canValidate).toBe(false);
    });
  });

  it("records : création, remplacement (l'ancien reste, marqué battu), suppression tracée", async () => {
    await inRollback(async (tx) => {
      const actor = await staff(tx);
      const category = `Meilleur score ${uniq()}`;
      const base = {
        category,
        value: "480 points",
        userId: null,
        holderName: "Moussa Ndiaye",
        tournamentId: null,
        achievedAt: null,
        position: 0,
      };
      const first = await svc.createRecord(base, actor.id, tx);
      const second = await svc.replaceRecord(
        first.id,
        { ...base, value: "512 points", holderName: "Fatou Sarr" },
        actor.id,
        tx,
      );
      const rows = await tx.scrabbleRecord.findMany({
        where: { category },
        orderBy: { createdAt: "asc" },
      });
      expect(rows.map((r) => [r.value, r.supersededAt !== null])).toEqual([
        ["480 points", true],
        ["512 points", false],
      ]);
      await expect(svc.replaceRecord(first.id, base, actor.id, tx)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await svc.deleteRecord(second.id, actor.id, tx);
      expect(
        await tx.auditLog.count({
          where: { action: "scrabble.record_deleted", entityId: second.id },
        }),
      ).toBe(1);
    });
  });
});

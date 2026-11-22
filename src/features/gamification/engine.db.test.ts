import { describe, expect, it, vi } from "vitest";
import type { EventType } from "@/generated/prisma/client";
import { databaseReachable, inRollback, realPrisma, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const {
  awardAttendancePoints,
  awardManualBadge,
  awardReadingPoints,
  awardReviewPoints,
  evaluateBadges,
  getMemberRewards,
  getPointRankings,
  grantManualPoints,
  reversePointTransaction,
  revokeAttendancePoints,
  updatePointRule,
} = await import("@/features/gamification/service");
const { listMemberTransactions, memberPointsTotal } =
  await import("@/features/gamification/rewards-service");

/**
 * Moteur de points et badges contre une vraie base PostgreSQL, chaque test dans une transaction
 * annulée à la fin : contrainte unique, `ON CONFLICT`, verrous et agrégats sont les vrais.
 */
type Tx = Parameters<Parameters<typeof realPrisma.$transaction>[0]>[0];
const reachable = await databaseReachable();

async function member(
  tx: Tx,
  extra: {
    firstName?: string;
    lastName?: string;
    hidden?: boolean;
    status?: "ACTIVE" | "SUSPENDED";
  } = {},
) {
  const u = uniq();
  return tx.user.create({
    data: {
      name: `${extra.firstName ?? "Test"} ${extra.lastName ?? u}`,
      firstName: extra.firstName ?? "Test",
      lastName: extra.lastName ?? `Membre${u}`,
      email: `vitest-${u}@test.localhost`,
      status: extra.status ?? "ACTIVE",
      memberNumber: `VT-${u}`,
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
      email: `vitest-staff-${u}@test.localhost`,
      status: "ACTIVE",
      isDemo: true,
    },
  });
}

async function attended(tx: Tx, userId: string | null, type: EventType = "DEBAT_IDEES") {
  const u = uniq();
  const event = await tx.event.create({
    data: {
      slug: `vt-${u}`,
      title: `Rencontre ${u}`,
      type,
      description: "Test",
      startsAt: new Date(),
      status: "PUBLISHED",
      isDemo: true,
    },
  });
  return tx.eventRegistration.create({
    data: userId
      ? {
          eventId: event.id,
          userId,
          status: "CONFIRMED",
          attendedAt: new Date(),
          checkInMethod: "MANUAL",
        }
      : {
          eventId: event.id,
          guestName: "Invité",
          guestEmail: `g-${u}@test.localhost`,
          status: "CONFIRMED",
          attendedAt: new Date(),
          checkInMethod: "MANUAL",
        },
  });
}

async function book(tx: Tx) {
  const u = uniq();
  const category = await tx.category.create({ data: { name: `Cat ${u}`, slug: `cat-${u}` } });
  return tx.book.create({
    data: {
      slug: `b-${u}`,
      title: `Livre ${u}`,
      summary: "R",
      categoryId: category.id,
      isDemo: true,
    },
  });
}

const total = async (tx: Tx, userId: string) =>
  (await tx.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } }))._sum
    .points ?? 0;

describe.skipIf(!reachable)("moteur de points (base réelle, transaction annulée)", () => {
  it("présence : points du type d'événement, une seule fois (idempotent), tracée", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      const reg = await attended(tx, m.id, "DEBAT_IDEES");
      const first = await awardAttendancePoints(reg.id, actor.id, tx);
      expect(first).toMatchObject({ status: "awarded", points: 15 });
      const second = await awardAttendancePoints(reg.id, actor.id, tx);
      expect(second).toMatchObject({
        status: "already_awarded",
        transactionId: first.transactionId,
      });
      expect(await total(tx, m.id)).toBe(15);
      expect(
        await tx.auditLog.count({
          where: { action: "points.awarded", entityId: first.transactionId },
        }),
      ).toBe(1);
    });
  });

  it("la contrainte unique de la base refuse le doublon, sans casser la transaction", async () => {
    await inRollback(async (tx) => {
      const m = await member(tx);
      const reg = await attended(tx, m.id, "DEBAT_IDEES");
      const rule = await tx.pointRule.findUniqueOrThrow({ where: { code: "debate" } });
      const row = {
        userId: m.id,
        ruleId: rule.id,
        points: 15,
        sourceType: "EVENT_ATTENDANCE" as const,
        sourceId: reg.id,
      };
      expect(
        (await tx.pointTransaction.createMany({ data: [row], skipDuplicates: true })).count,
      ).toBe(1);
      expect(
        (await tx.pointTransaction.createMany({ data: [row], skipDuplicates: true })).count,
      ).toBe(0);
      expect(await awardAttendancePoints(reg.id, null, tx)).toMatchObject({
        status: "already_awarded",
      });
      expect(await total(tx, m.id)).toBe(15);
    });
  });

  it("invité, type sans règle, règle inactive ou bénéficiaire = responsable : aucun point", async () => {
    await inRollback(async (tx) => {
      const m = await member(tx);
      expect(await awardAttendancePoints((await attended(tx, null)).id, null, tx)).toMatchObject({
        status: "skipped",
        reason: "guest",
      });
      const noRule = await attended(tx, m.id, "AGORA_CINE");
      expect(await awardAttendancePoints(noRule.id, null, tx)).toMatchObject({ reason: "no_rule" });
      const rule = await tx.pointRule.findUniqueOrThrow({ where: { code: "debate" } });
      await tx.pointRule.update({ where: { id: rule.id }, data: { isActive: false } });
      expect(await awardAttendancePoints((await attended(tx, m.id)).id, null, tx)).toMatchObject({
        reason: "inactive_rule",
      });
      await tx.pointRule.update({ where: { id: rule.id }, data: { isActive: true } });
      expect(await awardAttendancePoints((await attended(tx, m.id)).id, m.id, tx)).toMatchObject({
        reason: "self_award",
      });
      expect(await total(tx, m.id)).toBe(0);
    });
  });

  it("présence décochée : ligne inverse ; recochée : nouvelle attribution ; jamais deux actives", async () => {
    await inRollback(async (tx) => {
      const m = await member(tx);
      const reg = await attended(tx, m.id, "RENDEZ_VOUS_LECTURE");
      await awardAttendancePoints(reg.id, null, tx);
      expect(await revokeAttendancePoints(reg.id, null, "Présence décochée", tx)).toEqual({
        reversed: 1,
      });
      expect(await revokeAttendancePoints(reg.id, null, "Présence décochée", tx)).toEqual({
        reversed: 0,
      });
      expect(await total(tx, m.id)).toBe(0);
      expect(await awardAttendancePoints(reg.id, null, tx)).toMatchObject({
        status: "awarded",
        points: 20,
      });
      expect(await awardAttendancePoints(reg.id, null, tx)).toMatchObject({
        status: "already_awarded",
      });
      expect(await total(tx, m.id)).toBe(20);
    });
  });

  it("corrections : une seule inverse par ligne, jamais l'inverse d'une inverse, jamais sur soi", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      const reg = await attended(tx, m.id);
      const { transactionId } = await awardAttendancePoints(reg.id, actor.id, tx);
      const reversal = await reversePointTransaction(
        transactionId!,
        actor.id,
        "Erreur de pointage",
        tx,
      );
      expect(reversal.points).toBe(-15);
      await expect(reversePointTransaction(transactionId!, actor.id, "Encore", tx)).rejects.toThrow(
        /déjà été corrigée/,
      );
      await expect(reversePointTransaction(reversal.id, actor.id, "Annuler", tx)).rejects.toThrow(
        /ne se corrige pas/,
      );
      await expect(reversePointTransaction(transactionId!, actor.id, "", tx)).rejects.toMatchObject(
        { code: "VALIDATION" },
      );
      const own = await member(tx);
      const grant = await grantManualPoints(
        { userId: own.id, points: -10, reason: "Retard" },
        actor.id,
        tx,
      );
      await expect(
        reversePointTransaction(grant.id, own.id, "Je corrige", tx),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        await tx.auditLog.count({ where: { action: "points.reversed", entityId: reversal.id } }),
      ).toBe(1);
    });
  });

  it("ajustement manuel : motivé, non nul, borné, jamais à soi-même, membre seulement", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      await grantManualPoints(
        { userId: m.id, points: 25, reason: "Animation du débat" },
        actor.id,
        tx,
      );
      await grantManualPoints(
        { userId: m.id, points: 25, reason: "Animation du débat" },
        actor.id,
        tx,
      );
      expect(await total(tx, m.id)).toBe(50);
      for (const points of [0, 1001, -1001, 2.5]) {
        await expect(
          grantManualPoints({ userId: m.id, points, reason: "Motif" }, actor.id, tx),
        ).rejects.toMatchObject({ code: "VALIDATION" });
      }
      await expect(
        grantManualPoints({ userId: m.id, points: 5, reason: " " }, actor.id, tx),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(
        grantManualPoints({ userId: actor.id, points: 5, reason: "Moi" }, actor.id, tx),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        grantManualPoints({ userId: actor.id, points: 5, reason: "Responsable" }, m.id, tx),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("lecture et critique : points après validation seulement, une fois", async () => {
    await inRollback(async (tx) => {
      const [m, actor, b] = [await member(tx), await staff(tx), await book(tx)];
      const reading = await tx.reading.create({
        data: { userId: m.id, bookId: b.id, status: "FINISHED", completionStatus: "PENDING" },
      });
      expect(await awardReadingPoints(reading.id, actor.id, tx)).toMatchObject({
        reason: "not_eligible",
      });
      await tx.reading.update({
        where: { id: reading.id },
        data: { completionStatus: "APPROVED" },
      });
      expect(await awardReadingPoints(reading.id, actor.id, tx)).toMatchObject({
        status: "awarded",
        points: 50,
      });
      expect(await awardReadingPoints(reading.id, actor.id, tx)).toMatchObject({
        status: "already_awarded",
      });
      const review = await tx.review.create({
        data: { userId: m.id, bookId: b.id, rating: 4, content: "Bien.", status: "PENDING" },
      });
      expect(await awardReviewPoints(review.id, actor.id, tx)).toMatchObject({
        reason: "not_eligible",
      });
      await tx.review.update({ where: { id: review.id }, data: { status: "APPROVED" } });
      expect(await awardReviewPoints(review.id, actor.id, tx)).toMatchObject({
        status: "awarded",
        points: 30,
      });
      expect(await total(tx, m.id)).toBe(80);
    });
  });

  it("badges : seuil atteint → attribué une fois, tracé ; jamais retiré par une correction", async () => {
    await inRollback(async (tx) => {
      const m = await member(tx);
      await tx.badge.update({ where: { code: "esprit_debatteur" }, data: { threshold: 2 } });
      const first = await awardAttendancePoints((await attended(tx, m.id)).id, null, tx);
      expect(first.badges).toEqual([]);
      const second = await awardAttendancePoints((await attended(tx, m.id)).id, null, tx);
      expect(second.badges).toEqual(["esprit_debatteur"]);
      expect(await evaluateBadges(m.id, tx)).toEqual([]);
      await reversePointTransaction(second.transactionId!, (await staff(tx)).id, "Erreur", tx);
      expect(await tx.userBadge.count({ where: { userId: m.id } })).toBe(1);
      expect(await tx.auditLog.count({ where: { action: "badge.awarded", entityId: m.id } })).toBe(
        1,
      );
    });
  });

  it("badge manuel « Ambassadeur du savoir » : motif, une fois, pas un badge automatique, pas à soi", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      await awardManualBadge(
        { userId: m.id, badgeCode: "ambassadeur_du_savoir", reason: "Club de lecture au lycée" },
        actor.id,
        tx,
      );
      await expect(
        awardManualBadge(
          { userId: m.id, badgeCode: "ambassadeur_du_savoir", reason: "Encore" },
          actor.id,
          tx,
        ),
      ).rejects.toThrow(/déjà ce badge/);
      await expect(
        awardManualBadge(
          { userId: m.id, badgeCode: "lecteur_passionne", reason: "Raccourci" },
          actor.id,
          tx,
        ),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        awardManualBadge(
          { userId: actor.id, badgeCode: "ambassadeur_du_savoir", reason: "Moi" },
          actor.id,
          tx,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      const held = await tx.userBadge.findFirstOrThrow({ where: { userId: m.id } });
      expect(held).toMatchObject({ awardedById: actor.id, reason: "Club de lecture au lycée" });
    });
  });

  it("récompenses du membre : total, niveau, badges obtenus et à obtenir, historique lisible", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      const reg = await attended(tx, m.id);
      const { transactionId } = await awardAttendancePoints(reg.id, actor.id, tx);
      await grantManualPoints({ userId: m.id, points: 100, reason: "Organisation" }, actor.id, tx);
      await reversePointTransaction(transactionId!, actor.id, "Doublon de pointage", tx);
      const rewards = await getMemberRewards(m.id, tx);
      expect(rewards.total).toBe(100);
      expect(rewards.level.current?.minPoints).toBe(100);
      const debate = rewards.toEarn.find((b) => b.code === "esprit_debatteur");
      expect(debate?.progress).toEqual({ current: 1, threshold: 10, ratio: 0.1 });
      expect(rewards.toEarn.find((b) => b.code === "ambassadeur_du_savoir")).toMatchObject({
        manual: true,
        progress: null,
      });
      expect(rewards.history.map((h) => h.label)).toEqual([
        "Correction : Doublon de pointage",
        "Ajustement : Organisation",
        expect.stringMatching(/^Participer à un débat · Rencontre /),
      ]);
      expect(rewards.history[2]).toMatchObject({ reversed: true, isCorrection: false });
    });
  });

  it("total : tout le grand livre, même au-delà des 200 lignes de l'historique", async () => {
    await inRollback(async (tx) => {
      const m = await member(tx);
      await tx.pointTransaction.createMany({
        data: Array.from({ length: 205 }, (_, i) => ({
          id: `vt-total-${m.id}-${i}`,
          userId: m.id,
          points: 1,
          sourceType: "MANUAL" as const,
          sourceId: `vt-total-${m.id}-${i}`,
          reason: "Test",
        })),
      });
      expect(await listMemberTransactions(m.id, tx)).toHaveLength(200);
      expect(await memberPointsTotal(m.id, tx)).toBe(205);
      expect((await getMemberRewards(m.id, tx)).total).toBe(205);
    });
  });

  it("barème : valeur bornée, changement tracé, sans effet sur le passé", async () => {
    await inRollback(async (tx) => {
      const [m, actor] = [await member(tx), await staff(tx)];
      await awardAttendancePoints((await attended(tx, m.id)).id, null, tx);
      const rule = await tx.pointRule.findUniqueOrThrow({ where: { code: "debate" } });
      expect(
        await updatePointRule({ id: rule.id, points: 40, isActive: true }, actor.id, tx),
      ).toEqual({ changed: true });
      expect(
        await updatePointRule({ id: rule.id, points: 40, isActive: true }, actor.id, tx),
      ).toEqual({ changed: false });
      await expect(
        updatePointRule({ id: rule.id, points: 1001, isActive: true }, actor.id, tx),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      await expect(
        updatePointRule({ id: rule.id, points: -1, isActive: true }, actor.id, tx),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      expect(await total(tx, m.id)).toBe(15);
      expect(
        await tx.auditLog.count({
          where: { action: "points.rule_updated", entityId: rule.id, actorId: actor.id },
        }),
      ).toBe(1);
    });
  });
});

describe.skipIf(!reachable)("classements (base réelle, transaction annulée)", () => {
  it("top 10, égalités, retrait, membres actifs seulement, mois de Dakar", async () => {
    await inRollback(async (tx) => {
      // Classement isolé : on retire de la course les membres existants de la base de dev.
      await tx.user.updateMany({ data: { hiddenFromRankings: true } });
      const actor = await staff(tx);
      const now = new Date("2031-03-15T12:00:00Z");
      const at = (iso: string) => new Date(iso);
      const make = async (
        firstName: string,
        lastName: string,
        lines: [number, string][],
        opts = {},
      ) => {
        const user = await member(tx, { firstName, lastName, ...opts });
        for (const [points, iso] of lines) {
          await tx.pointTransaction.create({
            data: {
              userId: user.id,
              points,
              sourceType: "MANUAL",
              sourceId: uniq(),
              reason: "t",
              createdById: actor.id,
              createdAt: at(iso),
            },
          });
        }
        return user;
      };
      const awa = await make("Awa", "Diop", [
        [50, "2031-03-01T00:00:00Z"],
        [40, "2031-02-28T23:59:59Z"],
      ]);
      const binta = await make("Binta", "Sow", [[50, "2031-03-31T23:59:59Z"]]);
      const cheikh = await make("Cheikh", "Ba", [[30, "2031-03-10T00:00:00Z"]]);
      const hidden = await make("Hawa", "Kane", [[500, "2031-03-10T00:00:00Z"]], { hidden: true });
      await make("Sidy", "Gaye", [[900, "2031-03-10T00:00:00Z"]], { status: "SUSPENDED" });
      await make("Demain", "Avril", [[999, "2031-04-01T00:00:00Z"]]);

      const month = await getPointRankings({ period: "month", viewerId: cheikh.id, now }, tx);
      expect(month.top.map((r) => [r.firstName, r.lastNameInitial, r.rank, r.points])).toEqual([
        ["Awa", "D.", 1, 50],
        ["Binta", "S.", 1, 50],
        ["Cheikh", "B.", 3, 30],
      ]);
      expect(month.top.find((r) => r.isViewer)?.userId).toBe(cheikh.id);
      expect(month.viewer).toEqual({ rank: 3, points: 30, hidden: false });
      expect(JSON.stringify(month)).not.toMatch(/Diop|Sow/);

      const all = await getPointRankings({ period: "all", viewerId: awa.id, now }, tx);
      expect(all.top[0]).toMatchObject({ firstName: "Demain", rank: 1 });
      expect(all.viewer).toEqual({ rank: 2, points: 90, hidden: false });

      const retired = await getPointRankings({ period: "month", viewerId: hidden.id, now }, tx);
      expect(retired.viewer).toEqual({ rank: null, points: 500, hidden: true });
      expect(retired.top.some((r) => r.userId === hidden.id)).toBe(false);

      expect(
        (await getPointRankings({ period: "month", viewerId: actor.id, now }, tx)).viewer,
      ).toBeNull();
      expect(
        (await getPointRankings({ period: "month", viewerId: null, now }, tx)).viewer,
      ).toBeNull();
      expect(binta.id).toBeTruthy();
    });
  });

  it("au plus dix lignes, la position du membre au-delà", async () => {
    await inRollback(async (tx) => {
      await tx.user.updateMany({ data: { hiddenFromRankings: true } });
      const now = new Date("2031-05-10T00:00:00Z");
      const ids: string[] = [];
      for (let i = 0; i < 12; i++) {
        const user = await member(tx, { firstName: `M${String(i).padStart(2, "0")}` });
        ids.push(user.id);
        await tx.pointTransaction.create({
          data: {
            userId: user.id,
            points: 100 - i,
            sourceType: "MANUAL",
            sourceId: uniq(),
            createdAt: now,
          },
        });
      }
      const result = await getPointRankings({ period: "month", viewerId: ids[11]!, now }, tx);
      expect(result.top).toHaveLength(10);
      expect(result.viewer).toEqual({ rank: 12, points: 89, hidden: false });
    });
  });
});

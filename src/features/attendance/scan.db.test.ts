import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const { listCheckInEvents, manualCheckIn, scanCardCheckIn, searchRegistrants } =
  await import("@/features/attendance/service");
const { issueCardToken, revokeCardToken } = await import("@/features/members/card-service");
const { recordAttendance } = await import("@/features/payments/service");

/**
 * Scan des présences contre une vraie base : les services ouvrent leurs propres transactions,
 * les données du test sont donc écrites pour de bon, puis supprimées à la fin (`afterAll`).
 */
const reachable = await databaseReachable();
const tag = uniq();
const users: string[] = [];
const events: string[] = [];
const all = { attendance: true, payments: true };

async function makeUser(label: string, status: "ACTIVE" | "SUSPENDED" = "ACTIVE", member = true) {
  const user = await db.user.create({
    data: {
      name: `${label} Test`,
      firstName: label,
      lastName: `Scan${tag}`,
      email: `vitest-scan-${label.toLowerCase()}-${tag}@test.localhost`,
      status: "ACTIVE",
      memberNumber: member ? `VS-${tag}-${label}` : null,
      isDemo: true,
    },
  });
  users.push(user.id);
  const token = member ? await issueCardToken(user.id) : "";
  if (status !== "ACTIVE") await db.user.update({ where: { id: user.id }, data: { status } });
  return { ...user, token };
}

async function makeEvent(
  label: string,
  startsAt: Date,
  status: "PUBLISHED" | "DRAFT" = "PUBLISHED",
) {
  const event = await db.event.create({
    data: {
      slug: `vt-scan-${label}-${tag}`,
      title: `Rendez-vous ${label} ${tag}`,
      type: "RENDEZ_VOUS_LECTURE",
      activities: ["RENDEZ_VOUS_LECTURE"],
      description: "Test",
      startsAt,
      status,
      isDemo: true,
    },
  });
  events.push(event.id);
  return event;
}

const register = (
  eventId: string,
  userId: string,
  status: "CONFIRMED" | "CANCELLED" = "CONFIRMED",
) => db.eventRegistration.create({ data: { eventId, userId, status } });

const points = async (userId: string) =>
  (await db.pointTransaction.aggregate({ where: { userId }, _sum: { points: true } }))._sum
    .points ?? 0;

let actor: Awaited<ReturnType<typeof makeUser>>;
let today: Awaited<ReturnType<typeof makeEvent>>;

beforeAll(async () => {
  if (!reachable) return;
  actor = await makeUser("Resp", "ACTIVE", false);
  today = await makeEvent("jour", new Date());
});

afterAll(async () => {
  if (!reachable) return;
  const registrations = await db.eventRegistration.findMany({
    where: { eventId: { in: events } },
    select: { id: true },
  });
  const lines = await db.pointTransaction.findMany({
    where: { userId: { in: users } },
    select: { id: true },
  });
  const payments = await db.payment.findMany({
    where: { userId: { in: users } },
    select: { id: true },
  });
  const ids = [
    ...users,
    ...registrations.map((r) => r.id),
    ...lines.map((l) => l.id),
    ...payments.map((p) => p.id),
  ];
  await db.auditLog.deleteMany({
    where: { OR: [{ entityId: { in: ids } }, { actorId: { in: users } }] },
  });
  await db.pointTransaction.deleteMany({
    where: { userId: { in: users }, reversesId: { not: null } },
  });
  await db.pointTransaction.deleteMany({ where: { userId: { in: users } } });
  await db.userBadge.deleteMany({ where: { userId: { in: users } } });
  await db.payment.deleteMany({
    where: { OR: [{ userId: { in: users } }, { eventId: { in: events } }] },
  });
  await db.event.deleteMany({ where: { id: { in: events } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
});

describe.skipIf(!reachable)("scan des présences (base réelle)", () => {
  it("scan valide : présence QR, participation au montant du réglage, points, trace ; second scan idempotent", async () => {
    const awa = await makeUser("Awa");
    const registration = await register(today.id, awa.id);
    const first = await scanCardCheckIn(
      { eventId: today.id, token: awa.token, paid: true },
      actor.id,
      all,
    );
    expect(first).toMatchObject({
      ok: true,
      alreadyPresent: false,
      method: "QR_SCAN",
      paid: true,
      pointsAwarded: 20,
      member: { firstName: "Awa", memberNumber: `VS-${tag}-Awa`, cardPaid: false, photoUrl: null },
    });
    const fee = await db.setting.findUnique({ where: { key: "fees.session" } });
    const payment = await db.payment.findFirstOrThrow({
      where: { registrationId: registration.id },
    });
    expect(payment.amount).toBe(Number(fee?.value ?? 100));
    expect(
      await db.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } }),
    ).toMatchObject({
      checkInMethod: "QR_SCAN",
      checkedInById: actor.id,
    });
    expect(
      await db.auditLog.count({
        where: { action: "attendance.scanned", entityId: registration.id },
      }),
    ).toBe(1);

    const again = await scanCardCheckIn(
      { eventId: today.id, token: awa.token, paid: true },
      actor.id,
      all,
    );
    expect(again).toMatchObject({ ok: true, alreadyPresent: true, pointsAwarded: 0, paid: true });
    expect(again.ok && first.ok && again.attendedAt.getTime()).toBe(
      first.ok && first.attendedAt.getTime(),
    );
    expect(
      await db.payment.count({ where: { registrationId: registration.id, cancelledAt: null } }),
    ).toBe(1);
    expect(await points(awa.id)).toBe(20);
    expect(
      await db.auditLog.count({
        where: { action: "attendance.scanned", entityId: registration.id },
      }),
    ).toBe(1);
  });

  it("deux scans simultanés de la même carte : une seule présence, une seule ligne de points", async () => {
    const binta = await makeUser("Binta");
    await register(today.id, binta.id);
    const results = await Promise.all(
      [0, 1, 2].map(() =>
        scanCardCheckIn({ eventId: today.id, token: binta.token, paid: false }, actor.id, all),
      ),
    );
    expect(results.filter((r) => r.ok && !r.alreadyPresent)).toHaveLength(1);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(await points(binta.id)).toBe(20);
  });

  it("carte remplacée (jeton rejoué), compte suspendu, jeton forgé : refusés, rien n'est écrit", async () => {
    const cheikh = await makeUser("Cheikh");
    const registration = await register(today.id, cheikh.id);
    await revokeCardToken(cheikh.id, actor.id, "Téléphone perdu");
    expect(
      await scanCardCheckIn({ eventId: today.id, token: cheikh.token, paid: false }, actor.id, all),
    ).toMatchObject({
      ok: false,
      reason: "revoked",
    });
    const sidy = await makeUser("Sidy", "SUSPENDED");
    await register(today.id, sidy.id);
    expect(
      await scanCardCheckIn({ eventId: today.id, token: sidy.token, paid: false }, actor.id, all),
    ).toMatchObject({
      ok: false,
      reason: "suspended",
    });
    const forged = `${cheikh.token.slice(0, -4)}AAAA`;
    expect(
      await scanCardCheckIn({ eventId: today.id, token: forged, paid: false }, actor.id, all),
    ).toMatchObject({
      ok: false,
      reason: "bad_signature",
    });
    expect(
      (await db.eventRegistration.findUniqueOrThrow({ where: { id: registration.id } })).attendedAt,
    ).toBeNull();
    expect(await points(cheikh.id)).toBe(0);
  });

  it("secours manuel : un compte suspendu ou archivé est refusé comme sa carte, rien n'est écrit", async () => {
    const ndeye = await makeUser("Ndeye", "SUSPENDED");
    const suspended = await register(today.id, ndeye.id);
    expect(
      await manualCheckIn({ eventId: today.id, userId: ndeye.id, paid: true }, actor.id, all),
    ).toMatchObject({ ok: false, reason: "suspended" });
    const oumy = await makeUser("Oumy");
    const archived = await register(today.id, oumy.id);
    await db.user.update({ where: { id: oumy.id }, data: { status: "ARCHIVED" } });
    expect(
      await manualCheckIn({ eventId: today.id, userId: oumy.id, paid: false }, actor.id, all),
    ).toMatchObject({ ok: false, reason: "archived" });
    for (const registration of [suspended, archived]) {
      const row = await db.eventRegistration.findUniqueOrThrow({
        where: { id: registration.id },
        include: { payments: true },
      });
      expect(row.attendedAt).toBeNull();
      expect(row.payments).toHaveLength(0);
    }
    expect(await points(ndeye.id)).toBe(0);
    expect(await points(oumy.id)).toBe(0);
  });

  it("membre non inscrit ou inscription annulée : refus clair, pas d'inscription sur place", async () => {
    const dior = await makeUser("Dior");
    const refused = await scanCardCheckIn(
      { eventId: today.id, token: dior.token, paid: true },
      actor.id,
      all,
    );
    expect(refused).toMatchObject({ ok: false, reason: "not_registered" });
    expect(await db.eventRegistration.count({ where: { userId: dior.id } })).toBe(0);
    const ely = await makeUser("Ely");
    await register(today.id, ely.id, "CANCELLED");
    expect(
      await scanCardCheckIn({ eventId: today.id, token: ely.token, paid: false }, actor.id, all),
    ).toMatchObject({
      ok: false,
      reason: "registration_cancelled",
    });
  });

  it("rencontre pas encore ouverte, brouillon, ou « payé » sans le droit d'encaisser : refusé", async () => {
    const fatou = await makeUser("Fatou");
    const tomorrow = await makeEvent("demain", new Date(Date.now() + 36 * 3600 * 1000));
    await register(tomorrow.id, fatou.id);
    await expect(
      scanCardCheckIn({ eventId: tomorrow.id, token: fatou.token, paid: false }, actor.id, all),
    ).rejects.toThrow(/ouvre le jour/);
    const draft = await makeEvent("brouillon", new Date(), "DRAFT");
    await expect(
      scanCardCheckIn({ eventId: draft.id, token: fatou.token, paid: false }, actor.id, all),
    ).rejects.toThrow(/pas ouverte au pointage/);
    await register(today.id, fatou.id);
    await expect(
      scanCardCheckIn({ eventId: today.id, token: fatou.token, paid: true }, actor.id, {
        attendance: true,
        payments: false,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await points(fatou.id)).toBe(0);
  });

  it("secours manuel, puis pointage décoché et recoché depuis la fiche : points corrigés puis rendus", async () => {
    const gora = await makeUser("Gora");
    const registration = await register(today.id, gora.id);
    const result = await manualCheckIn(
      { eventId: today.id, userId: gora.id, paid: false },
      actor.id,
      all,
    );
    expect(result).toMatchObject({ ok: true, method: "MANUAL", pointsAwarded: 20, paid: false });
    await recordAttendance(
      { registrationId: registration.id, present: false, paid: false },
      actor.id,
      all,
    );
    expect(await points(gora.id)).toBe(0);
    expect(
      await db.pointTransaction.count({ where: { userId: gora.id, sourceType: "CORRECTION" } }),
    ).toBe(1);
    await recordAttendance(
      { registrationId: registration.id, present: true, paid: true },
      actor.id,
      all,
    );
    expect(await points(gora.id)).toBe(20);
  });

  it("rencontres du jour et recherche d'un inscrit confirmé (nom, numéro)", async () => {
    const list = await listCheckInEvents(new Date());
    expect(list.some((event) => event.id === today.id)).toBe(true);
    expect(
      list.every((event) => !events.slice(1).includes(event.id) || event.id === today.id),
    ).toBe(true);
    const byNumber = await searchRegistrants(today.id, `VS-${tag}-Awa`);
    expect(byNumber.map((m) => m.firstName)).toEqual(["Awa"]);
    const byName = await searchRegistrants(today.id, `awa scan${tag}`);
    expect(byName).toHaveLength(1);
    expect(await searchRegistrants(today.id, `Ely Scan${tag}`)).toEqual([]);
  });
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Liste d'attente sur la vraie base : rang, promotion à la place libérée (dans la transaction de
 * l'annulation), concurrence, capacité augmentée, invité qui n'a pas confirmé à temps, seuil de
 * 2 h, promotion manuelle, sortie de la liste. Rencontres dans le futur, retirées à la fin.
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (message: { to: string; subject: string; text: string }) =>
    void mail.sent.push(message),
}));

const {
  joinWaitlistAsMember,
  joinWaitlistAsGuest,
  promoteFromWaitlist,
  runWaitlistTask,
  waitlistPosition,
} = await import("@/features/events/waitlist");
const {
  cancelMemberRegistration,
  registerMember,
  confirmGuestRegistration,
  cancelGuestRegistration,
} = await import("@/features/events/registration");
const { updateEvent } = await import("@/features/events/service");
const { sendEventReminders } = await import("@/features/events/reminders");

const reachable = await databaseReachable();
const HOUR = 3_600_000;

describe.skipIf(!reachable)("liste d'attente (base réelle)", () => {
  const tag = uniq();
  const users: string[] = [];
  const events: string[] = [];
  let n = 0;

  const makeEvent = async (capacity: number | null, hoursAhead = 72, isPublic = true) => {
    const event = await db.event.create({
      data: {
        slug: `vt-attente-${tag}-${++n}`,
        title: `Attente ${tag} ${n}`,
        type: "RENDEZ_VOUS_LECTURE",
        activities: ["RENDEZ_VOUS_LECTURE"],
        description: "Test",
        startsAt: new Date(Date.now() + hoursAhead * HOUR),
        status: "PUBLISHED",
        capacity,
        isPublic,
        // Annulation possible jusqu'au début : les tests annulent librement.
        cancellationDeadlineHours: 0,
        isDemo: true,
      },
    });
    events.push(event.id);
    return event;
  };
  const makeMember = async (status: "ACTIVE" | "SUSPENDED" = "ACTIVE") => {
    const user = await db.user.create({
      data: {
        firstName: `Membre${++n}`,
        lastName: "Attente",
        name: `Membre${n} Attente`,
        email: `attente-${n}-${tag}@e2e.agora.test`,
        status,
        isDemo: true,
      },
    });
    users.push(user.id);
    return user;
  };
  const confirmed = (eventId: string, userId: string) =>
    db.eventRegistration.create({
      data: { eventId, userId, status: "CONFIRMED", confirmedAt: new Date() },
    });
  const statusOf = async (eventId: string, userId: string) =>
    (await db.eventRegistration.findUnique({ where: { eventId_userId: { eventId, userId } } }))!;
  const confirmedCount = (eventId: string) =>
    db.eventRegistration.count({ where: { eventId, status: "CONFIRMED" } });
  const rankOf = async (eventId: string, userId: string) => {
    const r = await statusOf(eventId, userId);
    return waitlistPosition({ id: r.id, eventId, waitlistedAt: r.waitlistedAt! });
  };

  beforeEach(() => {
    mail.sent.length = 0;
  });

  afterAll(async () => {
    const registrations = await db.eventRegistration.findMany({
      where: { eventId: { in: events } },
      select: { id: true },
    });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: registrations.map((r) => r.id) } },
          { entityId: { in: events } },
          { actorId: { in: users } },
        ],
      },
    });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.event.deleteMany({ where: { id: { in: events } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("rencontre complète : rangs 1 et 2 ; une place libre : inscription directe", async () => {
    const event = await makeEvent(1);
    const [a, b, c] = [await makeMember(), await makeMember(), await makeMember()];
    await confirmed(event.id, a.id);
    expect(await joinWaitlistAsMember(event.id, b.id)).toEqual({
      outcome: "waitlisted",
      position: 1,
    });
    expect(await joinWaitlistAsMember(event.id, c.id)).toEqual({
      outcome: "waitlisted",
      position: 2,
    });
    // Deuxième demande : rien ne change, même rang.
    expect(await joinWaitlistAsMember(event.id, b.id)).toEqual({
      outcome: "waitlisted",
      position: 1,
    });
    const open = await makeEvent(5);
    expect(await joinWaitlistAsMember(open.id, b.id)).toEqual({ outcome: "register" });
    expect(
      await db.auditLog.count({
        where: { action: "event.waitlist_joined", entityId: (await statusOf(event.id, b.id)).id },
      }),
    ).toBe(1);
  });

  it("annulation : la première personne est inscrite d'office, prévenue, la suivante avance", async () => {
    const event = await makeEvent(1);
    const [a, b, c] = [await makeMember(), await makeMember(), await makeMember()];
    const reg = await confirmed(event.id, a.id);
    await joinWaitlistAsMember(event.id, b.id);
    await joinWaitlistAsMember(event.id, c.id);
    await cancelMemberRegistration(reg.id, a.id);

    const promoted = await statusOf(event.id, b.id);
    expect(promoted).toMatchObject({ status: "CONFIRMED" });
    expect(promoted.promotedAt).not.toBeNull();
    expect(promoted.waitlistedAt).not.toBeNull();
    expect(await rankOf(event.id, c.id)).toBe(1);
    expect(await confirmedCount(event.id)).toBe(1);
    expect(mail.sent.map((m) => m.to)).toEqual([b.email]);
    expect(mail.sent[0]!.subject).toContain("Une place s’est libérée");
    expect(mail.sent[0]!.text).toContain("agenda.ics");
    expect(
      await db.registrationMail.findFirstOrThrow({
        where: { registrationId: promoted.id, kind: "WAITLIST_PROMOTED" },
      }),
    ).toMatchObject({ sentAt: expect.any(Date) });
    expect(
      await db.auditLog.findFirstOrThrow({
        where: { action: "event.waitlist_promoted", entityId: promoted.id },
      }),
    ).toMatchObject({ actorId: null });
    expect(
      await db.notification.count({ where: { userId: b.id, type: "event.waitlist_promoted" } }),
    ).toBe(1);
  });

  it("deux annulations simultanées, trois en attente : les deux premiers promus, jamais plus que la capacité", async () => {
    const event = await makeEvent(2);
    const [a, b] = [await makeMember(), await makeMember()];
    const waiting = [await makeMember(), await makeMember(), await makeMember()];
    const regA = await confirmed(event.id, a.id);
    const regB = await confirmed(event.id, b.id);
    for (const w of waiting) await joinWaitlistAsMember(event.id, w.id);
    await Promise.all([
      cancelMemberRegistration(regA.id, a.id),
      cancelMemberRegistration(regB.id, b.id),
    ]);
    expect(await confirmedCount(event.id)).toBe(2);
    expect((await statusOf(event.id, waiting[0]!.id)).status).toBe("CONFIRMED");
    expect((await statusOf(event.id, waiting[1]!.id)).status).toBe("CONFIRMED");
    expect((await statusOf(event.id, waiting[2]!.id)).status).toBe("WAITLISTED");
    expect(await rankOf(event.id, waiting[2]!.id)).toBe(1);
  });

  it("une place libérée, deux en attente, tâche et inscription concurrentes : une seule promotion", async () => {
    const event = await makeEvent(1);
    const [a, b, c, d] = [
      await makeMember(),
      await makeMember(),
      await makeMember(),
      await makeMember(),
    ];
    const regA = await confirmed(event.id, a.id);
    await joinWaitlistAsMember(event.id, b.id);
    await joinWaitlistAsMember(event.id, c.id);
    const results = await Promise.allSettled([
      cancelMemberRegistration(regA.id, a.id),
      runWaitlistTask(),
      runWaitlistTask(),
      registerMember(event.id, { id: d.id, firstName: "D", email: d.email }),
    ]);
    expect(await confirmedCount(event.id)).toBe(1);
    expect((await statusOf(event.id, b.id)).status).toBe("CONFIRMED");
    expect((await statusOf(event.id, c.id)).status).toBe("WAITLISTED");
    // Le tiers n'a jamais pris la place devant la liste.
    expect(results[3]).toMatchObject({ status: "rejected" });
    expect(
      await db.eventRegistration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: d.id } },
      }),
    ).toBeNull();
    expect(mail.sent.filter((m) => m.to === b.email)).toHaveLength(1);
  });

  it("capacité augmentée de 2 : les deux premiers passent ; membre suspendu ignoré", async () => {
    const event = await makeEvent(1);
    const a = await makeMember();
    await confirmed(event.id, a.id);
    const suspended = await makeMember();
    const [b, c, d] = [await makeMember(), await makeMember(), await makeMember()];
    await joinWaitlistAsMember(event.id, suspended.id);
    await db.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
    for (const w of [b, c, d]) await joinWaitlistAsMember(event.id, w.id);
    const row = await db.event.findUniqueOrThrow({ where: { id: event.id } });
    await updateEvent(event.id, {
      title: row.title,
      type: row.type,
      activities: row.activities,
      summary: "",
      description: row.description,
      location: "",
      isTentative: false,
      program: "",
      speakerName: "",
      speakerTitle: "",
      speakerMode: "",
      videoLink: "",
      startsAt: row.startsAt,
      endsAt: null,
      capacity: 3,
      isPublic: true,
      cancellationDeadlineHours: 0,
    } as never);
    expect(await confirmedCount(event.id)).toBe(3);
    expect((await statusOf(event.id, suspended.id)).status).toBe("WAITLISTED");
    expect((await statusOf(event.id, b.id)).status).toBe("CONFIRMED");
    expect((await statusOf(event.id, c.id)).status).toBe("CONFIRMED");
    expect((await statusOf(event.id, d.id)).status).toBe("WAITLISTED");
  });

  it("invité : sans confirmation, pas de rang ; après le lien, il prend son rang ; place rendue par un invité en attente de confirmation", async () => {
    const event = await makeEvent(1);
    const a = await makeMember();
    // Un invité retient la place sans confirmer, puis son délai de 24 h expire.
    const held = await db.eventRegistration.create({
      data: {
        eventId: event.id,
        guestName: "Retard",
        guestEmail: `retard-${tag}@e2e.agora.test`,
        status: "PENDING",
      },
    });
    expect(await joinWaitlistAsMember(event.id, a.id)).toEqual({
      outcome: "waitlisted",
      position: 1,
    });
    const email = `attente-invite-${tag}@e2e.agora.test`;
    expect(await joinWaitlistAsGuest(event.id, { name: "Moussa", email })).toEqual({
      outcome: "verify",
    });
    const link = mail.sent.find((m) => m.to === email)!.text.match(/token=([\w-]+)/)![1]!;
    const guest = await db.eventRegistration.findUniqueOrThrow({
      where: { eventId_guestEmail: { eventId: event.id, guestEmail: email } },
    });
    expect(guest).toMatchObject({ status: "WAITLISTED", waitlistedAt: null });
    await confirmGuestRegistration(link);
    const ranked = await db.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } });
    expect(
      await waitlistPosition({
        id: ranked.id,
        eventId: event.id,
        waitlistedAt: ranked.waitlistedAt!,
      }),
    ).toBe(2);

    // 25 h plus tard (date de la retenue reculée) : la tâche horaire donne la place au 1er.
    await db.$executeRaw`UPDATE "EventRegistration" SET "updatedAt" = now() - interval '25 hours' WHERE id = ${held.id}`;
    expect(await runWaitlistTask()).toContain("1 promotion(s)");
    expect((await statusOf(event.id, a.id)).status).toBe("CONFIRMED");
    expect(await runWaitlistTask()).toContain("0 promotion(s)");

    // L'invité quitte la liste depuis son lien.
    await cancelGuestRegistration(link);
    expect(await db.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } })).toMatchObject(
      {
        status: "CANCELLED",
      },
    );
    expect(
      await db.auditLog.count({ where: { action: "event.waitlist_left", entityId: guest.id } }),
    ).toBe(1);
  });

  it("à moins de 2 h du début : pas de promotion automatique ; à la main, confirmation du dépassement exigée", async () => {
    const event = await makeEvent(1, 1);
    const [a, b, actor] = [await makeMember(), await makeMember(), await makeMember()];
    await confirmed(event.id, a.id);
    // Liste remplie avant le seuil.
    const reg = await db.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: b.id,
        status: "WAITLISTED",
        waitlistedAt: new Date(Date.now() - 5 * HOUR),
      },
    });
    await expect(joinWaitlistAsMember(event.id, actor.id)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await expect(promoteFromWaitlist(reg.id, actor.id, false)).rejects.toMatchObject({
      code: "CONFLICT",
    });
    await promoteFromWaitlist(reg.id, actor.id, true);
    expect(await confirmedCount(event.id)).toBe(2);
    expect(
      await db.auditLog.findFirstOrThrow({
        where: { action: "event.waitlist_promoted", entityId: reg.id },
      }),
    ).toMatchObject({
      actorId: actor.id,
      metadata: expect.objectContaining({ mode: "manual", overCapacity: true }),
    });
    expect(mail.sent.find((m) => m.to === b.email)!.text).toContain(
      "Le club vous a fait une place",
    );
  });

  it("annulation à moins de 2 h : la place est libre pour tous, pas de promotion ; quitter la liste reste possible", async () => {
    const event = await makeEvent(1, 1);
    const [a, b] = [await makeMember(), await makeMember()];
    const regA = await confirmed(event.id, a.id);
    const regB = await db.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: b.id,
        status: "WAITLISTED",
        waitlistedAt: new Date(Date.now() - 5 * HOUR),
      },
    });
    await cancelMemberRegistration(regA.id, a.id);
    expect((await statusOf(event.id, b.id)).status).toBe("WAITLISTED");
    expect(mail.sent).toEqual([]);
    await cancelMemberRegistration(regB.id, b.id);
    expect((await statusOf(event.id, b.id)).status).toBe("CANCELLED");
  });

  it("place rendue par un invité, inscription refusée : la promotion de la file est gardée ; rangs sans les comptes inactifs", async () => {
    const event = await makeEvent(1);
    const [b, c, suspended] = [await makeMember(), await makeMember(), await makeMember()];
    const held = await db.eventRegistration.create({
      data: {
        eventId: event.id,
        guestName: "Retard",
        guestEmail: `retard2-${tag}@e2e.agora.test`,
        status: "PENDING",
      },
    });
    await joinWaitlistAsMember(event.id, suspended.id);
    await db.user.update({ where: { id: suspended.id }, data: { status: "SUSPENDED" } });
    await joinWaitlistAsMember(event.id, b.id);
    // Le compte suspendu ne compte pas : B est 1er.
    expect(await rankOf(event.id, b.id)).toBe(1);
    await db.$executeRaw`UPDATE "EventRegistration" SET "updatedAt" = now() - interval '25 hours' WHERE id = ${held.id}`;
    // C tente de s'inscrire : la place rendue va d'abord à B, puis C est refusé (complet).
    await expect(
      registerMember(event.id, { id: c.id, firstName: "C", email: c.email }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await statusOf(event.id, b.id)).status).toBe("CONFIRMED");
    expect(mail.sent.filter((m) => m.to === b.email)).toHaveLength(1);
  });

  it("le rappel la veille ne part pas aux personnes en attente", async () => {
    const event = await makeEvent(1, 24);
    const [a, b] = [await makeMember(), await makeMember()];
    await db.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: a.id,
        status: "CONFIRMED",
        confirmedAt: new Date(Date.now() - 72 * HOUR),
      },
    });
    await db.eventRegistration.create({
      data: {
        eventId: event.id,
        userId: b.id,
        status: "WAITLISTED",
        waitlistedAt: new Date(Date.now() - 72 * HOUR),
        createdAt: new Date(Date.now() - 72 * HOUR),
      },
    });
    const start = (await db.event.findUniqueOrThrow({ where: { id: event.id } })).startsAt;
    // Dans la fenêtre du rappel : la veille à 10 h passée.
    const now = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() - 1, 12),
    );
    if (now < start) await sendEventReminders(now, { eventIds: [event.id] });
    expect(mail.sent.some((m) => m.to === b.email)).toBe(false);
  });
});

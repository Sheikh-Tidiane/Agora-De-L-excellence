import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Avis après les rencontres, sur la vraie base : invitations sans doublon (même en parallèle),
 * dépôt et modification par le seul membre présent, fenêtre de 7 jours, masquage, purge à
 * 24 mois, agrégats par rencontre et par activité. Dates fixes dans le futur.
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
const mail = vi.hoisted(() => ({ sent: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (message: { to: string; subject: string; text: string }) =>
    void mail.sent.push(message),
}));

const { sendFeedbackRequests } = await import("@/features/feedback/requests");
const { saveMemberFeedback, hideFeedbackComment, restoreFeedbackComment, purgeFeedback } =
  await import("@/features/feedback/service");
const { getFeedbackOverview, getEventFeedback } = await import("@/features/feedback/queries");

const reachable = await databaseReachable();

describe.skipIf(!reachable)("avis après les rencontres (base réelle)", () => {
  const tag = uniq();
  const users: string[] = [];
  const events: string[] = [];
  let n = 0;
  // Rencontre le 5 mars 2031, 18 h à 20 h : invitations le 6 à 10 h, avis jusqu'au 13 à 10 h.
  const START = new Date("2031-03-05T18:00:00Z");
  const END = new Date("2031-03-05T20:00:00Z");
  const INVITE = new Date("2031-03-06T10:05:00Z");

  const makeEvent = async (
    activities: ("RENDEZ_VOUS_LECTURE" | "GENIES_DU_SOIR")[] = ["RENDEZ_VOUS_LECTURE"],
    startsAt = START,
    endsAt: Date | null = END,
  ) => {
    const event = await db.event.create({
      data: {
        slug: `vt-avis-${tag}-${++n}`,
        title: `Avis ${tag} ${n}`,
        type: activities[0]!,
        activities,
        description: "Test",
        startsAt,
        endsAt,
        status: "PUBLISHED",
        // Comptée dans les tableaux (qui excluent les données de démonstration).
        isDemo: false,
      },
    });
    events.push(event.id);
    return event;
  };
  const makeMember = async () => {
    const user = await db.user.create({
      data: {
        firstName: `Avis${++n}`,
        lastName: "Membre",
        name: `Avis${n} Membre`,
        email: `avis-${n}-${tag}@e2e.agora.test`,
        status: "ACTIVE",
        isDemo: true,
      },
    });
    users.push(user.id);
    return user;
  };
  const attend = (eventId: string, userId: string, present = true) =>
    db.eventRegistration.create({
      data: {
        eventId,
        userId,
        status: "CONFIRMED",
        confirmedAt: START,
        ...(present ? { attendedAt: START, checkInMethod: "MANUAL" as const } : {}),
      },
    });
  const run = (eventIds: string[], now = INVITE) => sendFeedbackRequests(now, { eventIds });

  beforeEach(() => {
    mail.sent.length = 0;
  });

  afterAll(async () => {
    const feedbacks = await db.eventFeedback.findMany({
      where: { eventId: { in: events } },
      select: { id: true },
    });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: feedbacks.map((f) => f.id) } },
          { action: "feedback.purged", createdAt: { gte: new Date(Date.now() - 3_600_000) } },
        ],
      },
    });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.event.deleteMany({ where: { id: { in: events } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("invitation le lendemain aux seuls présents, une fois, même lancée deux fois en parallèle", async () => {
    const event = await makeEvent();
    const [present, absent, other] = [await makeMember(), await makeMember(), await makeMember()];
    await attend(event.id, present.id);
    await attend(event.id, absent.id, false);
    await attend(event.id, other.id);
    // La veille de l'ouverture : rien.
    expect((await run([event.id], new Date("2031-03-06T09:59:00Z"))).sent).toBe(0);
    const [a, b] = await Promise.all([run([event.id]), run([event.id])]);
    expect(a.sent + b.sent).toBe(2);
    expect(mail.sent.map((m) => m.to).sort()).toEqual([present.email, other.email].sort());
    expect(mail.sent[0]!.text).toContain(`/member/events/${event.slug}/avis`);
    expect(mail.sent[0]!.text).toContain("jusqu’au jeudi 13 mars 2031 à 10");
    expect(
      await db.notification.count({
        where: { userId: present.id, type: "event.feedback_request" },
      }),
    ).toBe(1);
    // Relancée : rien de plus. Après 72 h de rattrapage : rien non plus.
    expect((await run([event.id])).sent).toBe(0);
    const late = await makeMember();
    await attend(event.id, late.id);
    expect((await run([event.id], new Date("2031-03-09T10:00:00Z"))).sent).toBe(0);
  });

  it("dépôt par le membre présent, modifiable 7 jours, une seule ligne même en parallèle ; refus pour un absent", async () => {
    const event = await makeEvent();
    const [present, absent] = [await makeMember(), await makeMember()];
    await attend(event.id, present.id);
    await attend(event.id, absent.id, false);
    const at = new Date("2031-03-06T12:00:00Z");
    const results = await Promise.all([
      saveMemberFeedback(present.id, { eventId: event.id, rating: 4, comment: "Belle soirée" }, at),
      saveMemberFeedback(present.id, { eventId: event.id, rating: 5, comment: null }, at),
    ]);
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await db.eventFeedback.count({ where: { eventId: event.id } })).toBe(1);
    await saveMemberFeedback(
      present.id,
      { eventId: event.id, rating: 3, comment: "Finalement moyen" },
      new Date("2031-03-13T09:59:00Z"),
    );
    expect(await db.eventFeedback.findFirstOrThrow({ where: { eventId: event.id } })).toMatchObject(
      {
        rating: 3,
        comment: "Finalement moyen",
      },
    );
    await expect(
      saveMemberFeedback(
        present.id,
        { eventId: event.id, rating: 5, comment: null },
        new Date("2031-03-13T10:00:00Z"),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      saveMemberFeedback(absent.id, { eventId: event.id, rating: 5, comment: null }, at),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    // Pendant la rencontre : trop tôt.
    await expect(
      saveMemberFeedback(
        present.id,
        { eventId: event.id, rating: 5, comment: null },
        new Date("2031-03-05T19:00:00Z"),
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Les contraintes de la base refusent une note hors de 1 à 5.
    await expect(
      db.eventFeedback.update({
        where: {
          registrationId: (
            await db.eventFeedback.findFirstOrThrow({ where: { eventId: event.id } })
          ).registrationId!,
        },
        data: { rating: 6 },
      }),
    ).rejects.toThrow(/EventFeedback_rating_check/);
  });

  it("masquage : motif, version, journal sans le texte ; le membre garde sa note mais plus son commentaire", async () => {
    const event = await makeEvent();
    const [member, moderator] = [await makeMember(), await makeMember()];
    await attend(event.id, member.id);
    const at = new Date("2031-03-06T12:00:00Z");
    await saveMemberFeedback(
      member.id,
      { eventId: event.id, rating: 2, comment: "Propos déplacés" },
      at,
    );
    const feedback = await db.eventFeedback.findFirstOrThrow({ where: { eventId: event.id } });
    await expect(
      hideFeedbackComment(moderator.id, {
        id: feedback.id,
        reason: "Contraire à la charte",
        version: new Date(0).toISOString(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await hideFeedbackComment(moderator.id, {
      id: feedback.id,
      reason: "Contraire à la charte",
      version: feedback.updatedAt.toISOString(),
    });
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "feedback.comment_hidden", entityId: feedback.id },
    });
    expect(JSON.stringify(audit.metadata)).not.toContain("Propos");
    expect(JSON.stringify(audit.metadata)).not.toContain("charte");
    await expect(
      saveMemberFeedback(member.id, { eventId: event.id, rating: 2, comment: "Autre texte" }, at),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await saveMemberFeedback(
      member.id,
      { eventId: event.id, rating: 3, comment: "Propos déplacés" },
      at,
    );
    const hidden = await db.eventFeedback.findUniqueOrThrow({ where: { id: feedback.id } });
    expect(hidden).toMatchObject({ rating: 3, comment: "Propos déplacés" });
    expect(hidden.hiddenAt).not.toBeNull();
    await restoreFeedbackComment(moderator.id, {
      id: feedback.id,
      version: hidden.updatedAt.toISOString(),
    });
    expect(
      (await db.eventFeedback.findUniqueOrThrow({ where: { id: feedback.id } })).hiddenAt,
    ).toBeNull();
  });

  it("agrégats : une rencontre lecture + quiz compte pour les deux activités, ou la principale seule ; moyenne à partir de 3 avis", async () => {
    const event = await makeEvent(["RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"]);
    const members = [
      await makeMember(),
      await makeMember(),
      await makeMember(),
      await makeMember(),
    ];
    for (const m of members) await attend(event.id, m.id);
    const at = new Date("2031-03-06T12:00:00Z");
    for (const [index, rating] of [5, 4, 4].entries()) {
      await saveMemberFeedback(
        members[index]!.id,
        { eventId: event.id, rating, comment: null },
        at,
      );
    }
    const now = new Date("2031-03-20T00:00:00Z");
    const from = new Date("2031-03-01T00:00:00Z");
    const all = await getFeedbackOverview({ from, activity: null, mode: "all" }, now);
    const row = all.rows.find((r) => r.id === event.id)!;
    expect(row).toMatchObject({
      present: 4,
      count: 3,
      average: 4.3,
      distribution: [0, 0, 0, 2, 1],
    });
    const codes = (o: typeof all) => o.activities.filter((a) => a.count >= 3).map((a) => a.code);
    expect(codes(all)).toEqual(expect.arrayContaining(["RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"]));
    const primary = await getFeedbackOverview(
      { from, activity: "GENIES_DU_SOIR", mode: "primary" },
      now,
    );
    expect(primary.rows.find((r) => r.id === event.id)).toBeUndefined();
    const detail = await getEventFeedback(event.id);
    expect(detail!.feedbacks.map((f) => f.registration?.user?.name)).toEqual(
      expect.arrayContaining([members[0]!.name]),
    );
  });

  it("purge : à 24 mois, commentaire et auteur effacés, note gardée ; avant, rien ; relancée, rien", async () => {
    const event = await makeEvent();
    const member = await makeMember();
    await attend(event.id, member.id);
    await saveMemberFeedback(
      member.id,
      { eventId: event.id, rating: 4, comment: "À garder 24 mois" },
      new Date("2031-03-06T12:00:00Z"),
    );
    expect((await purgeFeedback(new Date("2033-03-04T00:00:00Z"))).anonymized).toBe(0);
    // Toutes les rencontres de ce fichier ont la même date : au moins celle-ci.
    expect(
      (await purgeFeedback(new Date("2033-03-06T00:00:00Z"))).anonymized,
    ).toBeGreaterThanOrEqual(1);
    expect(await db.eventFeedback.findFirstOrThrow({ where: { eventId: event.id } })).toMatchObject(
      {
        rating: 4,
        comment: null,
        registrationId: null,
        anonymizedAt: expect.any(Date),
      },
    );
    expect((await purgeFeedback(new Date("2033-03-07T00:00:00Z"))).anonymized).toBe(0);
  });
});

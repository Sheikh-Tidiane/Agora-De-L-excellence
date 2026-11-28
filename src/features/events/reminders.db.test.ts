import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Rappels la veille des rencontres, sur la vraie base : destinataires, sans doublon (y compris deux
 * passages simultanés), échec d'envoi retenté, rencontre déplacée, visio masquée, lien invité.
 * Dates fixes dans le futur, envoi limité aux rencontres du test (`eventIds`).
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
const mail = vi.hoisted(() => ({
  sent: [] as { to: string; subject: string; text: string; html: string }[],
  failures: 0,
}));
vi.mock("@/lib/mail", () => ({
  sendMail: async (message: { to: string; subject: string; text: string; html: string }) => {
    if (mail.failures > 0) {
      mail.failures -= 1;
      throw new Error("SMTP indisponible");
    }
    mail.sent.push(message);
  },
}));

const { sendEventReminders } = await import("@/features/events/reminders");
const {
  getGuestRegistration,
  cancelGuestRegistration,
  registerGuest: signUpGuest,
} = await import("@/features/events/registration");
const { hashToken } = await import("@/features/auth/service");

const reachable = await databaseReachable();
const DAY = 86_400_000;

describe.skipIf(!reachable)("rappels la veille des rencontres (base réelle)", () => {
  const tag = uniq();
  const users: string[] = [];
  const events: string[] = [];
  const settingKeys = ["events.hideVideoWhenCardUnpaid", "events.remindersEnabled"];
  let n = 0;

  // Rencontre le 5 mars 2031 à 18 h ; le rappel part la veille à 10 h.
  const START = new Date("2031-03-05T18:00:00Z");
  const NOW = new Date("2031-03-04T10:05:00Z");
  const BEFORE = new Date("2031-03-01T12:00:00Z");

  const makeEvent = async (data: { status?: "PUBLISHED" | "CANCELLED" | "DRAFT" } = {}) => {
    const event = await db.event.create({
      data: {
        slug: `vt-rappel-${tag}-${++n}`,
        title: `Rappel ${tag} ${n}`,
        type: "RENDEZ_VOUS_LECTURE",
        activities: ["RENDEZ_VOUS_LECTURE"],
        description: "Test",
        location: "Maison de la culture",
        videoLink: "https://visio.exemple.sn/rappel",
        startsAt: START,
        status: data.status ?? "PUBLISHED",
        isPublic: true,
        isDemo: true,
      },
    });
    events.push(event.id);
    return event;
  };
  const makeMember = async (extra: { eventReminders?: boolean; status?: "SUSPENDED" } = {}) => {
    const user = await db.user.create({
      data: {
        firstName: "Awa",
        lastName: `Rappel${++n}`,
        name: `Awa Rappel${n}`,
        email: `rappel-${n}-${tag}@e2e.agora.test`,
        status: extra.status ?? "ACTIVE",
        memberNumber: `R-${tag}-${n}`,
        eventReminders: extra.eventReminders ?? true,
        isDemo: true,
      },
    });
    users.push(user.id);
    return user;
  };
  const registerMember = (eventId: string, userId: string, status = "CONFIRMED" as const) =>
    db.eventRegistration.create({
      data: { eventId, userId, status, confirmedAt: BEFORE, createdAt: BEFORE },
    });
  const registerGuest = (
    eventId: string,
    status: "CONFIRMED" | "PENDING" = "CONFIRMED",
    token?: string,
  ) =>
    db.eventRegistration.create({
      data: {
        eventId,
        guestName: "Moussa",
        guestEmail: `invite-${++n}-${tag}@e2e.agora.test`,
        status,
        confirmedAt: status === "CONFIRMED" ? BEFORE : null,
        createdAt: BEFORE,
        tokenHash: token ? hashToken(token) : null,
      },
    });
  const run = (eventIds: string[], now = NOW) => sendEventReminders(now, { eventIds });
  const setSetting = (key: string, value: boolean) =>
    db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });

  let saved: { key: string; value: unknown }[] = [];
  beforeAll(async () => {
    saved = await db.setting.findMany({ where: { key: { in: settingKeys } } });
  });
  beforeEach(async () => {
    mail.sent.length = 0;
    mail.failures = 0;
    await setSetting("events.remindersEnabled", true);
    await setSetting("events.hideVideoWhenCardUnpaid", false);
  });

  afterAll(async () => {
    await db.setting.deleteMany({ where: { key: { in: settingKeys } } });
    for (const row of saved) {
      await db.setting.create({ data: { key: row.key, value: row.value as never } });
    }
    await db.event.deleteMany({ where: { id: { in: events } } });
    await db.membership.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("un rappel par inscrit confirmé (membre, invité) ; personne d'autre ; jamais deux fois", async () => {
    const event = await makeEvent();
    const awa = await makeMember();
    const off = await makeMember({ eventReminders: false });
    const suspended = await makeMember({ status: "SUSPENDED" });
    const cancelled = await makeMember();
    await registerMember(event.id, awa.id);
    await registerMember(event.id, off.id);
    await registerMember(event.id, suspended.id);
    await db.eventRegistration.create({
      data: { eventId: event.id, userId: cancelled.id, status: "CANCELLED", confirmedAt: BEFORE },
    });
    const guest = await registerGuest(event.id);
    await registerGuest(event.id, "PENDING");

    // Trop tôt (9 h 59 la veille) : rien.
    expect((await run([event.id], new Date("2031-03-04T09:59:00Z"))).sent).toBe(0);

    expect(await run([event.id])).toMatchObject({ sent: 2, failed: 0 });
    expect(mail.sent.map((m) => m.to).sort()).toEqual([awa.email, guest.guestEmail].sort());
    const member = mail.sent.find((m) => m.to === awa.email)!;
    expect(member.subject.replace(/\s/g, " ")).toBe(`Rappel : ${event.title}, demain à 18 h`);
    expect(member.text).toContain("Maison de la culture");
    expect(member.text).toContain("https://visio.exemple.sn/rappel");
    expect(member.text).toContain(`/events/${event.slug}/agenda.ics`);
    expect(member.text).toContain("calendar.google.com");
    expect(member.text).toContain("/member/profile");
    const invited = mail.sent.find((m) => m.to === guest.guestEmail)!;
    expect(invited.text).not.toContain("visio.exemple.sn");
    expect(invited.text).toMatch(/\/events\/registration\?token=[\w-]{40,}/);

    // Relancé plus tard dans la journée : rien de plus.
    mail.sent.length = 0;
    expect((await run([event.id], new Date("2031-03-04T15:05:00Z"))).sent).toBe(0);
    expect(mail.sent).toEqual([]);
    expect(
      await db.registrationMail.count({
        where: { registration: { eventId: event.id }, sentAt: { not: null } },
      }),
    ).toBe(2);
  });

  it("deux passages simultanés n'envoient qu'un rappel par inscription", async () => {
    const event = await makeEvent();
    const members = [await makeMember(), await makeMember(), await makeMember()];
    for (const m of members) await registerMember(event.id, m.id);
    const [a, b] = await Promise.all([run([event.id]), run([event.id])]);
    expect(a.sent + b.sent).toBe(3);
    expect(mail.sent).toHaveLength(3);
    expect(new Set(mail.sent.map((m) => m.to)).size).toBe(3);
  });

  it("rencontre annulée ou en brouillon, réglage désactivé : aucun rappel", async () => {
    const cancelledEvent = await makeEvent({ status: "CANCELLED" });
    const draft = await makeEvent({ status: "DRAFT" });
    const open = await makeEvent();
    const m = await makeMember();
    await registerMember(cancelledEvent.id, m.id);
    await registerMember(draft.id, m.id);
    await registerMember(open.id, m.id);
    expect((await run([cancelledEvent.id, draft.id])).sent).toBe(0);
    await setSetting("events.remindersEnabled", false);
    expect((await run([open.id])).sent).toBe(0);
    expect(mail.sent).toEqual([]);
  });

  it("envoi en échec : retenté au passage suivant, abandonné après 3 tentatives", async () => {
    const event = await makeEvent();
    const m = await makeMember();
    await registerMember(event.id, m.id);
    mail.failures = 1;
    expect(await run([event.id])).toMatchObject({ sent: 0, failed: 1 });
    expect(await run([event.id])).toMatchObject({ sent: 1, failed: 0 });

    const other = await makeEvent();
    const k = await makeMember();
    await registerMember(other.id, k.id);
    mail.failures = 10;
    for (let i = 0; i < 3; i++) await run([other.id]);
    expect(await run([other.id])).toMatchObject({ sent: 0, failed: 0, skipped: 1 });
    mail.failures = 0;
    expect(mail.sent.filter((s) => s.to === k.email)).toEqual([]);
  });

  it("réservation abandonnée (processus tombé) : reprise après 30 min seulement", async () => {
    const event = await makeEvent();
    const m = await makeMember();
    const registration = await registerMember(event.id, m.id);
    await db.registrationMail.create({
      data: {
        registrationId: registration.id,
        kind: "EVENT_REMINDER",
        eventStartsAt: START,
        claimedAt: new Date(NOW.getTime() - 10 * 60_000),
      },
    });
    expect(await run([event.id])).toMatchObject({ sent: 0, skipped: 1 });
    await db.registrationMail.updateMany({
      where: { registrationId: registration.id },
      data: { claimedAt: new Date(NOW.getTime() - 31 * 60_000) },
    });
    expect(await run([event.id])).toMatchObject({ sent: 1 });
  });

  it("rencontre déplacée d'une heure : nouveau rappel « horaire modifié » ; de 10 min : rien", async () => {
    const event = await makeEvent();
    const m = await makeMember();
    await registerMember(event.id, m.id);
    expect((await run([event.id])).sent).toBe(1);
    await db.event.update({
      where: { id: event.id },
      data: { startsAt: new Date(START.getTime() + 10 * 60_000) },
    });
    expect((await run([event.id])).sent).toBe(0);
    await db.event.update({
      where: { id: event.id },
      data: { startsAt: new Date(START.getTime() + 60 * 60_000) },
    });
    mail.sent.length = 0;
    expect((await run([event.id])).sent).toBe(1);
    expect(mail.sent[0]!.text).toContain("l’horaire de cette rencontre a changé");
    expect(mail.sent[0]!.subject).toMatch(/demain à 19\sh$/);
  });

  it("carte non réglée après le délai, option activée : pas de lien de visio dans le rappel", async () => {
    await setSetting("events.hideVideoWhenCardUnpaid", true);
    const event = await makeEvent();
    const late = await makeMember();
    await db.membership.create({
      data: {
        userId: late.id,
        startsAt: new Date(NOW.getTime() - 40 * DAY),
        endsAt: new Date(NOW.getTime() + 300 * DAY),
      },
    });
    await registerMember(event.id, late.id);
    expect((await run([event.id])).sent).toBe(1);
    expect(mail.sent[0]!.text).not.toContain("visio.exemple.sn");
    expect(mail.sent[0]!.text).toContain("réservé aux membres dont la carte est réglée");
  });

  it("le lien du rappel permet à l'invité de voir et d'annuler ; son premier lien reste valable", async () => {
    const event = await makeEvent();
    const first = `premier-jeton-${tag}-0123456789`;
    const guest = await registerGuest(event.id, "CONFIRMED", first);
    expect((await run([event.id])).sent).toBe(1);
    const token = /token=([\w-]+)/.exec(mail.sent[0]!.text)![1]!;
    expect((await getGuestRegistration(token))?.id).toBe(guest.id);
    expect((await getGuestRegistration(first))?.id).toBe(guest.id);
    await cancelGuestRegistration(token);
    expect(await db.eventRegistration.findUniqueOrThrow({ where: { id: guest.id } })).toMatchObject(
      { status: "CANCELLED" },
    );

    // Réinscription : le lien du rappel précédent ne vaut plus, le nouveau lien oui.
    await signUpGuest(event.id, { name: "Moussa", email: guest.guestEmail! });
    expect(await getGuestRegistration(token)).toBeNull();
    await expect(cancelGuestRegistration(token)).rejects.toMatchObject({ code: "INVALID_TOKEN" });
    await expect(cancelGuestRegistration("court")).rejects.toMatchObject({ code: "INVALID_TOKEN" });
  });
});

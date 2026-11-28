import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Carte de membre réglée à distance, sur la vraie base : encaissement avec moyen et référence,
 * rappels « carte à régler » sans doublon. Les tests créent leurs propres comptes et les retirent.
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
const sent = vi.hoisted(() => ({ mails: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (mail: { to: string; subject: string; text: string }) =>
    void sent.mails.push(mail),
}));

const { sendCardReminders } = await import("@/features/members/card-reminders");
const { recordCardPayment, cancelPayment } = await import("@/features/payments/service");

const reachable = await databaseReachable();
const DAY = 24 * 60 * 60 * 1000;

describe.skipIf(!reachable)("carte de membre à distance (base réelle)", () => {
  const tag = uniq();
  const users: string[] = [];

  /** Membre actif accepté il y a `daysAgo` jours (par rapport à `now`). */
  const member = async (now: Date, daysAgo: number) => {
    const n = users.length;
    const user = await db.user.create({
      data: {
        firstName: "Awa",
        lastName: `Carte${n}`,
        name: `Awa Carte${n}`,
        email: `carte-${n}-${tag}@e2e.agora.test`,
        emailVerified: true,
        status: "ACTIVE",
        memberNumber: `T-${tag}-${n}`,
        isDemo: true,
      },
    });
    users.push(user.id);
    const startsAt = new Date(now.getTime() - daysAgo * DAY);
    await db.membership.create({
      data: { userId: user.id, startsAt, endsAt: new Date(startsAt.getTime() + 365 * DAY) },
    });
    return user;
  };
  const staff = async () => {
    const user = await db.user.create({
      data: {
        firstName: "Moussa",
        lastName: "Caisse",
        name: "Moussa Caisse",
        email: `caisse-${tag}-${users.length}@e2e.agora.test`,
        status: "ACTIVE",
        isDemo: true,
      },
    });
    users.push(user.id);
    return user;
  };
  const mine = (run: { sent: { userId: string; kind: string }[] }) =>
    run.sent.filter((s) => users.includes(s.userId));

  // Numéro Wave du club pour ces tests, remis tel qu'il était à la fin.
  const WAVE_KEY = "payments.waveNumber";
  let savedWave: unknown = undefined;
  beforeAll(async () => {
    savedWave = (await db.setting.findUnique({ where: { key: WAVE_KEY } }))?.value;
    await db.setting.upsert({
      where: { key: WAVE_KEY },
      update: { value: "77 000 00 00" },
      create: { key: WAVE_KEY, value: "77 000 00 00" },
    });
  });

  beforeEach(() => {
    sent.mails.length = 0;
  });

  afterAll(async () => {
    if (savedWave === undefined) await db.setting.deleteMany({ where: { key: WAVE_KEY } });
    else await db.setting.update({ where: { key: WAVE_KEY }, data: { value: savedWave as never } });
    await db.payment.deleteMany({ where: { userId: { in: users } } });
    await db.notification.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await db.membership.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("rappel 7 jours après l'acceptation, puis 3 jours avant la fin du délai, sans doublon", async () => {
    const now = new Date();
    const m = await member(now, 7);
    let run = await sendCardReminders(now);
    expect(mine(run)).toEqual([{ userId: m.id, kind: "AFTER_ACCEPTANCE" }]);
    const notes = await db.notification.findMany({ where: { userId: m.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ type: "card.reminder", href: "/member/card" });
    expect(notes[0]!.body).toContain(m.memberNumber!);
    expect(notes[0]!.body).toContain("par Wave au 77 000 00 00");
    expect(notes[0]!.emailSentAt).not.toBeNull();
    expect(sent.mails.filter((mail) => mail.to === m.email)).toHaveLength(1);

    // Le même jour, puis le lendemain : rien de plus.
    expect(mine(await sendCardReminders(now))).toEqual([]);
    expect(mine(await sendCardReminders(new Date(now.getTime() + DAY)))).toEqual([]);

    // 27e jour (délai de 30 jours) : le rappel « 3 jours avant », une seule fois.
    run = await sendCardReminders(new Date(now.getTime() + 20 * DAY));
    expect(mine(run)).toEqual([{ userId: m.id, kind: "BEFORE_DEADLINE" }]);
    expect(mine(await sendCardReminders(new Date(now.getTime() + 21 * DAY)))).toEqual([]);
    expect(await db.notification.count({ where: { userId: m.id } })).toBe(2);
    expect(await db.cardReminder.count({ where: { userId: m.id } })).toBe(2);
  });

  it("deux passages simultanés n'envoient le rappel qu'une fois", async () => {
    const now = new Date();
    const m = await member(now, 8);
    const [a, b] = await Promise.all([sendCardReminders(now), sendCardReminders(now)]);
    expect([...mine(a), ...mine(b)].filter((s) => s.userId === m.id)).toHaveLength(1);
    expect(await db.notification.count({ where: { userId: m.id } })).toBe(1);
  });

  it("carte réglée : plus de rappel ; serveur éteint longtemps : seul le rappel encore utile part", async () => {
    const now = new Date();
    const actor = await staff();
    const paid = await member(now, 7);
    await recordCardPayment(
      {
        userId: paid.id,
        method: "CASH",
        reference: "",
        paidAt: new Date(now.getTime() - DAY),
        note: "",
      },
      actor.id,
    );
    expect(mine(await sendCardReminders(now)).filter((s) => s.userId === paid.id)).toEqual([]);
    const late = await member(now, 28);
    expect(mine(await sendCardReminders(now)).filter((s) => s.userId === late.id)).toEqual([
      { userId: late.id, kind: "BEFORE_DEADLINE" },
    ]);
    const past = await member(now, 31);
    expect(mine(await sendCardReminders(now)).filter((s) => s.userId === past.id)).toEqual([]);
  });

  it("encaissement Wave ou Orange Money : référence obligatoire, jamais deux fois la même", async () => {
    const now = new Date();
    const actor = await staff();
    const [a, b] = [await member(now, 2), await member(now, 2)];
    const paidAt = new Date(now.getTime() - DAY);
    await expect(
      recordCardPayment(
        { userId: a.id, method: "WAVE", reference: "  ", paidAt, note: "" },
        actor.id,
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    const reference = `T_${tag}`;
    const first = await recordCardPayment(
      { userId: a.id, method: "WAVE", reference, paidAt, note: "" },
      actor.id,
    );
    expect(await db.payment.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({
      method: "WAVE",
      reference,
    });
    // Même transaction saisie pour un autre membre (casse différente) : refusée, en nommant le
    // membre à qui elle est déjà attribuée.
    const owner = `Cette référence Wave est déjà attribuée à ${a.firstName} ${a.lastName} (n° ${a.memberNumber}).`;
    await expect(
      recordCardPayment(
        {
          userId: b.id,
          method: "WAVE",
          reference: ` ${reference.toLowerCase()} `,
          paidAt,
          note: "",
        },
        actor.id,
      ),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: owner,
      fieldErrors: { reference: owner },
    });
    // Même référence avec un autre moyen de paiement : c'est une autre transaction, acceptée.
    const other = await recordCardPayment(
      { userId: b.id, method: "ORANGE_MONEY", reference, paidAt, note: "" },
      actor.id,
    );
    await cancelPayment(other.id, "Test : autre moyen de paiement", actor.id);
    // La base le refuse aussi, sans passer par le service.
    await expect(
      db.payment.create({
        data: {
          kind: "MEMBERSHIP_CARD",
          amount: 1,
          userId: b.id,
          method: "WAVE",
          reference,
          paidAt,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      db.payment.create({
        data: { kind: "MEMBERSHIP_CARD", amount: 1, userId: b.id, method: "ORANGE_MONEY", paidAt },
      }),
    ).rejects.toThrow(/Payment_reference_check/);
    // Un encaissement annulé libère sa référence.
    await cancelPayment(first.id, "Saisi sur le mauvais membre", actor.id);
    await recordCardPayment(
      { userId: b.id, method: "WAVE", reference, paidAt, note: "" },
      actor.id,
    );
    // Deux saisies simultanées de la même référence : une seule passe ; l'autre nomme le gagnant.
    const [c, d] = [await member(now, 2), await member(now, 2)];
    const race = `R_${tag}`;
    const results = await Promise.allSettled(
      [c, d].map((m) =>
        recordCardPayment(
          { userId: m.id, method: "ORANGE_MONEY", reference: race, paidAt, note: "" },
          actor.id,
        ),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    const winner = results[0]!.status === "fulfilled" ? c : d;
    expect(refused.reason).toMatchObject({
      code: "CONFLICT",
      message: `Cette référence Orange Money est déjà attribuée à ${winner.firstName} ${winner.lastName} (n° ${winner.memberNumber}).`,
    });
    // En espèces, une référence saisie par erreur n'est pas gardée.
    const cash = await recordCardPayment(
      { userId: a.id, method: "CASH", reference: "reste", paidAt, note: "" },
      actor.id,
    );
    expect(await db.payment.findUniqueOrThrow({ where: { id: cash.id } })).toMatchObject({
      method: "CASH",
      reference: null,
    });
  });
});

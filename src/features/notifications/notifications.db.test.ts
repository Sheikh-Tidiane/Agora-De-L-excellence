import { describe, expect, it, vi } from "vitest";
import { databaseReachable, inRollback, realPrisma, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const {
  countUnread,
  createNotifications,
  listNotifications,
  markAllRead,
  markRead,
  notificationEmail,
} = await import("@/features/notifications/service");

type Tx = Parameters<Parameters<typeof realPrisma.$transaction>[0]>[0];
const reachable = await databaseReachable();

async function member(tx: Tx) {
  const u = uniq();
  return tx.user.create({
    data: {
      name: `Test ${u}`,
      firstName: "Test",
      lastName: `Notif${u}`,
      email: `vitest-notif-${u}@test.localhost`,
      status: "ACTIVE",
      isDemo: true,
    },
  });
}

const sample = (userId: string, title = "Lecture validée : Une si longue lettre") => ({
  userId,
  type: "reading.validated" as const,
  title,
  body: "Un responsable a validé votre lecture.",
  href: "/member/readings",
});

describe.skipIf(!reachable)("notifications (base réelle, transaction annulée)", () => {
  it("crée, compte, liste du plus récent au plus ancien", async () => {
    await inRollback(async (tx) => {
      const awa = await member(tx);
      await createNotifications([sample(awa.id, "Première")], tx);
      await createNotifications([sample(awa.id, "Seconde")], tx);
      expect(await countUnread(awa.id, tx)).toBe(2);
      const list = await listNotifications(awa.id, tx);
      expect(list.map((n) => n.title)).toHaveLength(2);
      expect(list.every((n) => n.readAt === null)).toBe(true);
    });
  });

  it("marque comme lue sa propre notification seulement", async () => {
    await inRollback(async (tx) => {
      const awa = await member(tx);
      const moussa = await member(tx);
      const [id] = await createNotifications([sample(awa.id)], tx);
      await expect(markRead(moussa.id, id, tx)).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(await countUnread(awa.id, tx)).toBe(1);
      await markRead(awa.id, id, tx);
      // Une seconde fois : sans erreur, sans changer la date.
      await markRead(awa.id, id, tx);
      expect(await countUnread(awa.id, tx)).toBe(0);
    });
  });

  it("tout marquer comme lu ne touche pas aux autres membres", async () => {
    await inRollback(async (tx) => {
      const awa = await member(tx);
      const moussa = await member(tx);
      await createNotifications([sample(awa.id), sample(awa.id), sample(moussa.id)], tx);
      expect(await markAllRead(awa.id, tx)).toBe(2);
      expect(await countUnread(awa.id, tx)).toBe(0);
      expect(await countUnread(moussa.id, tx)).toBe(1);
    });
  });

  it("refuse un lien externe et tronque les textes trop longs", async () => {
    await inRollback(async (tx) => {
      const awa = await member(tx);
      await expect(
        createNotifications([{ ...sample(awa.id), href: "https://ailleurs.example" }], tx),
      ).rejects.toMatchObject({ code: "VALIDATION" });
      const [id] = await createNotifications([{ ...sample(awa.id), body: "x".repeat(2000) }], tx);
      const row = await tx.notification.findUniqueOrThrow({ where: { id } });
      expect(row.body.length).toBe(600);
    });
  });
});

describe("e-mail de notification", () => {
  it("échappe le contenu et pointe vers l'espace membre", () => {
    const mail = notificationEmail({
      to: "awa@test.localhost",
      firstName: "Awa",
      type: "review.approved",
      title: "Critique approuvée : <b>Sous l’orage</b>",
      body: "Votre critique a été approuvée.",
      href: "/member/readings",
    });
    expect(mail.html).not.toContain("<b>Sous");
    expect(mail.html).toContain("/member/readings");
    expect(mail.text).toContain("Bonjour Awa");
  });
});

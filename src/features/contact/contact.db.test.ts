import { afterEach, describe, expect, it, vi } from "vitest";
import { setMailService, type MailMessage } from "@/lib/mail";
import { databaseReachable, inRollback, realPrisma, uniq } from "@/test/real-db";

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const {
  countNewContactMessages,
  purgeHandledContactMessages,
  recordContactMessage,
  setContactMessageStatus,
} = await import("@/features/contact/service");

type Tx = Parameters<Parameters<typeof realPrisma.$transaction>[0]>[0];
const reachable = await databaseReachable();

const sent: MailMessage[] = [];
const workingMail = { send: async (message: MailMessage) => void sent.push(message) };
const brokenMail = {
  send: async () => {
    throw new Error("SMTP injoignable");
  },
};

afterEach(() => {
  setMailService(undefined);
  sent.length = 0;
  vi.restoreAllMocks();
});

const sample = () => ({
  name: "Awa Diop",
  email: `vitest-contact-${uniq()}@test.localhost`,
  subject: "Une question sur les rencontres",
  message: "Bonjour, à quelle heure commencent les rencontres du samedi ?",
});

async function responsable(tx: Tx) {
  const u = uniq();
  return tx.user.create({
    data: {
      name: `Responsable ${u}`,
      firstName: "Responsable",
      lastName: u,
      email: `vitest-contact-admin-${u}@test.localhost`,
      status: "ACTIVE",
      isDemo: true,
    },
  });
}

describe.skipIf(!reachable)("messages de contact (base réelle, transaction annulée)", () => {
  it("enregistre le message, prévient le club et note l'envoi", async () => {
    setMailService(workingMail);
    await inRollback(async (tx) => {
      const input = sample();
      const before = await countNewContactMessages(tx);
      const { id, emailSent } = await recordContactMessage(input, "club@test.localhost", tx);
      expect(emailSent).toBe(true);
      const saved = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
      expect(saved).toMatchObject({ ...input, status: "NEW", emailSent: true, readAt: null });
      expect(await countNewContactMessages(tx)).toBe(before + 1);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: "club@test.localhost", replyTo: input.email });
    });
  });

  it("garde le message si l'e-mail échoue ou si le club n'a pas d'adresse", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setMailService(brokenMail);
    await inRollback(async (tx) => {
      const failed = await recordContactMessage(sample(), "club@test.localhost", tx);
      expect(failed.emailSent).toBe(false);
      const noAddress = await recordContactMessage(sample(), null, tx);
      expect(noAddress.emailSent).toBe(false);
      const rows = await tx.contactMessage.findMany({
        where: { id: { in: [failed.id, noAddress.id] } },
      });
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.status === "NEW" && !row.emailSent)).toBe(true);
    });
  });

  it("passe de nouveau à lu puis traité, trace chaque changement, et rouvre", async () => {
    setMailService(workingMail);
    await inRollback(async (tx) => {
      const actor = await responsable(tx);
      const { id } = await recordContactMessage(sample(), null, tx);
      const t1 = new Date("2026-11-20T10:00:00Z");
      const t2 = new Date("2026-11-21T10:00:00Z");

      await setContactMessageStatus(id, "READ", actor.id, tx, t1);
      let row = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: "READ", readAt: t1, handledAt: null });

      await setContactMessageStatus(id, "HANDLED", actor.id, tx, t2);
      row = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
      // La première lecture est gardée ; le traitement est daté et attribué.
      expect(row).toMatchObject({
        status: "HANDLED",
        readAt: t1,
        handledAt: t2,
        handledById: actor.id,
      });

      // Même statut : rien ne change, rien n'est tracé.
      await setContactMessageStatus(id, "HANDLED", actor.id, tx);

      await setContactMessageStatus(id, "NEW", actor.id, tx);
      row = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({
        status: "NEW",
        readAt: null,
        handledAt: null,
        handledById: null,
      });

      const logs = await tx.auditLog.findMany({
        where: { entityType: "ContactMessage", entityId: id },
        orderBy: { createdAt: "asc" },
      });
      expect(logs.map((log) => log.metadata)).toEqual([
        { from: "NEW", to: "READ" },
        { from: "READ", to: "HANDLED" },
        { from: "HANDLED", to: "NEW" },
      ]);
      expect(logs.every((log) => log.action === "contact.status_changed")).toBe(true);
    });
  });

  it("refuse un message inconnu", async () => {
    await inRollback(async (tx) => {
      const actor = await responsable(tx);
      await expect(
        setContactMessageStatus("inexistant", "READ", actor.id, tx),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  it("supprime les messages traités depuis plus de 12 mois, et eux seulement", async () => {
    const now = new Date("2026-11-22T12:00:00Z");
    await inRollback(async (tx) => {
      const old = new Date("2025-11-01T12:00:00Z");
      const recent = new Date("2026-01-01T12:00:00Z");
      const make = (data: { status: "NEW" | "READ" | "HANDLED"; handledAt?: Date }) =>
        tx.contactMessage.create({ data: { ...sample(), ...data, createdAt: old } });
      const oldHandled = await make({ status: "HANDLED", handledAt: old });
      const recentHandled = await make({ status: "HANDLED", handledAt: recent });
      const oldUnread = await make({ status: "NEW" });
      const oldRead = await make({ status: "READ" });

      expect(await purgeHandledContactMessages(12, now, tx)).toBeGreaterThanOrEqual(1);
      const left = await tx.contactMessage.findMany({
        where: { id: { in: [oldHandled.id, recentHandled.id, oldUnread.id, oldRead.id] } },
        select: { id: true },
      });
      expect(left.map((row) => row.id).sort()).toEqual(
        [recentHandled.id, oldUnread.id, oldRead.id].sort(),
      );
    });
  });
});

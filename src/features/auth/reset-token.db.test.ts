import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Jeton de réinitialisation du mot de passe, avec le vrai Better Auth et la vraie base :
 * seule son empreinte est stockée, le lien reçu fonctionne, et un ancien jeton stocké en clair
 * (avant ce changement) ne fonctionne plus.
 */
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": `192.0.2.${Math.floor(Math.random() * 250) + 1}` }),
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => undefined,
  }),
}));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
const sent = vi.hoisted(() => ({ mails: [] as { to: string; subject: string; text: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (mail: { to: string; subject: string; text: string }) =>
    void sent.mails.push(mail),
}));

const { forgotPasswordAction, resetPasswordAction } = await import("@/features/auth/actions");

const reachable = await databaseReachable();

/** Empreinte calculée comme Better Auth (« hashed ») : SHA-256, base64url sans remplissage. */
const betterAuthHash = (identifier: string) =>
  createHash("sha256").update(identifier).digest("base64url");

describe.skipIf(!reachable)("jeton de réinitialisation du mot de passe", () => {
  const email = `reinit-${uniq()}@e2e.agora.test`;
  let userId = "";

  beforeAll(async () => {
    const user = await db.user.create({
      data: {
        firstName: "Awa",
        lastName: "Essai",
        name: "Awa Essai",
        email,
        emailVerified: true,
        status: "ACTIVE",
      },
    });
    userId = user.id;
    await db.account.create({
      data: {
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        password: await hashPassword("ancienne phrase de passe"),
      },
    });
  });

  beforeEach(() => {
    sent.mails.length = 0;
  });

  afterAll(async () => {
    await db.verification.deleteMany({ where: { value: userId } });
    await db.auditLog.deleteMany({ where: { entityId: userId } });
    await db.session.deleteMany({ where: { userId } });
    await db.account.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  const tokenFromMail = () => {
    const mail = sent.mails.find((m) => m.to === email && m.subject.includes("mot de passe"));
    expect(mail, "e-mail de réinitialisation").toBeTruthy();
    const url = mail!.text.split(/\s+/).find((w) => w.includes("/reset-password?token="))!;
    return new URL(url).searchParams.get("token")!;
  };

  it("seule l'empreinte du jeton est stockée, et le lien reçu change le mot de passe", async () => {
    expect((await forgotPasswordAction({ email })).ok).toBe(true);
    const token = tokenFromMail();
    expect(token.length).toBeGreaterThan(20);

    const rows = await db.verification.findMany({ where: { value: userId } });
    expect(rows).toHaveLength(1);
    // Le jeton n'apparaît nulle part en base ; l'identifiant est son empreinte.
    expect(rows[0]!.identifier).not.toContain(token);
    expect(rows[0]!.identifier.startsWith("reset-password:")).toBe(false);
    expect(rows[0]!.identifier).toBe(betterAuthHash(`reset-password:${token}`));

    const result = await resetPasswordAction({
      token,
      password: "nouvelle phrase de passe",
      confirmation: "nouvelle phrase de passe",
    });
    expect(result).toEqual({ ok: true, data: undefined });
    const account = await db.account.findFirstOrThrow({ where: { userId } });
    expect(
      await verifyPassword({ hash: account.password!, password: "nouvelle phrase de passe" }),
    ).toBe(true);
    // Usage unique : le jeton est consommé.
    expect(await db.verification.count({ where: { value: userId } })).toBe(0);
    const again = await resetPasswordAction({
      token,
      password: "encore une autre phrase",
      confirmation: "encore une autre phrase",
    });
    expect(again).toMatchObject({ ok: false, code: "INVALID_TOKEN" });
  });

  it("un ancien jeton stocké en clair ne fonctionne plus, et il est supprimé", async () => {
    const legacy = randomBytes(18).toString("base64url");
    await db.verification.create({
      data: {
        identifier: `reset-password:${legacy}`,
        value: userId,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const result = await resetPasswordAction({
      token: legacy,
      password: "phrase posée par un intrus",
      confirmation: "phrase posée par un intrus",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_TOKEN" });
    const account = await db.account.findFirstOrThrow({ where: { userId } });
    expect(
      await verifyPassword({ hash: account.password!, password: "phrase posée par un intrus" }),
    ).toBe(false);
    expect(await db.verification.count({ where: { identifier: `reset-password:${legacy}` } })).toBe(
      0,
    );
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARD_TOKEN_MAX_LENGTH,
  checkCardToken,
  deriveCardKey,
  newCardSerial,
  signCardToken,
} from "@/features/members/card-token";

/**
 * Jeton du QR de la carte de membre : signature, falsification, révocation, statut du compte,
 * absence de donnée personnelle. La base est remplacée par une petite table en mémoire.
 */
type Row = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberNumber: string | null;
  image: string | null;
  status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  cardSerial: string | null;
  cardVersion: number;
  cardIssuedAt: Date | null;
};

const store = new Map<string, Row>();
const audits: { action: string; entityId: string; metadata: Record<string, unknown> }[] = [];

function pick(row: Row | undefined, select?: Record<string, boolean>) {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(Object.keys(select).map((key) => [key, row[key as keyof Row]]));
}

const fakeDb = {
  user: {
    findUnique: vi.fn(
      async ({ where, select }: { where: Partial<Row>; select?: Record<string, boolean> }) => {
        const row = where.id
          ? store.get(where.id)
          : [...store.values()].find((r) => r.cardSerial === where.cardSerial);
        return pick(row, select);
      },
    ),
    findUniqueOrThrow: vi.fn(
      async ({ where, select }: { where: { id: string }; select?: Record<string, boolean> }) => {
        const row = store.get(where.id);
        if (!row) throw new Error("introuvable");
        return pick(row, select);
      },
    ),
    updateMany: vi.fn(async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const row = store.get(where.id!);
      if (!row || (where.cardSerial === null && row.cardSerial !== null)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }),
    update: vi.fn(
      async ({
        where,
        data,
        select,
      }: {
        where: { id: string };
        data: { cardVersion: { increment: number }; cardIssuedAt: Date };
        select?: Record<string, boolean>;
      }) => {
        const row = store.get(where.id)!;
        row.cardVersion += data.cardVersion.increment;
        row.cardIssuedAt = data.cardIssuedAt;
        return pick(row, select);
      },
    ),
  },
  auditLog: {
    create: vi.fn(async ({ data }: { data: (typeof audits)[number] }) => void audits.push(data)),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: { ...fakeDb, $transaction: (fn: (tx: typeof fakeDb) => unknown) => fn(fakeDb) },
}));

const { cardQrSvg, cardRejectionMessages, issueCardToken, revokeCardToken, verifyCardToken } =
  await import("@/features/members/card-service");

function addMember(overrides: Partial<Row> = {}): Row {
  const row: Row = {
    id: "ckmembre00000000000000001",
    firstName: "Awa",
    lastName: "Ndiaye",
    email: "awa.ndiaye@exemple.sn",
    memberNumber: "AE-2026-0007",
    image: null,
    status: "ACTIVE",
    cardSerial: null,
    cardVersion: 1,
    cardIssuedAt: null,
    ...overrides,
  };
  store.set(row.id, row);
  return row;
}

/** Remplace un caractère (position comptée depuis la fin si négative) par un autre caractère permis. */
function flip(token: string, index: number): string {
  const i = index < 0 ? token.length + index : index;
  const replacement = token[i] === "A" ? "B" : "A";
  return token.slice(0, i) + replacement + token.slice(i + 1);
}

beforeEach(() => {
  store.clear();
  audits.length = 0;
  vi.clearAllMocks();
});

describe("format et signature (sans base)", () => {
  const key = deriveCardKey("secret-de-test-uniquement-0123456789abcdef");

  it("un jeton signé se relit à l'identique", () => {
    const serial = newCardSerial();
    const token = signCardToken({ serial, version: 3 }, key);
    expect(token).toMatch(/^A1\.[A-Za-z0-9_-]{16}\.3\.[A-Za-z0-9_-]{22}$/);
    expect(token.length).toBeLessThanOrEqual(CARD_TOKEN_MAX_LENGTH);
    expect(checkCardToken(token, key)).toEqual({ ok: true, payload: { serial, version: 3 } });
  });

  it("les blancs ajoutés par un lecteur de QR sont tolérés", () => {
    const token = signCardToken({ serial: newCardSerial(), version: 1 }, key);
    expect(checkCardToken(`  ${token}\n`, key).ok).toBe(true);
  });

  it("chaque série est différente et imprévisible", () => {
    const serials = new Set(Array.from({ length: 500 }, newCardSerial));
    expect(serials.size).toBe(500);
  });

  it("la clé des cartes est dérivée : ni le secret lui-même, ni la même clé pour un autre secret", () => {
    const secret = "secret-de-test-uniquement-0123456789abcdef";
    expect(deriveCardKey(secret).equals(Buffer.from(secret).subarray(0, 32))).toBe(false);
    expect(deriveCardKey(secret).equals(deriveCardKey(`${secret}!`))).toBe(false);
    expect(() => deriveCardKey("court")).toThrow();
  });

  it("un jeton signé avec un autre secret est rejeté", () => {
    const other = deriveCardKey("un-autre-secret-de-test-0123456789abcdef");
    const token = signCardToken({ serial: newCardSerial(), version: 1 }, other);
    expect(checkCardToken(token, key)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("refuse de signer une série ou une version invalide", () => {
    expect(() => signCardToken({ serial: "court", version: 1 }, key)).toThrow();
    expect(() => signCardToken({ serial: newCardSerial(), version: 0 }, key)).toThrow();
    expect(() => signCardToken({ serial: newCardSerial(), version: 1.5 }, key)).toThrow();
  });
});

describe("falsification", () => {
  let token: string;
  beforeEach(async () => {
    addMember();
    token = await issueCardToken("ckmembre00000000000000001");
  });

  it("le jeton intact est accepté", async () => {
    expect(await verifyCardToken(token)).toMatchObject({ ok: true });
  });

  it.each([
    ["signature altérée", (t: string) => flip(t, -1)],
    ["signature altérée au milieu", (t: string) => flip(t, -10)],
    ["série altérée", (t: string) => flip(t, 3)],
    ["version augmentée", (t: string) => t.replace(".1.", ".2.")],
    ["série d'un autre", (t: string) => `A1.${newCardSerial()}${t.slice(19)}`],
  ])("%s : signature refusée, sans lecture en base", async (_label, alter) => {
    const forged = alter(token);
    expect(forged).not.toBe(token);
    fakeDb.user.findUnique.mockClear();
    expect(await verifyCardToken(forged)).toEqual({ ok: false, reason: "bad_signature" });
    expect(fakeDb.user.findUnique).not.toHaveBeenCalled();
  });

  it.each([
    ["tronqué", (t: string) => t.slice(0, -1)],
    ["tronqué de moitié", (t: string) => t.slice(0, 20)],
    ["allongé", (t: string) => `${t}A`],
    ["autre préfixe", (t: string) => `B1${t.slice(2)}`],
    ["version zéro", (t: string) => t.replace(".1.", ".0.")],
    ["version négative", (t: string) => t.replace(".1.", ".-1.")],
    ["caractère hors base64url", (t: string) => `${t.slice(0, -1)}=`],
    ["adresse d'un autre QR", () => "https://exemple.sn/membership#demande"],
    ["vide", () => ""],
    ["démesuré", () => "A".repeat(10_000)],
  ])("%s : format refusé", async (_label, alter) => {
    expect(await verifyCardToken(alter(token))).toEqual({ ok: false, reason: "malformed" });
  });

  it.each([null, undefined, 42, {}, ["A1"]])("entrée %j : format refusé", async (value) => {
    expect(await verifyCardToken(value)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("émission, révocation et statut du compte", () => {
  it("crée la série à la première émission, puis renvoie toujours le même jeton", async () => {
    const member = addMember();
    const first = await issueCardToken(member.id);
    expect(member.cardSerial).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(member.cardIssuedAt).toBeInstanceOf(Date);
    expect(await issueCardToken(member.id)).toBe(first);
    expect(fakeDb.user.updateMany).toHaveBeenCalledTimes(1);
  });

  it("le membre scanné est résolu, avec de quoi le reconnaître et rien d'autre", async () => {
    const member = addMember({ image: "avatars/abc.webp" });
    const result = await verifyCardToken(await issueCardToken(member.id));
    expect(result).toEqual({
      ok: true,
      member: {
        id: member.id,
        firstName: "Awa",
        lastName: "Ndiaye",
        memberNumber: "AE-2026-0007",
        image: "avatars/abc.webp",
      },
    });
  });

  it("une carte révoquée est refusée ; la nouvelle est acceptée ; la révocation est tracée", async () => {
    const member = addMember();
    const old = await issueCardToken(member.id);
    const { version } = await revokeCardToken(
      member.id,
      member.id,
      "Carte remplacée par le membre",
    );
    expect(version).toBe(2);
    expect(await verifyCardToken(old)).toEqual({ ok: false, reason: "revoked" });
    const fresh = await issueCardToken(member.id);
    expect(fresh).not.toBe(old);
    expect(await verifyCardToken(fresh)).toMatchObject({ ok: true });
    expect(audits).toEqual([
      expect.objectContaining({
        action: "member.card_revoked",
        entityId: member.id,
        metadata: expect.objectContaining({ version: 2, byMember: true }),
      }),
    ]);
  });

  it("révoquer la carte d'un membre inconnu : NOT_FOUND, rien d'écrit", async () => {
    await expect(revokeCardToken("inconnu", null, "test")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(audits).toEqual([]);
  });

  it.each([
    ["SUSPENDED", "suspended"],
    ["ARCHIVED", "archived"],
    ["PENDING_ACTIVATION", "not_activated"],
  ] as const)("compte %s : carte refusée (%s)", async (status, reason) => {
    const member = addMember();
    const token = await issueCardToken(member.id);
    member.status = status;
    expect(await verifyCardToken(token)).toEqual({ ok: false, reason });
    expect(cardRejectionMessages[reason]).toBeTruthy();
  });

  it("pas de carte pour un compte qui n'est pas actif, ni pour un compte inconnu", async () => {
    addMember({ status: "SUSPENDED" });
    await expect(issueCardToken("ckmembre00000000000000001")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(issueCardToken("inconnu")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("une carte dont la série n'existe plus en base est inconnue", async () => {
    const member = addMember();
    const token = await issueCardToken(member.id);
    store.delete(member.id);
    expect(await verifyCardToken(token)).toEqual({ ok: false, reason: "unknown_card" });
  });
});

describe("aucune donnée personnelle", () => {
  it("le jeton ne contient ni nom, ni e-mail, ni numéro de membre, ni identifiant du compte", async () => {
    const member = addMember();
    const token = await issueCardToken(member.id);
    const decoded = token
      .split(".")
      .map((part) => Buffer.from(part, "base64url").toString("latin1"))
      .join(" ");
    for (const secret of [
      member.id,
      member.firstName,
      member.lastName,
      member.email,
      member.memberNumber!,
      "2026-0007",
      "0007",
    ]) {
      expect(token.toLowerCase()).not.toContain(secret.toLowerCase());
      expect(decoded.toLowerCase()).not.toContain(secret.toLowerCase());
    }
  });

  it("l'image du QR est un SVG autonome, sans le jeton en clair", async () => {
    const member = addMember();
    const token = await issueCardToken(member.id);
    const svg = await cardQrSvg(token);
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg).not.toContain(token);
    expect(svg).not.toContain("<script");
    expect(svg).toMatch(/#1f2a55/i);
  });
});

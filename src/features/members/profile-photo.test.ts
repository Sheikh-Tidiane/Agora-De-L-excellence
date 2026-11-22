import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StorageService } from "@/lib/storage";

/**
 * Photo de profil : aucune photo ne reste sur le disque sans être référencée (envois simultanés),
 * et l'archivage (anonymisation) l'efface. La base est une petite table en mémoire.
 */
const users = new Map<string, { id: string; image: string | null; status: string }>();

const user = {
  findUnique: vi.fn(async ({ where, select }: { where: { id: string }; select?: object }) => {
    const row = users.get(where.id);
    if (!row) return null;
    return select && "roles" in select ? { ...row, roles: [] } : { ...row };
  }),
  findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
    const row = users.get(where.id);
    if (!row) throw new Error("introuvable");
    return { ...row };
  }),
  updateMany: vi.fn(
    async ({ where, data }: { where: { id: string; image?: string | null }; data: object }) => {
      const row = users.get(where.id);
      if (!row || ("image" in where && row.image !== where.image)) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  ),
  update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
    const row = users.get(where.id)!;
    Object.assign(row, data);
    return { ...row };
  }),
};
const anyModel = () => ({ deleteMany: vi.fn(async () => ({ count: 0 })), updateMany: vi.fn() });
const tx = {
  user,
  session: anyModel(),
  account: anyModel(),
  verification: anyModel(),
  userRole: anyModel(),
  membership: anyModel(),
  membershipRequest: anyModel(),
  auditLog: { create: vi.fn(async () => ({})) },
};

vi.mock("@/lib/prisma", () => ({
  prisma: { ...tx, $transaction: async (fn: (db: typeof tx) => unknown) => fn(tx) },
}));
vi.mock("@/lib/storage", () => ({ storage: {}, MAX_IMAGE_BYTES: 2 * 1024 * 1024 }));
vi.mock("@/features/settings/club", () => ({ loadClubSettings: vi.fn() }));

const { setOwnPhoto, removeOwnPhoto } = await import("@/features/members/profile-service");
const { archiveMember } = await import("@/features/members/service");

function fakeStore() {
  const files = new Set<string>();
  let counter = 0;
  const store: StorageService = {
    saveImage: vi.fn(async (folder) => {
      const name = `${folder}/${String(++counter).padStart(32, "0")}.png`;
      files.add(name);
      return name;
    }),
    read: vi.fn(async () => null),
    remove: vi.fn(async (name: string) => void files.delete(name)),
  };
  return { store, files };
}

const admin = {
  id: "admin",
  firstName: "A",
  lastName: "B",
  name: "A B",
  email: "a@b.c",
  memberNumber: null,
  roles: ["admin"],
  permissions: ["members.manage", "admin.access"],
};

beforeEach(() => {
  users.clear();
  users.set("m1", { id: "m1", image: null, status: "ACTIVE" });
});

describe("photo de profil", () => {
  it("remplace la photo et efface l'ancienne du disque", async () => {
    const { store, files } = fakeStore();
    const first = await setOwnPhoto("m1", new Uint8Array([1]), store);
    const second = await setOwnPhoto("m1", new Uint8Array([2]), store);
    expect(users.get("m1")!.image).toBe(second);
    expect([...files]).toEqual([second]);
    expect(first).not.toBe(second);
  });

  it("deux envois simultanés ne laissent aucun fichier orphelin", async () => {
    const { store, files } = fakeStore();
    const results = await Promise.allSettled([
      setOwnPhoto("m1", new Uint8Array([1]), store),
      setOwnPhoto("m1", new Uint8Array([2]), store),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { code: "CONFLICT" },
    });
    // Seul le fichier référencé en base reste sur le disque.
    expect([...files]).toEqual([users.get("m1")!.image]);
  });

  it("retirer la photo l'efface de la base et du disque", async () => {
    const { store, files } = fakeStore();
    await setOwnPhoto("m1", new Uint8Array([1]), store);
    await removeOwnPhoto("m1", store);
    expect(users.get("m1")!.image).toBeNull();
    expect(files.size).toBe(0);
  });

  it("l'archivage d'un membre efface sa photo du disque", async () => {
    const { store, files } = fakeStore();
    await setOwnPhoto("m1", new Uint8Array([1]), store);
    await archiveMember("m1", admin, store);
    expect(users.get("m1")).toMatchObject({ status: "ARCHIVED", image: null });
    expect(files.size).toBe(0);
  });
});

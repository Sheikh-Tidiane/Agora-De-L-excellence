import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as exportRegistrations } from "@/app/api/admin/events/[id]/registrations/route";
import { POST as askAssistant } from "@/app/api/assistant/route";
import { POST as upload } from "@/app/api/admin/uploads/route";
import { GET as servePhoto } from "@/app/api/member/photo/[...path]/route";
import { DELETE as removePhoto, POST as uploadPhoto } from "@/app/api/member/photo/route";
import { GET as serveUpload } from "@/app/uploads/[...path]/route";
import { storedImageName } from "@/lib/storage-names";
import {
  ACTOR_ID,
  ROLE_CODES,
  businessTargets,
  resetWorld,
  roleHasAny,
  world,
} from "@/test/security-harness";

/**
 * Route Handlers appelés directement (critères 8 et 9 de la recette) : 401 sans session,
 * 403 sans la permission, 4xx sur une entrée invalide. Session et base : src/test/security-harness.ts.
 * Le disque est simulé : aucune image n'est écrite ni lue pendant les tests.
 */
const disk = vi.hoisted(() => ({
  mkdir: vi.fn(async () => undefined),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async (): Promise<Buffer> => {
    throw new Error("ENOENT");
  }),
  unlink: vi.fn(async () => undefined),
}));

vi.mock("node:fs/promises", () => ({ ...disk, default: disk }));
vi.mock("next/headers", async () => (await import("@/test/security-harness")).headersModule);
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/auth", async () => (await import("@/test/security-harness")).authModule);
vi.mock("@/lib/prisma", async () => (await import("@/test/security-harness")).prismaModule);

beforeEach(() => {
  resetWorld();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const HEX = "0123456789abcdef0123456789abcdef";

function uploadRequest(folder: string | null, file?: Blob, headers?: Record<string, string>) {
  const form = new FormData();
  if (file) form.set("file", file, "../../photo de vacances.php");
  const query = folder === null ? "" : `?folder=${encodeURIComponent(folder)}`;
  return new Request(`http://localhost/api/admin/uploads${query}`, {
    method: "POST",
    body: form,
    headers,
  });
}
const png = () => new Blob([PNG], { type: "image/png" });

describe("POST /api/admin/uploads", () => {
  const folders = [
    { folder: "covers", permission: "books.manage" },
    { folder: "committee", permission: "settings.manage" },
  ] as const;

  it.each(["covers", "committee", "inconnu", "../covers"])(
    "sans session, dossier « %s » : 401, rien n'est écrit",
    async (folder) => {
      const response = await upload(uploadRequest(folder, png()));
      expect(response.status).toBe(401);
      expect(disk.writeFile).not.toHaveBeenCalled();
      expect(businessTargets()).toEqual([]);
    },
  );

  describe.each(folders)("dossier $folder (permission $permission)", ({ folder, permission }) => {
    it.each(ROLE_CODES)("rôle %s", async (role) => {
      world.role = role;
      const response = await upload(uploadRequest(folder, png()));
      if (roleHasAny(role, [permission])) {
        expect(response.status).toBe(200);
        const body = (await response.json()) as { name: string; url: string };
        // Nom régénéré : rien du nom d'origine, dossier demandé.
        expect(body.name).toMatch(storedImageName);
        expect(body.name.startsWith(`${folder}/`)).toBe(true);
        expect(disk.writeFile).toHaveBeenCalledTimes(1);
      } else {
        expect(response.status).toBe(403);
        expect(disk.writeFile).not.toHaveBeenCalled();
      }
      expect(businessTargets()).toEqual([]);
    });
  });

  it("dossier par défaut : celui des couvertures, donc refusé à qui ne gère pas la bibliothèque", async () => {
    world.role = "communication";
    expect((await upload(uploadRequest(null, png()))).status).toBe(403);
  });

  const invalid: [string, () => Request][] = [
    ["dossier inconnu", () => uploadRequest("avatars", png())],
    ["dossier avec « .. »", () => uploadRequest("../covers", png())],
    ["dossier vide", () => uploadRequest("", png())],
    ["aucun fichier", () => uploadRequest("covers")],
    ["fichier vide", () => uploadRequest("covers", new Blob([]))],
    [
      "script déguisé en image (type annoncé image/png)",
      () => uploadRequest("covers", new Blob(["<?php echo 1;"], { type: "image/png" })),
    ],
    [
      "SVG (peut contenir du script)",
      () => uploadRequest("covers", new Blob(["<svg onload='x'/>"], { type: "image/svg+xml" })),
    ],
    [
      "image de plus de 2 Mo",
      () => uploadRequest("covers", new Blob([PNG, new Uint8Array(2 * 1024 * 1024)])),
    ],
    [
      "taille annoncée énorme",
      () => uploadRequest("covers", png(), { "content-length": String(50 * 1024 * 1024) }),
    ],
    [
      "champ « file » texte au lieu d'un fichier",
      () => {
        const form = new FormData();
        form.set("file", "covers/../../etc/passwd");
        return new Request("http://localhost/api/admin/uploads", { method: "POST", body: form });
      },
    ],
    [
      "corps JSON au lieu d'un formulaire",
      () =>
        new Request("http://localhost/api/admin/uploads", {
          method: "POST",
          body: JSON.stringify({ file: "x" }),
          headers: { "content-type": "application/json" },
        }),
    ],
  ];

  it.each(invalid)("%s : 422, rien n'est écrit", async (_label, request) => {
    world.role = "super_admin";
    const response = await upload(request());
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(disk.writeFile).not.toHaveBeenCalled();
    expect(businessTargets()).toEqual([]);
  });
});

describe("GET /api/admin/events/[id]/registrations", () => {
  const call = (id: string) =>
    exportRegistrations(new Request(`http://localhost/api/admin/events/x/registrations`), {
      params: Promise.resolve({ id }),
    });

  it("sans session : 401, aucune lecture", async () => {
    expect((await call(ID)).status).toBe(401);
    expect(businessTargets()).toEqual([]);
  });

  it.each(ROLE_CODES)("rôle %s : il faut `data.export` ET `events.manage`", async (role) => {
    world.role = role;
    world.handlers["event.findUnique"] = () => null;
    const response = await call(ID);
    if (roleHasAny(role, ["data.export"]) && roleHasAny(role, ["events.manage"])) {
      expect(response.status).toBe(404);
      expect(businessTargets()).toEqual(["event.findUnique"]);
    } else {
      expect(response.status).toBe(403);
      expect(businessTargets()).toEqual([]);
    }
  });

  it.each(["../../members", "a b", "x".repeat(41), "", "id;DROP TABLE", "%2e%2e"])(
    "identifiant mal formé « %s » : 404, aucune lecture",
    async (id) => {
      world.role = "super_admin";
      expect((await call(id)).status).toBe(404);
      expect(businessTargets()).toEqual([]);
    },
  );

  it("export réussi : CSV non mis en cache, formules neutralisées, tracé dans le journal", async () => {
    world.role = "admin";
    world.handlers["event.findUnique"] = () => ({
      title: "Rendez-vous lecture",
      registrations: [
        {
          userId: null,
          user: null,
          guestName: '=HYPERLINK("http://exemple.test")',
          guestEmail: "invite@exemple.test",
          status: "CONFIRMED",
          createdAt: new Date("2026-11-01T10:00:00Z"),
          attendedAt: null,
        },
      ],
    });
    world.handlers["auditLog.create"] = () => ({});
    const response = await call(ID);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("'=HYPERLINK");
    expect(businessTargets()).toEqual(["event.findUnique", "auditLog.create"]);
    expect(world.calls[1]!.args[0]).toMatchObject({
      data: { action: "data.exported", entityId: ID, metadata: { rows: 1 } },
    });
  });
});

describe("GET /uploads/[...path]", () => {
  const call = (...path: string[]) =>
    serveUpload(new Request("http://localhost/uploads/x"), { params: Promise.resolve({ path }) });

  it.each([
    ["..", "..", ".env"],
    ["covers", "..", "..", ".env"],
    ["covers", `..%2f${HEX}.jpg`],
    ["covers", `${HEX}.svg`],
    ["covers", `${HEX}.jpg.php`],
    ["covers", "abc.jpg"],
    ["members", `${HEX}.jpg`],
    ["covers", "sous-dossier", `${HEX}.jpg`],
    [`covers\\${HEX}.jpg`],
    [],
  ])("chemin hors du stockage %j : 404, le disque n'est pas lu", async (...path) => {
    const response = await call(...path);
    expect(response.status).toBe(404);
    expect(disk.readFile).not.toHaveBeenCalled();
  });

  it("image connue : servie avec son type et `nosniff`", async () => {
    disk.readFile.mockResolvedValueOnce(Buffer.from(PNG));
    const response = await call("committee", `${HEX}.png`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("image absente du disque : 404", async () => {
    expect((await call("covers", `${HEX}.jpg`)).status).toBe(404);
    expect(disk.readFile).toHaveBeenCalledTimes(1);
  });

  it.each(ROLE_CODES.map((role) => [role] as const).concat([[null as never]]))(
    "photo de profil par l'adresse publique (connecté : %s) : 404, le disque n'est pas lu",
    async (role) => {
      world.role = role;
      disk.readFile.mockResolvedValue(Buffer.from(PNG));
      expect((await call("avatars", `${HEX}.png`)).status).toBe(404);
      expect(disk.readFile).not.toHaveBeenCalled();
      disk.readFile.mockReset();
    },
  );
});

describe("GET /api/member/photo/[...path]", () => {
  const call = (...path: string[]) =>
    servePhoto(new Request("http://localhost/api/member/photo/x"), {
      params: Promise.resolve({ path }),
    });

  it("sans session : 401, le disque n'est pas lu", async () => {
    expect((await call("avatars", `${HEX}.png`)).status).toBe(401);
    expect(disk.readFile).not.toHaveBeenCalled();
  });

  it("compte suspendu : 401", async () => {
    world.role = "member";
    world.status = "SUSPENDED";
    expect((await call("avatars", `${HEX}.png`)).status).toBe(401);
    expect(disk.readFile).not.toHaveBeenCalled();
  });

  it.each([
    ["covers", `${HEX}.png`],
    ["avatars", "..", "..", ".env"],
    ["avatars", `${HEX}.svg`],
    [],
  ])("chemin %j hors des photos de profil : 404, le disque n'est pas lu", async (...path) => {
    world.role = "member";
    expect((await call(...path)).status).toBe(404);
    expect(disk.readFile).not.toHaveBeenCalled();
  });

  it("photo servie à un connecté, en cache privé seulement", async () => {
    world.role = "member";
    disk.readFile.mockResolvedValueOnce(Buffer.from(PNG));
    const response = await call("avatars", `${HEX}.png`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toMatch(/^private\b/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });
});

describe("POST et DELETE /api/member/photo", () => {
  const post = (file?: Blob, extra?: { url?: string }) => {
    const form = new FormData();
    if (file) form.set("file", file, "../../moi.php");
    return uploadPhoto(
      new Request(extra?.url ?? "http://localhost/api/member/photo", {
        method: "POST",
        body: form,
      }),
    );
  };

  it("sans session : 401, rien n'est écrit ni lu", async () => {
    expect((await post(png())).status).toBe(401);
    expect(
      (await removePhoto(new Request("http://localhost/api/member/photo", { method: "DELETE" })))
        .status,
    ).toBe(401);
    expect(disk.writeFile).not.toHaveBeenCalled();
    expect(businessTargets()).toEqual([]);
  });

  it.each(ROLE_CODES)("rôle %s : la photo est celle du compte de la session", async (role) => {
    world.role = role;
    world.handlers["user.findUnique"] = () => ({ image: null });
    world.handlers["user.updateMany"] = () => ({ count: 1 });
    // Un identifiant glissé dans l'adresse n'a aucun effet.
    const response = await post(png(), { url: `http://localhost/api/member/photo?userId=${ID}` });
    if (roleHasAny(role, ["member.access"])) {
      expect(response.status).toBe(200);
      const body = (await response.json()) as { url: string };
      expect(body.url).toMatch(/^\/api\/member\/photo\/avatars\/[a-f0-9]{32}\.png$/);
      const update = world.calls.find((call) => call.target === "user.updateMany")!;
      expect(update.args[0]).toMatchObject({ where: { id: ACTOR_ID } });
      expect(disk.writeFile).toHaveBeenCalledTimes(1);
    } else {
      expect(response.status).toBe(403);
      expect(disk.writeFile).not.toHaveBeenCalled();
      expect(businessTargets()).toEqual([]);
    }
  });

  it.each([
    ["aucun fichier", () => post()],
    ["pas une image", () => post(new Blob(["<?php echo 1;"], { type: "image/png" }))],
    ["SVG", () => post(new Blob(["<svg onload='x'/>"], { type: "image/svg+xml" }))],
    ["plus de 2 Mo", () => post(new Blob([PNG, new Uint8Array(2 * 1024 * 1024)]))],
  ])("%s : 422, rien n'est écrit", async (_label, request) => {
    world.role = "member";
    world.handlers["user.findUnique"] = () => ({ image: null });
    const response = await request();
    expect(response.status).toBe(422);
    expect(disk.writeFile).not.toHaveBeenCalled();
    expect(businessTargets().filter((target) => target !== "user.findUnique")).toEqual([]);
  });

  it("limite de débit atteinte : 429, rien n'est écrit", async () => {
    world.role = "member";
    world.rateLimited = true;
    expect((await post(png())).status).toBe(429);
    expect(disk.writeFile).not.toHaveBeenCalled();
  });
});

describe("POST /api/assistant (sans clé d'API, comme dans les tests)", () => {
  const ask = () =>
    askAssistant(
      new Request("http://localhost/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "word",
          messages: [{ role: "user", content: "palimpseste" }],
        }),
      }),
    );

  it("sans session : 401, aucun accès", async () => {
    expect((await ask()).status).toBe(401);
    expect(businessTargets()).toEqual([]);
    expect(world.rateLimitHits).toBe(0);
  });

  it.each(ROLE_CODES)(
    "rôle %s : 503 « non connecté » avec `member.access`, 403 sinon",
    async (role) => {
      world.role = role;
      const response = await ask();
      if (roleHasAny(role, ["member.access"])) {
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ code: "NOT_CONFIGURED" });
      } else {
        expect(response.status).toBe(403);
      }
      // Sans fournisseur, rien n'est compté ni lu.
      expect(businessTargets()).toEqual([]);
      expect(world.rateLimitHits).toBe(0);
    },
  );
});

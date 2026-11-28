import { readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSameOriginRequest } from "@/lib/same-origin";
import { businessTargets, resetWorld, world } from "@/test/security-harness";

/**
 * Revue de sécurité de la phase 6 (docs/REVUE-SECURITE.md) :
 * 1. inventaire des Route Handlers : un fichier `route.ts` ou une méthode HTTP ajoutés sans être
 *    déclarés ici font échouer le test ;
 * 2. chaque handler qui modifie (POST, DELETE) refuse une requête venue d'un autre site, même avec
 *    une session de super-administrateur valide, avant toute lecture du corps, du disque ou de la base.
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
// Hors d'une requête Next, `connection()` lève : sans effet ici.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => undefined,
}));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/auth", async () => (await import("@/test/security-harness")).authModule);
vi.mock("@/lib/prisma", async () => (await import("@/test/security-harness")).prismaModule);
// Assistant configuré (fournisseur simulé, jamais appelé ici) : sinon sa route répond 404 avant
// tout contrôle (voir route-handlers-security.test.ts).
vi.mock("@/lib/llm", async (original) => ({
  ...(await original<typeof import("@/lib/llm")>()),
  getLLMProvider: () => ({}) as never,
}));

beforeEach(() => {
  resetWorld();
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

type Handler = (request: Request, context?: unknown) => Promise<Response>;

/**
 * Tous les Route Handlers, méthode par méthode.
 * `public` : lisible sans session (images publiques) ; `session` : session exigée, lecture seule ;
 * `mutation` : session exigée ET contrôle d'origine (testé plus bas).
 */
const inventory: Record<string, "public" | "session" | "mutation"> = {
  "api/admin/attendance/scan#POST": "mutation",
  "api/admin/attendance/search#POST": "mutation",
  "api/admin/events/[id]/registrations#GET": "session",
  "api/admin/stats#GET": "session",
  "api/admin/uploads#POST": "mutation",
  "api/assistant#POST": "mutation",
  "api/member/photo#POST": "mutation",
  "api/member/photo#DELETE": "mutation",
  "api/member/photo/[...path]#GET": "session",
  "events/[slug]/agenda.ics#GET": "public",
  "uploads/[...path]#GET": "public",
};

const HTTP_METHODS = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];

function routeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) routeFiles(full, found);
    else if (/^route\.(ts|tsx|js)$/.test(entry.name)) found.push(full);
  }
  return found;
}

const routeName = (file: string) =>
  path
    .relative("src/app", path.dirname(file))
    .split(path.sep)
    // Les groupes `(public)` n'apparaissent pas dans l'adresse.
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .join("/");

let loaded: Promise<Map<string, Handler>> | undefined;
/** Importés une seule fois : le premier import de tous les handlers est lent. */
const loadHandlers = () => (loaded ??= importHandlers());

async function importHandlers(): Promise<Map<string, Handler>> {
  const handlers = new Map<string, Handler>();
  for (const file of routeFiles("src/app")) {
    const specifier = `@/app/${path
      .relative("src/app", file)
      .split(path.sep)
      .join("/")
      .replace(/\.(ts|tsx|js)$/, "")}`;
    const mod = (await import(/* @vite-ignore */ specifier)) as Record<string, unknown>;
    for (const method of HTTP_METHODS) {
      if (typeof mod[method] === "function") {
        handlers.set(`${routeName(file)}#${method}`, mod[method] as Handler);
      }
    }
  }
  return handlers;
}

const HEX = "0123456789abcdef0123456789abcdef";
const ID = "ckx1a2b3c4d5e6f7g8h9i0j1k";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const context = { params: Promise.resolve({ id: ID, path: ["avatars", `${HEX}.png`] }) };

/** Un corps valide pour chaque mutation : seul le contrôle d'origine peut refuser. */
function body(key: string): BodyInit {
  if (key.startsWith("api/admin/uploads") || key.startsWith("api/member/photo#POST")) {
    const form = new FormData();
    form.set("file", new Blob([PNG], { type: "image/png" }), "photo.png");
    return form;
  }
  if (key.startsWith("api/admin/attendance/scan")) {
    return JSON.stringify({ mode: "token", eventId: ID, token: "A1.x", paid: false });
  }
  if (key.startsWith("api/admin/attendance/search")) {
    return JSON.stringify({ eventId: ID, q: "Awa" });
  }
  if (key.startsWith("api/assistant")) {
    return JSON.stringify({ mode: "word", messages: [{ role: "user", content: "palimpseste" }] });
  }
  return "";
}

function request(key: string, headers: Record<string, string>): Request {
  const [route, method] = key.split("#") as [string, string];
  const query = route === "api/admin/uploads" ? "?folder=covers" : "";
  const withBody = method === "POST";
  const isJson = withBody && !(body(key) instanceof FormData);
  return new Request(`http://localhost:3000/${route}${query}`, {
    method,
    headers: { ...(isJson ? { "Content-Type": "application/json" } : {}), ...headers },
    body: withBody ? body(key) : undefined,
  });
}

describe("inventaire des Route Handlers", () => {
  it("chaque méthode exportée d'un `route.ts` est déclarée, et réciproquement", async () => {
    const found = [...(await loadHandlers()).keys()].sort();
    expect(found).toEqual(Object.keys(inventory).sort());
  }, 60_000);

  it.each(Object.entries(inventory).filter(([, kind]) => kind !== "public"))(
    "%s sans session : 401, ni base, ni disque, ni compteur",
    async (key) => {
      const handler = (await loadHandlers()).get(key)!;
      const response = await handler(request(key, {}), context);
      expect(response.status).toBe(401);
      expect(businessTargets()).toEqual([]);
      expect(world.rateLimitHits).toBe(0);
      expect(disk.writeFile).not.toHaveBeenCalled();
      expect(disk.readFile).not.toHaveBeenCalled();
    },
  );
});

const mutations = Object.entries(inventory)
  .filter(([, kind]) => kind === "mutation")
  .map(([key]) => key);

describe.each(mutations)("contrôle d'origine : %s", (key) => {
  const crossSite: [string, Record<string, string>][] = [
    ["Origin d'un autre site", { origin: "https://pirate.example" }],
    ["Origin d'un sous-domaine voisin", { origin: "http://evil.localhost:3000" }],
    ["Origin « null » (iframe isolée)", { origin: "null" }],
    ["Origin sur un autre port", { origin: "http://localhost:4000" }],
    ["Sec-Fetch-Site: cross-site", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site: same-site", { "sec-fetch-site": "same-site" }],
    [
      "Origin correct mais Sec-Fetch-Site: cross-site",
      { origin: "http://localhost:3000", "sec-fetch-site": "cross-site" },
    ],
  ];

  it.each(crossSite)(
    "%s, super-administrateur connecté : 403, rien n'est lu ni écrit",
    async (_label, headers) => {
      world.role = "super_admin";
      const handler = (await loadHandlers()).get(key)!;
      const response = await handler(request(key, headers), context);
      expect(response.status).toBe(403);
      expect(businessTargets()).toEqual([]);
      expect(world.rateLimitHits).toBe(0);
      expect(disk.writeFile).not.toHaveBeenCalled();
      expect(disk.unlink).not.toHaveBeenCalled();
    },
  );

  it("même origine (Origin et Sec-Fetch-Site du site) : le contrôle d'origine laisse passer", async () => {
    world.role = "super_admin";
    world.handlers["user.findUnique"] = () => ({ image: null });
    world.handlers["user.updateMany"] = () => ({ count: 1 });
    const handler = (await loadHandlers()).get(key)!;
    const response = await handler(
      request(key, { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }),
      context,
    );
    if (response.status === 403) {
      // Un 403 ne doit jamais venir du contrôle d'origine pour une requête du site lui-même.
      expect(JSON.stringify(await response.json())).not.toContain("site du club");
    }
    expect(response.status).not.toBe(401);
  });
});

describe("isSameOriginRequest", () => {
  const make = (headers: Record<string, string>, url = "http://127.0.0.1:3000/api/x") =>
    new Request(url, { method: "POST", headers });

  it("derrière un proxy inverse : l'hôte public (`X-Forwarded-Host`) fait foi", () => {
    expect(
      isSameOriginRequest(
        make({
          origin: "https://club.example",
          host: "127.0.0.1:3000",
          "x-forwarded-host": "club.example",
        }),
      ),
    ).toBe(true);
  });

  it("l'adresse publique `APP_URL` est acceptée même si l'hôte interne diffère", () => {
    expect(isSameOriginRequest(make({ origin: "http://localhost:3000" }))).toBe(true);
  });

  it("téléphone sur le réseau local (`pnpm dev:lan`) : l'hôte de la requête fait foi", () => {
    expect(
      isSameOriginRequest(
        make({ origin: "http://192.168.1.20:3000" }, "http://192.168.1.20:3000/api/x"),
      ),
    ).toBe(true);
  });

  it("schéma exotique ou valeur illisible : refusé", () => {
    expect(isSameOriginRequest(make({ origin: "file://" }))).toBe(false);
    expect(isSameOriginRequest(make({ origin: "pas une origine" }))).toBe(false);
  });

  it("ni Origin ni Sec-Fetch-Site (script, client hors navigateur) : accepté, la session décide", () => {
    expect(isSameOriginRequest(make({}))).toBe(true);
  });
});

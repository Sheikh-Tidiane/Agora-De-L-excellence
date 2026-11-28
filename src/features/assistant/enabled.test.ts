import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * L'assistant n'existe pour les membres que si la clé ET le modèle sont configurés. Une seule
 * fonction (`isAssistantEnabled`) décide ; le proxy (page en 404), le fournisseur et la route
 * s'appuient dessus. La configuration est lue à chaque appel : la renseigner suffit à tout
 * faire réapparaître.
 */
const config = vi.hoisted(() => ({
  LLM_API_KEY: undefined as string | undefined,
  LLM_MODEL: undefined as string | undefined,
}));
vi.mock("@/lib/env", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...original,
    env: new Proxy({} as typeof original.env, {
      get: (_target, key: string) =>
        key in config ? config[key as keyof typeof config] : original.env[key as never],
    }),
  };
});
vi.mock("@/lib/public-pages", () => ({ publicPageExists: async () => true }));

const { isAssistantEnabled, isAssistantPath } = await import("@/features/assistant/enabled");
const { getLLMProvider, isLLMConfigured } = await import("@/lib/llm");
const { proxy } = await import("@/proxy");

const request = (path: string, cookie = false) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie: "agora.session_token=x" } : {},
  });

beforeEach(() => {
  config.LLM_API_KEY = undefined;
  config.LLM_MODEL = undefined;
});

describe("isAssistantEnabled", () => {
  it.each([
    [{ LLM_API_KEY: "cle", LLM_MODEL: "modele" }, true],
    [{ LLM_API_KEY: "cle" }, false],
    [{ LLM_MODEL: "modele" }, false],
    [{}, false],
    [{ LLM_API_KEY: "  ", LLM_MODEL: "modele" }, false],
    [{ LLM_API_KEY: "cle", LLM_MODEL: " " }, false],
  ])("%o → %s", (value, expected) => {
    expect(isAssistantEnabled(value)).toBe(expected);
  });

  it("lit la configuration à chaque appel : la renseigner suffit", () => {
    expect(isAssistantEnabled()).toBe(false);
    config.LLM_API_KEY = "cle-de-test";
    expect(isAssistantEnabled()).toBe(false);
    config.LLM_MODEL = "modele-de-test";
    expect(isAssistantEnabled()).toBe(true);
    expect(isLLMConfigured()).toBe(true);
  });

  it("chemins de la page", () => {
    expect(isAssistantPath("/member/assistant")).toBe(true);
    expect(isAssistantPath("/member/assistant/x")).toBe(true);
    expect(isAssistantPath("/member/assistants")).toBe(false);
    expect(isAssistantPath("/member")).toBe(false);
  });
});

describe("non configuré", () => {
  it("aucun fournisseur", () => {
    expect(getLLMProvider()).toBeNull();
  });

  it("/member/assistant : vrai 404 avant le rendu, connecté ou non", async () => {
    for (const cookie of [false, true]) {
      const response = await proxy(request("/member/assistant", cookie));
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toMatch(/\/introuvable$/);
    }
  });

  it("le reste de l'espace membre n'est pas touché", async () => {
    const response = await proxy(request("/member", true));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });
});

describe("configuré (clé et modèle)", () => {
  beforeEach(() => {
    config.LLM_API_KEY = "cle-de-test";
    config.LLM_MODEL = "modele-de-test";
  });

  it("un fournisseur est créé (sans aucun appel au modèle)", () => {
    expect(getLLMProvider()).not.toBeNull();
  });

  it("/member/assistant : la page est servie (membre connecté), sinon renvoi à la connexion", async () => {
    const member = await proxy(request("/member/assistant", true));
    expect(member.status).toBe(200);
    expect(member.headers.get("x-middleware-rewrite")).toBeNull();
    const visitor = await proxy(request("/member/assistant"));
    expect(visitor.status).toBe(307);
    expect(visitor.headers.get("location")).toMatch(/\/login\?next=%2Fmember%2Fassistant$/);
  });
});

import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { getLLMProvider, isLLMConfigured } from "@/lib/llm";

const base = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@localhost:5433/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  MAIL_FROM: "test@agora.localhost",
};

describe("variables de l'assistant", () => {
  it("toutes facultatives : sans clé, l'application démarre", () => {
    const env = parseEnv(base);
    expect(env.LLM_API_KEY).toBeUndefined();
    expect(env.LLM_PROVIDER).toBe("principal");
    // Aucun modèle écrit dans le code : il se choisit dans la configuration.
    expect(env.LLM_MODEL).toBeUndefined();
    expect(env.ASSISTANT_DAILY_LIMIT).toBe(20);
  });

  it("une clé vide compte comme absente", () => {
    expect(parseEnv({ ...base, LLM_API_KEY: "  " }).LLM_API_KEY).toBeUndefined();
  });

  it("quota et fournisseur validés", () => {
    expect(parseEnv({ ...base, ASSISTANT_DAILY_LIMIT: "5" }).ASSISTANT_DAILY_LIMIT).toBe(5);
    expect(() => parseEnv({ ...base, ASSISTANT_DAILY_LIMIT: "0" })).toThrow(
      /ASSISTANT_DAILY_LIMIT/,
    );
    expect(() => parseEnv({ ...base, ASSISTANT_DAILY_LIMIT: "beaucoup" })).toThrow(
      /ASSISTANT_DAILY_LIMIT/,
    );
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "autre" })).toThrow(/LLM_PROVIDER/);
  });

  it("l'erreur de configuration ne cite jamais la valeur de la clé", () => {
    try {
      parseEnv({ ...base, LLM_API_KEY: "sk-secret-456", LLM_PROVIDER: "autre" });
    } catch (error) {
      expect((error as Error).message).not.toContain("sk-secret-456");
    }
  });

  it("sans clé (environnement des tests) : aucun fournisseur, aucune réponse simulée", () => {
    expect(isLLMConfigured()).toBe(false);
    expect(getLLMProvider()).toBeNull();
  });
});

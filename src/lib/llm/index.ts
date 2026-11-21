import "server-only";
import { env } from "@/lib/env";
import { createAnthropicProvider } from "@/lib/llm/anthropic";
import type { LLMProvider } from "@/lib/llm/types";

export * from "@/lib/llm/types";

/** Vrai si un fournisseur est configuré (clé présente). Sans clé : « Assistant non connecté ». */
export function isLLMConfigured(): boolean {
  return Boolean(env.LLM_API_KEY);
}

let cached: { key: string; provider: LLMProvider } | undefined;

/**
 * Fournisseur choisi par `LLM_PROVIDER`, ou `null` sans clé. Aucun fournisseur de remplacement :
 * sans clé, l'application le dit, elle ne simule jamais de réponse.
 */
export function getLLMProvider(): LLMProvider | null {
  const apiKey = env.LLM_API_KEY;
  if (!apiKey) return null;
  const signature = `${env.LLM_PROVIDER}:${env.LLM_MODEL}:${apiKey}`;
  if (cached?.key === signature) return cached.provider;
  switch (env.LLM_PROVIDER) {
    case "anthropic":
      cached = {
        key: signature,
        provider: createAnthropicProvider({ apiKey, model: env.LLM_MODEL }),
      };
      return cached.provider;
  }
}

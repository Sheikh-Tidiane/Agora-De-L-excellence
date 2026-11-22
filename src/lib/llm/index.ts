import "server-only";
import { env } from "@/lib/env";
import { createSdkProvider } from "@/lib/llm/sdk-provider";
import type { LLMProvider } from "@/lib/llm/types";

export * from "@/lib/llm/types";

/**
 * Vrai si un fournisseur est configuré (clé et modèle présents). Sinon : « Assistant non connecté ».
 */
export function isLLMConfigured(): boolean {
  return Boolean(env.LLM_API_KEY && env.LLM_MODEL);
}

let cached: { key: string; provider: LLMProvider } | undefined;

/**
 * Fournisseur choisi par `LLM_PROVIDER`, ou `null` sans clé. Aucun fournisseur de remplacement :
 * sans clé, l'application le dit, elle ne simule jamais de réponse.
 */
export function getLLMProvider(): LLMProvider | null {
  const apiKey = env.LLM_API_KEY;
  const model = env.LLM_MODEL;
  if (!apiKey || !model) return null;
  const signature = `${env.LLM_PROVIDER}:${model}:${apiKey}`;
  if (cached?.key === signature) return cached.provider;
  switch (env.LLM_PROVIDER) {
    case "principal":
      cached = {
        key: signature,
        provider: createSdkProvider({ apiKey, model }),
      };
      return cached.provider;
  }
}

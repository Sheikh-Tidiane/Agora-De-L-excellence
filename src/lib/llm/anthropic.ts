import "server-only";
import Anthropic, {
  APIConnectionError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  PermissionDeniedError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import {
  LLMError,
  type LLMProvider,
  type LLMResult,
  type LLMStopReason,
  type LLMStream,
  type LLMStreamRequest,
} from "@/lib/llm/types";

/**
 * Fournisseur Anthropic (SDK officiel `@anthropic-ai/sdk`). Paramètres retenus (docs/DECISIONS.md §14) :
 * - pensée adaptative (seule possible sur Claude Opus 5.5) et effort `low` : un échange de chat ;
 * - repli serveur sur refus (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) ;
 * - pas de `temperature`, pas de préremplissage ; prompt système stable mis en cache.
 */
export const ANTHROPIC_FALLBACK_BETA = "server-side-fallback-2026-07-01";
export const ANTHROPIC_EFFORT = "low";
/** Délai maximal d'une requête au fournisseur (ms), nouvelles tentatives du SDK comprises par tentative. */
const REQUEST_TIMEOUT_MS = 90_000;

export function mapStopReason(reason: string | null | undefined): LLMStopReason {
  if (reason === "end_turn" || reason === "stop_sequence") return "end";
  if (reason === "max_tokens" || reason === "model_context_window_exceeded") return "max_tokens";
  if (reason === "refusal") return "refusal";
  return "other";
}

/** Traduit une erreur du SDK en `LLMError`, de la classe la plus précise à la plus large. */
export function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof APIUserAbortError)
    return new LLMError("aborted", undefined, { cause: error });
  if (error instanceof APIConnectionError) {
    return new LLMError("connection", undefined, { cause: error });
  }
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new LLMError("auth", error.status, { cause: error });
  }
  if (error instanceof RateLimitError) return new LLMError("rate_limit", 429, { cause: error });
  if (error instanceof BadRequestError) return new LLMError("bad_request", 400, { cause: error });
  if (error instanceof InternalServerError) {
    return new LLMError("overloaded", error.status, { cause: error });
  }
  if (error instanceof APIError) return new LLMError("unknown", error.status, { cause: error });
  if (error instanceof Error && error.name === "AbortError") {
    return new LLMError("aborted", undefined, { cause: error });
  }
  return new LLMError("unknown", undefined, { cause: error });
}

export function createAnthropicProvider(options: {
  apiKey: string;
  model: string;
  /** Réservé aux tests : remplace le réseau pour inspecter la requête sans appeler l'API. */
  fetch?: typeof fetch;
  maxRetries?: number;
}): LLMProvider {
  // Clé explicite : le SDK ne va chercher aucun autre identifiant (variables ANTHROPIC_*, profil local).
  const client = new Anthropic({
    apiKey: options.apiKey,
    authToken: null,
    timeout: REQUEST_TIMEOUT_MS,
    ...(options.fetch ? { fetch: options.fetch } : {}),
    ...(options.maxRetries !== undefined ? { maxRetries: options.maxRetries } : {}),
  });

  return {
    name: "anthropic",
    stream(request: LLMStreamRequest): LLMStream {
      const stream = client.beta.messages.stream(
        {
          model: options.model,
          max_tokens: request.maxTokens,
          betas: [ANTHROPIC_FALLBACK_BETA],
          fallbacks: "default",
          thinking: { type: "adaptive" },
          output_config: { effort: ANTHROPIC_EFFORT },
          system: request.system.map((block) => ({
            type: "text" as const,
            text: block.text,
            ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
          })),
          messages: request.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        },
        { signal: request.signal },
      );
      // Les erreurs sont lues pendant l'itération ; cet écouteur évite un rejet non géré.
      stream.on("error", () => undefined);

      let finished = false;
      return {
        async *[Symbol.asyncIterator]() {
          try {
            for await (const event of stream) {
              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                yield event.delta.text;
              }
            }
            finished = true;
          } catch (error) {
            throw toLLMError(error);
          } finally {
            if (!finished) stream.abort();
          }
        },
        async result(): Promise<LLMResult> {
          try {
            const message = await stream.finalMessage();
            return {
              stopReason: mapStopReason(message.stop_reason),
              model: message.model,
              usage: {
                inputTokens: message.usage.input_tokens,
                outputTokens: message.usage.output_tokens,
                cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
                cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
              },
            };
          } catch (error) {
            throw toLLMError(error);
          }
        },
      };
    },
  };
}

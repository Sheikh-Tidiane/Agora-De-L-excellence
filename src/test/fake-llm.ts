import {
  LLMError,
  type LLMProvider,
  type LLMResult,
  type LLMStopReason,
  type LLMStreamRequest,
} from "@/lib/llm/types";

/**
 * Fournisseur de modèle simulé, POUR LES TESTS UNIQUEMENT (jamais importé par l'application).
 * Script : morceaux de texte à diffuser, erreur éventuelle (avant le premier morceau ou après le
 * n-ième), raison d'arrêt. Chaque requête reçue est gardée pour vérifier ce qui part au modèle.
 */
export type FakeScript = {
  chunks?: string[];
  stopReason?: LLMStopReason;
  /** Erreur levée après `failAfter` morceaux (0 : avant le premier). */
  error?: LLMError;
  failAfter?: number;
  /** Attend l'annulation au lieu de finir (simule un modèle lent). */
  hang?: boolean;
};

export function fakeProvider(script: FakeScript = {}) {
  const requests: LLMStreamRequest[] = [];
  const state = { aborted: false };
  const provider: LLMProvider = {
    name: "fake",
    stream(request) {
      requests.push(request);
      request.signal?.addEventListener("abort", () => (state.aborted = true));
      const chunks = script.chunks ?? ["Bonjour"];
      const waitForAbort = () =>
        new Promise<never>((_, reject) => {
          if (request.signal?.aborted) reject(new LLMError("aborted"));
          request.signal?.addEventListener("abort", () => reject(new LLMError("aborted")));
        });
      return {
        async *[Symbol.asyncIterator]() {
          for (let index = 0; index < chunks.length; index++) {
            if (script.error && script.failAfter === index) throw script.error;
            if (request.signal?.aborted) throw new LLMError("aborted");
            yield chunks[index]!;
            await Promise.resolve();
          }
          if (script.error && (script.failAfter ?? 0) >= chunks.length) throw script.error;
          if (script.hang) await waitForAbort();
        },
        async result(): Promise<LLMResult> {
          return {
            stopReason: script.stopReason ?? "end",
            model: "modele-simule",
            usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: 0, cacheWriteTokens: 0 },
          };
        },
      };
    },
  };
  return { provider, requests, state };
}

/** Lit un flux d'octets jusqu'au bout et le décode en UTF-8. */
export async function readAll(body: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(body).text();
}

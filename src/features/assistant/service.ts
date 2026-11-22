import {
  LLMError,
  type LLMMessage,
  type LLMProvider,
  type LLMResult,
  type LLMSystemBlock,
} from "@/lib/llm/types";

/**
 * Diffusion d'une réponse de l'assistant, indépendante du fournisseur et de HTTP : testable avec
 * un fournisseur simulé (dans les tests uniquement).
 *
 * Règles (docs/DECISIONS.md §14) :
 * - on attend le premier morceau de texte (ou la fin) avant de répondre : une panne du fournisseur
 *   à ce stade devient une erreur propre (502), et la question n'est pas comptée ;
 * - ensuite le texte part tel quel, en UTF-8 ; une panne en cours de route ajoute une dernière
 *   ligne lisible et ferme le flux ; un refus ou une réponse coupée ajoute une note en français ;
 * - si le membre coupe la requête, l'appel au fournisseur est arrêté.
 */
export const ASSISTANT_MAX_TOKENS = 8000;

export const STREAM_NOTICES = {
  interrupted: "[Réponse interrompue. Réessayez.]",
  refusal:
    "[Le Compagnon des Lettres ne peut pas répondre à cette demande. Reformulez-la autour de la lecture, des mots ou des jeux de l’esprit.]",
  truncated:
    "[Réponse coupée : elle devenait trop longue. Demandez la suite, ou une version plus courte.]",
} as const;

export type StreamOutcome =
  | { kind: "completed"; result: LLMResult }
  | { kind: "interrupted"; error: LLMError }
  | { kind: "cancelled" };

export type StartedStream =
  { ok: true; body: ReadableStream<Uint8Array> } | { ok: false; error: LLMError };

/** Texte final ajouté après la réponse, selon la raison de l'arrêt (vide si rien à ajouter). */
export function closingNotice(stopReason: LLMResult["stopReason"], hadText: boolean): string {
  const notice =
    stopReason === "refusal"
      ? STREAM_NOTICES.refusal
      : stopReason === "max_tokens"
        ? STREAM_NOTICES.truncated
        : "";
  if (!notice) return "";
  return hadText ? `\n\n${notice}` : notice;
}

function closeQuietly(controller: ReadableStreamDefaultController<Uint8Array>) {
  try {
    controller.close();
  } catch {
    // Flux déjà fermé ou annulé par le client.
  }
}

export async function startAssistantStream(options: {
  provider: LLMProvider;
  system: LLMSystemBlock[];
  messages: LLMMessage[];
  maxTokens?: number;
  /** Signal de la requête HTTP : le client qui coupe arrête l'appel au fournisseur. */
  signal?: AbortSignal;
  /** Appelé une fois, à la fin du flux (terminé, interrompu ou annulé). */
  onFinish?: (outcome: StreamOutcome) => void;
}): Promise<StartedStream> {
  const upstream = new AbortController();
  const abort = () => upstream.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const detach = () => options.signal?.removeEventListener("abort", abort);

  const llm = options.provider.stream({
    system: options.system,
    messages: options.messages,
    maxTokens: options.maxTokens ?? ASSISTANT_MAX_TOKENS,
    signal: upstream.signal,
  });
  const iterator = llm[Symbol.asyncIterator]();

  const asLLMError = (error: unknown) =>
    error instanceof LLMError
      ? error
      : upstream.signal.aborted
        ? new LLMError("aborted", undefined, { cause: error })
        : new LLMError("unknown", undefined, { cause: error });

  let first: IteratorResult<string>;
  try {
    // Un morceau vide n'est pas « le premier mot » : on attend du texte réel (ou la fin).
    do {
      first = await iterator.next();
    } while (!first.done && first.value === "");
  } catch (error) {
    detach();
    return { ok: false, error: asLLMError(error) };
  }

  const encoder = new TextEncoder();
  let hadText = false;
  let finished = false;
  const finish = (outcome: StreamOutcome) => {
    if (finished) return;
    finished = true;
    detach();
    options.onFinish?.(outcome);
  };

  const complete = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      const result = await llm.result();
      const notice = closingNotice(result.stopReason, hadText);
      if (notice) controller.enqueue(encoder.encode(notice));
      finish({ kind: "completed", result });
    } catch (error) {
      const failure = asLLMError(error);
      if (failure.kind === "aborted") {
        finish({ kind: "cancelled" });
      } else {
        controller.enqueue(encoder.encode(interruptedLine()));
        finish({ kind: "interrupted", error: failure });
      }
    }
    closeQuietly(controller);
  };

  const interruptedLine = () =>
    hadText ? `\n\n${STREAM_NOTICES.interrupted}` : STREAM_NOTICES.interrupted;

  const push = (controller: ReadableStreamDefaultController<Uint8Array>, text: string) => {
    if (!text) return;
    hadText = true;
    controller.enqueue(encoder.encode(text));
  };

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (first.done) return complete(controller);
      push(controller, first.value);
    },
    async pull(controller) {
      if (finished) return;
      try {
        const next = await iterator.next();
        if (next.done) return complete(controller);
        push(controller, next.value);
      } catch (error) {
        const failure = asLLMError(error);
        if (failure.kind === "aborted" || upstream.signal.aborted) {
          finish({ kind: "cancelled" });
          return closeQuietly(controller);
        }
        controller.enqueue(encoder.encode(interruptedLine()));
        finish({ kind: "interrupted", error: failure });
        closeQuietly(controller);
      }
    },
    async cancel() {
      abort();
      finish({ kind: "cancelled" });
      // Sans attendre : le fournisseur s'arrête de lui-même sur le signal d'annulation.
      void iterator.return?.(undefined)?.catch(() => undefined);
    },
  });

  return { ok: true, body };
}

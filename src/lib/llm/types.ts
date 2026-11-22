/**
 * Couche d'accès à un modèle de langage, indépendante du fournisseur.
 * Ce module ne contient que des types et une classe d'erreur : importable partout côté serveur.
 */

/** Bloc du prompt système. `cache` : le fournisseur peut mettre en cache tout ce qui précède, ce bloc compris. */
export type LLMSystemBlock = { text: string; cache?: boolean };

export type LLMMessage = { role: "user" | "assistant"; content: string };

export type LLMStreamRequest = {
  /** Blocs dans l'ordre : le stable d'abord, ce qui varie ensuite. */
  system: LLMSystemBlock[];
  messages: LLMMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

/** Pourquoi le modèle s'est arrêté, ramené à quelques cas utiles à l'application. */
export type LLMStopReason = "end" | "max_tokens" | "refusal" | "other";

export type LLMUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type LLMResult = {
  stopReason: LLMStopReason;
  usage: LLMUsage;
  /** Modèle qui a réellement servi la réponse (il peut différer en cas de repli). */
  model: string;
};

/**
 * Réponse en cours. On l'itère pour recevoir le texte au fil de l'eau, puis `result()` donne
 * la raison de l'arrêt et la consommation. Une erreur du fournisseur est levée pendant l'itération
 * (sous forme de `LLMError`).
 */
export type LLMStream = AsyncIterable<string> & { result(): Promise<LLMResult> };

export interface LLMProvider {
  readonly name: string;
  stream(request: LLMStreamRequest): LLMStream;
}

export type LLMErrorKind =
  "auth" | "rate_limit" | "overloaded" | "bad_request" | "connection" | "aborted" | "unknown";

/** Erreur du fournisseur, sans son message brut (qui peut citer la requête). */
export class LLMError extends Error {
  readonly kind: LLMErrorKind;
  readonly status?: number;

  constructor(kind: LLMErrorKind, status?: number, options?: { cause?: unknown }) {
    super(`Erreur du fournisseur de modèle (${kind}${status ? `, ${status}` : ""})`, options);
    this.name = "LLMError";
    this.kind = kind;
    this.status = status;
  }
}

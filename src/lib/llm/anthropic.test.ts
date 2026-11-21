import { APIConnectionError, APIError, APIUserAbortError } from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  ANTHROPIC_EFFORT,
  ANTHROPIC_FALLBACK_BETA,
  createAnthropicProvider,
  mapStopReason,
  toLLMError,
} from "@/lib/llm/anthropic";
import { LLMError } from "@/lib/llm/types";

/**
 * Fournisseur Anthropic avec le vrai SDK, mais un `fetch` simulé : on vérifie la requête qui
 * partirait et la lecture du flux SSE, sans jamais appeler l'API (aucune clé n'est utilisée).
 */
type Captured = { url: string; headers: Headers; body: Record<string, unknown> };

function sse(events: { type: string; [key: string]: unknown }[]): string {
  return events.map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join("");
}

function messageEvents(texts: string[], stopReason = "end_turn", model = "claude-opus-5-5") {
  return sse([
    {
      type: "message_start",
      message: {
        id: "msg_test",
        type: "message",
        role: "assistant",
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: 120,
          output_tokens: 1,
          cache_read_input_tokens: 100,
          cache_creation_input_tokens: 0,
        },
      },
    },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "thinking", thinking: "", signature: "" },
    },
    { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } },
    ...texts.map((text) => ({
      type: "content_block_delta",
      index: 1,
      delta: { type: "text_delta", text },
    })),
    { type: "content_block_stop", index: 1 },
    {
      type: "message_delta",
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: 42 },
    },
    { type: "message_stop" },
  ]);
}

function fakeFetch(respond: () => Response) {
  const captured: Captured[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    captured.push({
      url: request.url,
      headers: request.headers,
      body: JSON.parse(await request.text()) as Record<string, unknown>,
    });
    return respond();
  }) as typeof fetch;
  return { fetchImpl, captured };
}

const streamResponse = (body: string) =>
  new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });

const request = {
  system: [
    { text: "Règles stables", cache: true },
    { text: "Catalogue", cache: true },
    { text: "Mode : expliquer un mot." },
  ],
  messages: [{ role: "user" as const, content: "palimpseste" }],
  maxTokens: 8000,
};

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += chunk;
  return text;
}

describe("createAnthropicProvider", () => {
  it("envoie les paramètres retenus et diffuse seulement le texte", async () => {
    const { fetchImpl, captured } = fakeFetch(() =>
      streamResponse(messageEvents(["Un ", "palimpseste…"])),
    );
    const provider = createAnthropicProvider({
      apiKey: "cle-de-test",
      model: "claude-opus-5-5",
      fetch: fetchImpl,
    });
    const stream = provider.stream(request);
    expect(await collect(stream)).toBe("Un palimpseste…");
    const result = await stream.result();
    expect(result).toEqual({
      stopReason: "end",
      model: "claude-opus-5-5",
      usage: { inputTokens: 120, outputTokens: 42, cacheReadTokens: 100, cacheWriteTokens: 0 },
    });

    const sent = captured[0]!;
    expect(new URL(sent.url).pathname).toBe("/v1/messages");
    // SDK 1.8 : la clé part dans `Authorization` (constaté sur la requête), une seule fois.
    expect(sent.headers.get("authorization")).toBe("Bearer cle-de-test");
    expect(sent.headers.get("x-api-key")).toBeNull();
    expect(sent.headers.get("anthropic-beta")).toContain(ANTHROPIC_FALLBACK_BETA);
    expect(sent.body).toMatchObject({
      model: "claude-opus-5-5",
      max_tokens: 8000,
      stream: true,
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: ANTHROPIC_EFFORT },
      messages: [{ role: "user", content: "palimpseste" }],
      system: [
        { type: "text", text: "Règles stables", cache_control: { type: "ephemeral" } },
        { type: "text", text: "Catalogue", cache_control: { type: "ephemeral" } },
        { type: "text", text: "Mode : expliquer un mot." },
      ],
    });
    expect(ANTHROPIC_EFFORT).toBe("low");
    // Paramètres retirés sur ce modèle : jamais envoyés.
    for (const key of ["temperature", "top_p", "top_k", "betas"])
      expect(sent.body).not.toHaveProperty(key);
    expect((sent.body.system as object[])[2]).not.toHaveProperty("cache_control");
  });

  it("refus : raison d'arrêt « refusal » remontée", async () => {
    const { fetchImpl } = fakeFetch(() => streamResponse(messageEvents([], "refusal")));
    const provider = createAnthropicProvider({
      apiKey: "k",
      model: "claude-opus-5-5",
      fetch: fetchImpl,
    });
    const stream = provider.stream(request);
    expect(await collect(stream)).toBe("");
    expect((await stream.result()).stopReason).toBe("refusal");
  });

  it("erreur HTTP du fournisseur : LLMError typée pendant l'itération", async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "overloaded_error", message: "Overloaded" },
          }),
          {
            status: 529,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const provider = createAnthropicProvider({
      apiKey: "k",
      model: "claude-opus-5-5",
      fetch: fetchImpl,
      maxRetries: 0,
    });
    const error = await collect(provider.stream(request)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LLMError);
    expect(error).toMatchObject({ kind: "overloaded", status: 529 });
  });

  it("clé invalide : « auth », et le message ne contient pas la clé", async () => {
    const { fetchImpl } = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            type: "error",
            error: { type: "authentication_error", message: "invalid x-api-key" },
          }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    const provider = createAnthropicProvider({
      apiKey: "sk-secret-123",
      model: "m",
      fetch: fetchImpl,
      maxRetries: 0,
    });
    const error = (await collect(provider.stream(request)).catch((e: unknown) => e)) as LLMError;
    expect(error.kind).toBe("auth");
    expect(error.message).not.toContain("sk-secret-123");
  });

  it("annulation par le signal : « aborted »", async () => {
    const controller = new AbortController();
    const { fetchImpl } = fakeFetch(() => {
      controller.abort();
      return streamResponse(messageEvents(["x"]));
    });
    const provider = createAnthropicProvider({
      apiKey: "k",
      model: "m",
      fetch: fetchImpl,
      maxRetries: 0,
    });
    const error = (await collect(provider.stream({ ...request, signal: controller.signal })).catch(
      (e: unknown) => e,
    )) as LLMError;
    expect(error).toBeInstanceOf(LLMError);
    expect(error.kind).toBe("aborted");
  });
});

describe("traductions", () => {
  it.each([
    ["end_turn", "end"],
    ["stop_sequence", "end"],
    ["max_tokens", "max_tokens"],
    ["model_context_window_exceeded", "max_tokens"],
    ["refusal", "refusal"],
    ["pause_turn", "other"],
    [null, "other"],
  ] as const)("stop_reason %s → %s", (reason, expected) => {
    expect(mapStopReason(reason)).toBe(expected);
  });

  it.each([
    [APIError.generate(401, { error: {} }, "x", new Headers()), "auth"],
    [APIError.generate(403, { error: {} }, "x", new Headers()), "auth"],
    [APIError.generate(429, { error: {} }, "x", new Headers()), "rate_limit"],
    [APIError.generate(400, { error: {} }, "x", new Headers()), "bad_request"],
    [APIError.generate(500, { error: {} }, "x", new Headers()), "overloaded"],
    [APIError.generate(529, { error: {} }, "x", new Headers()), "overloaded"],
    [APIError.generate(404, { error: {} }, "x", new Headers()), "unknown"],
    [new APIUserAbortError(), "aborted"],
    [new APIConnectionError({ message: "réseau" }), "connection"],
    [new TypeError("autre"), "unknown"],
  ] as const)("%s → %s", (error, kind) => {
    expect(toLLMError(error).kind).toBe(kind);
  });
});

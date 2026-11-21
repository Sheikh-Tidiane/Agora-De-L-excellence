import { describe, expect, it, vi } from "vitest";
import {
  ASSISTANT_MAX_TOKENS,
  STREAM_NOTICES,
  closingNotice,
  startAssistantStream,
  type StreamOutcome,
} from "@/features/assistant/service";
import { LLMError } from "@/lib/llm/types";
import { fakeProvider, readAll } from "@/test/fake-llm";

const base = {
  system: [{ text: "règles", cache: true }],
  messages: [{ role: "user" as const, content: "Que lire ?" }],
};

describe("startAssistantStream", () => {
  it("diffuse les morceaux tels quels, en UTF-8, et termine proprement", async () => {
    const { provider, requests } = fakeProvider({ chunks: ["L’Aventure ", "ambiguë", " — été"] });
    const onFinish = vi.fn<(outcome: StreamOutcome) => void>();
    const started = await startAssistantStream({ provider, ...base, onFinish });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(await readAll(started.body)).toBe("L’Aventure ambiguë — été");
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({ kind: "completed" });
    expect(requests[0]!.maxTokens).toBe(ASSISTANT_MAX_TOKENS);
    expect(requests[0]!.system).toEqual(base.system);
    expect(requests[0]!.messages).toEqual(base.messages);
  });

  it("échec avant le premier morceau : pas de flux, l'erreur est rendue (502 côté route)", async () => {
    const { provider } = fakeProvider({ error: new LLMError("overloaded", 529), failAfter: 0 });
    const started = await startAssistantStream({ provider, ...base });
    expect(started).toMatchObject({ ok: false, error: { kind: "overloaded", status: 529 } });
  });

  it("morceaux vides puis panne : aucun mot reçu, donc erreur (question rendue), pas de flux", async () => {
    const { provider } = fakeProvider({
      chunks: ["", ""],
      error: new LLMError("connection"),
      failAfter: 2,
    });
    const started = await startAssistantStream({ provider, ...base });
    expect(started).toMatchObject({ ok: false, error: { kind: "connection" } });
  });

  it("un morceau vide en tête n'empêche pas la diffusion du texte qui suit", async () => {
    const { provider } = fakeProvider({ chunks: ["", "Bonjour"] });
    const started = await startAssistantStream({ provider, ...base });
    if (!started.ok) throw new Error("flux attendu");
    expect(await readAll(started.body)).toBe("Bonjour");
  });

  it("une erreur quelconque avant le premier morceau devient une LLMError « unknown »", async () => {
    const { provider } = fakeProvider();
    provider.stream = () => ({
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new TypeError("boum")),
      }),
      result: () => Promise.reject(new Error("jamais")),
    });
    const started = await startAssistantStream({ provider, ...base });
    expect(started).toMatchObject({ ok: false, error: { kind: "unknown" } });
  });

  it("échec en cours de diffusion : dernière ligne lisible, puis fermeture", async () => {
    const { provider } = fakeProvider({
      chunks: ["Première idée.", " Deuxième"],
      error: new LLMError("connection"),
      failAfter: 1,
    });
    const onFinish = vi.fn<(outcome: StreamOutcome) => void>();
    const started = await startAssistantStream({ provider, ...base, onFinish });
    if (!started.ok) throw new Error("flux attendu");
    expect(await readAll(started.body)).toBe(`Première idée.\n\n${STREAM_NOTICES.interrupted}`);
    expect(onFinish.mock.calls[0]![0]).toMatchObject({
      kind: "interrupted",
      error: { kind: "connection" },
    });
  });

  it("refus du modèle sans texte : message clair en français, seul", async () => {
    const { provider } = fakeProvider({ chunks: [], stopReason: "refusal" });
    const started = await startAssistantStream({ provider, ...base });
    if (!started.ok) throw new Error("flux attendu");
    expect(await readAll(started.body)).toBe(STREAM_NOTICES.refusal);
  });

  it("refus en cours de réponse : la note suit le texte déjà envoyé", async () => {
    const { provider } = fakeProvider({ chunks: ["Début"], stopReason: "refusal" });
    const started = await startAssistantStream({ provider, ...base });
    if (!started.ok) throw new Error("flux attendu");
    expect(await readAll(started.body)).toBe(`Début\n\n${STREAM_NOTICES.refusal}`);
  });

  it("réponse coupée (max_tokens) : note finale", async () => {
    const { provider } = fakeProvider({ chunks: ["Long"], stopReason: "max_tokens" });
    const started = await startAssistantStream({ provider, ...base });
    if (!started.ok) throw new Error("flux attendu");
    expect(await readAll(started.body)).toBe(`Long\n\n${STREAM_NOTICES.truncated}`);
  });

  it("le client coupe la requête : l'appel au fournisseur est annulé", async () => {
    const { provider, state } = fakeProvider({ chunks: ["Un"], hang: true });
    const request = new AbortController();
    const onFinish = vi.fn<(outcome: StreamOutcome) => void>();
    const started = await startAssistantStream({
      provider,
      ...base,
      signal: request.signal,
      onFinish,
    });
    if (!started.ok) throw new Error("flux attendu");
    const reader = started.body.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toBe("Un");
    const pending = reader.read();
    request.abort();
    const last = await pending;
    expect(last.done).toBe(true);
    expect(state.aborted).toBe(true);
    expect(onFinish.mock.calls[0]![0]).toEqual({ kind: "cancelled" });
  });

  it("le lecteur annule le flux : le fournisseur est arrêté", async () => {
    const { provider, state } = fakeProvider({ chunks: ["Un"], hang: true });
    const started = await startAssistantStream({ provider, ...base });
    if (!started.ok) throw new Error("flux attendu");
    const reader = started.body.getReader();
    await reader.read();
    await reader.cancel();
    expect(state.aborted).toBe(true);
  });

  it("requête déjà annulée avant l'appel : erreur « aborted », rien n'est diffusé", async () => {
    const { provider } = fakeProvider({ chunks: ["Un"] });
    const request = new AbortController();
    request.abort();
    const started = await startAssistantStream({ provider, ...base, signal: request.signal });
    expect(started).toMatchObject({ ok: false, error: { kind: "aborted" } });
  });
});

describe("closingNotice", () => {
  it.each([
    ["end", false, ""],
    ["other", true, ""],
    ["refusal", false, STREAM_NOTICES.refusal],
    ["refusal", true, `\n\n${STREAM_NOTICES.refusal}`],
    ["max_tokens", true, `\n\n${STREAM_NOTICES.truncated}`],
  ] as const)("%s (texte déjà envoyé : %s)", (reason, hadText, expected) => {
    expect(closingNotice(reason, hadText)).toBe(expected);
  });

  it("les notes sont en français et ne mentionnent ni modèle ni fournisseur", () => {
    for (const notice of Object.values(STREAM_NOTICES)) {
      expect(notice).not.toMatch(/claude|anthropic|model|api/i);
    }
  });
});

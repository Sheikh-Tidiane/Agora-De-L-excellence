"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ASSISTANT_MODES,
  MAX_ANSWER_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  type AssistantModeId,
} from "@/features/assistant/modes";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Turn = { role: "user" | "assistant"; content: string; interrupted?: boolean };

const plural = (n: number) => `${n} question${n > 1 ? "s" : ""}`;

/**
 * Les liens écrits par le modèle peuvent être inventés : ils s'affichent en texte, jamais
 * cliquables (« [titre](adresse) » devient « titre »).
 */
const withoutLinks = (text: string) => text.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

/**
 * Conversation avec le Compagnon des Lettres. La réponse arrive au fil de l'eau (flux texte du
 * Route Handler) ; « Arrêter » coupe la requête. L'historique ne quitte pas le navigateur : il
 * n'est envoyé qu'avec la question suivante, borné aux derniers échanges, et s'efface au départ.
 */
export function AssistantChat({
  initialRemaining,
  dailyLimit,
  resetsLabel,
}: {
  initialRemaining: number;
  dailyLimit: number;
  /** « demain à 00 h 00 » : quand le quota revient. */
  resetsLabel: string;
}) {
  const [mode, setMode] = useState<AssistantModeId>(ASSISTANT_MODES[0]!.id);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string>();
  const [remaining, setRemaining] = useState(initialRemaining);
  const [announce, setAnnounce] = useState("");
  const controller = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const current = ASSISTANT_MODES.find((item) => item.id === mode)!;

  // Suit le texte qui arrive (sans animation pendant la diffusion, pour ne pas saccader).
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: streaming ? "auto" : "smooth" });
  }, [turns, streaming]);
  useEffect(() => () => controller.current?.abort(), []);

  const appendToLast = (text: string, patch: Partial<Turn> = {}) =>
    setTurns((all) => {
      const last = all[all.length - 1];
      if (!last || last.role !== "assistant") return all;
      return [...all.slice(0, -1), { ...last, content: last.content + text, ...patch }];
    });

  const send = async () => {
    const question = draft.trim();
    if (!question || streaming || remaining <= 0) return;
    setError(undefined);
    const history: Turn[] = [
      ...turns.filter((t) => t.content.trim() !== ""),
      { role: "user", content: question },
    ];
    // Une longue réponse précédente est coupée à la taille admise par le serveur.
    const messages = history.slice(-MAX_HISTORY_MESSAGES).map(({ role, content }) => ({
      role,
      content: role === "assistant" ? content.slice(0, MAX_ANSWER_CHARS) : content,
    }));
    // L'historique envoyé commence toujours par une question du membre.
    while (messages[0]?.role === "assistant") messages.shift();
    setTurns([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setAnnounce("");
    setStreaming(true);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, messages }),
        signal: abort.signal,
      });
      const left = response.headers.get("X-Assistant-Remaining");
      if (left !== null && Number.isFinite(Number(left))) setRemaining(Number(left));
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
        } | null;
        if (body?.code === "QUOTA") setRemaining(0);
        throw new Error(body?.error ?? "L’assistant ne répond pas pour le moment. Réessayez.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        appendToLast(decoder.decode(value, { stream: true }));
      }
      appendToLast(decoder.decode());
      setAnnounce("Réponse reçue.");
    } catch (cause) {
      if (abort.signal.aborted) {
        appendToLast("", { interrupted: true });
      } else {
        // La question et la réponse vide sont retirées du fil ; la question revient dans le champ.
        setTurns((all) => all.slice(0, -2));
        setDraft(question);
        setError(cause instanceof Error ? cause.message : "Une erreur est survenue. Réessayez.");
      }
    } finally {
      setStreaming(false);
      controller.current = null;
    }
  };

  const reset = () => {
    controller.current?.abort();
    setTurns([]);
    setError(undefined);
  };

  return (
    <div className="flex min-h-[calc(100dvh-16rem)] flex-col">
      <div
        role="radiogroup"
        aria-label="Que voulez-vous faire ?"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0"
      >
        {ASSISTANT_MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={mode === item.id}
            disabled={streaming}
            onClick={() => setMode(item.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200",
              mode === item.id
                ? "border-indigo bg-indigo text-ivoire"
                : "border-indigo/20 hover:border-indigo",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="petit mt-3 max-w-[40rem] text-gris" aria-live="polite">
        {current.hint}
      </p>

      <div className="mt-6 flex-1">
        {turns.length === 0 ? (
          <div className="max-w-[40rem] border-t border-indigo/20 pt-6">
            <p className="font-serif text-[1.375rem] leading-snug">
              Posez votre question : le Compagnon propose, vous décidez.
            </p>
            <p className="mt-3 text-gris">
              Ses réponses sont des suggestions. Il signale les livres qui ne sont pas au catalogue
              du club : vérifiez-les avant de vous y fier.
            </p>
          </div>
        ) : (
          <ol className="max-w-[44rem] space-y-6" aria-busy={streaming}>
            {turns.map((turn, index) =>
              turn.role === "user" ? (
                <li
                  key={index}
                  className="ml-auto w-fit max-w-[85%] rounded-[16px] rounded-br-[4px] bg-indigo px-4 py-3 text-ivoire"
                >
                  <span className="sr-only">Vous : </span>
                  <span className="whitespace-pre-line">{turn.content}</span>
                </li>
              ) : (
                <li key={index} className="border-l-2 border-terracotta pl-4">
                  <p className="surtitre mb-2">Le Compagnon</p>
                  {turn.content ? (
                    <Markdown source={withoutLinks(turn.content)} />
                  ) : streaming && index === turns.length - 1 ? (
                    <p className="text-gris" role="status">
                      Le Compagnon réfléchit…
                    </p>
                  ) : null}
                  {turn.interrupted ? (
                    <p className="petit mt-2 text-gris">Réponse arrêtée.</p>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}
        <div ref={end} />
        {/* Une seule annonce à la fin, plutôt que chaque morceau de texte. */}
        <p role="status" className="sr-only">
          {announce}
        </p>
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 mt-6 border-t border-indigo/15 bg-ivoire/95 px-4 pt-3 pb-3 backdrop-blur-[2px] lg:bottom-0 lg:mx-0 lg:px-0">
        {error ? (
          <p role="alert" className="petit mb-2 font-semibold text-erreur">
            {error}
          </p>
        ) : null}
        {remaining <= 0 ? (
          <p className="rounded-champ bg-sable px-4 py-3 font-semibold">
            Vous avez posé vos {plural(dailyLimit)} du jour. Le Compagnon revient {resetsLabel}.
          </p>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <label htmlFor="assistant-question" className="sr-only">
              Votre question
            </label>
            <textarea
              id="assistant-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_CHARS))}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              rows={2}
              placeholder={current.placeholder}
              enterKeyHint="send"
              className="max-h-40 min-h-12 flex-1 resize-none rounded-champ border border-indigo/25 bg-blanc px-4 py-3 text-base focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20 focus-visible:outline-none"
            />
            {streaming ? (
              <Button
                type="button"
                variant="contour"
                size="icone"
                className="size-12"
                onClick={() => controller.current?.abort()}
                aria-label="Arrêter la réponse"
              >
                <Square aria-hidden="true" />
              </Button>
            ) : (
              <Button
                type="submit"
                variant="action"
                size="icone"
                className="size-12"
                disabled={draft.trim() === ""}
                aria-label="Envoyer la question"
              >
                <ArrowUp aria-hidden="true" />
              </Button>
            )}
          </form>
        )}
        <div className="petit mt-2 flex items-center justify-between gap-3 text-gris">
          <span aria-live="polite">
            {remaining > 0
              ? `${plural(remaining)} restante${remaining > 1 ? "s" : ""} aujourd’hui`
              : ""}
          </span>
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-indigo hover:underline"
            >
              <RotateCcw aria-hidden="true" className="size-4" />
              Nouvelle conversation
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

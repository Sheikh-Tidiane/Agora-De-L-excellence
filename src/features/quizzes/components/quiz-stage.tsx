"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type StageQuestion = {
  id: string;
  number: number;
  total: number;
  prompt: string;
  choices: { id: string; label: string }[];
};

const LETTERS = "ABCDEF";

/** Compte à rebours à partir d'une échéance locale (calculée depuis le temps restant du serveur). */
export function useCountdown(endsAt: number | null, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [endsAt]);
  const remaining = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (remaining === 0) onExpire?.();
    // `onExpire` change à chaque rendu : seule la bascule à zéro compte.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0]);
  return remaining;
}

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Écran d'une question, conçu pour le pouce : progression en tuiles et chrono en haut, énoncé en
 * grand, propositions en larges boutons, « Valider » et « Passer » collés en bas de l'écran.
 * Ne connaît pas la bonne réponse : il envoie un choix (ou `null` pour passer) à `onAnswer`.
 */
export function QuizStage({
  question,
  remaining,
  pending,
  error,
  onAnswer,
  label,
}: {
  question: StageQuestion;
  /** Secondes restantes ; `null` : aperçu sans chrono. */
  remaining: number | null;
  pending: boolean;
  error?: string;
  onAnswer: (choiceId: string | null) => void;
  /** Bandeau au-dessus (aperçu). */
  label?: string;
}) {
  // Le choix est lié à la question : en passant à la suivante, rien n'est présélectionné.
  const [picked, setPicked] = useState<{ questionId: string; choiceId: string } | null>(null);
  const selected = picked?.questionId === question.id ? picked.choiceId : null;
  const setSelected = (choiceId: string) => setPicked({ questionId: question.id, choiceId });
  const urgent = remaining !== null && remaining <= 30;

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-[40rem] flex-col">
      {label ? <p className="surtitre mb-4">{label}</p> : null}
      <div className="flex items-center justify-between gap-4">
        <p className="petit font-semibold text-gris tabular-nums">
          Question {question.number} sur {question.total}
        </p>
        {remaining !== null ? (
          <p
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-pastille px-3 text-[0.9375rem] font-bold tabular-nums transition-colors duration-300",
              urgent ? "bg-terracotta-fonce text-blanc" : "bg-indigo text-ivoire",
            )}
          >
            <Timer aria-hidden="true" className="size-4" />
            <span className="sr-only">Temps restant&nbsp;: </span>
            {clock(remaining)}
          </p>
        ) : null}
      </div>
      <ol aria-hidden="true" className="mt-3 flex gap-1">
        {Array.from({ length: question.total }, (_, index) => (
          <li
            key={index}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              index < question.number - 1
                ? "bg-indigo"
                : index === question.number - 1
                  ? "bg-terracotta"
                  : "bg-indigo/15",
            )}
          />
        ))}
      </ol>

      <fieldset className="mt-8 flex-1" disabled={pending}>
        <legend className="font-serif text-[1.625rem] leading-[1.2] sm:text-[2rem]">
          {question.prompt}
        </legend>
        <ul className="mt-6 space-y-2.5">
          {question.choices.map((choice, index) => {
            const active = selected === choice.id;
            return (
              <li key={choice.id}>
                <label
                  className={cn(
                    "flex min-h-14 cursor-pointer items-center gap-3 rounded-[14px] border px-4 py-3 transition-[background-color,border-color,transform] duration-200 active:scale-[0.99]",
                    active
                      ? "border-indigo bg-indigo text-ivoire"
                      : "border-indigo/20 bg-blanc hover:border-indigo/50",
                  )}
                >
                  <input
                    type="radio"
                    name={`choix-${question.id}`}
                    value={choice.id}
                    checked={active}
                    onChange={() => setSelected(choice.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[7px] font-serif text-lg",
                      active ? "bg-terracotta-clair text-indigo" : "bg-ivoire text-indigo",
                    )}
                  >
                    {LETTERS[index]}
                  </span>
                  <span className="text-[1.0625rem] leading-snug">{choice.label}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {error ? (
        <p role="alert" className="petit mt-4 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 mt-6 flex gap-2 bg-ivoire/95 px-4 py-3 lg:static lg:mx-0 lg:bg-transparent lg:px-0">
        <Button
          variant="discret"
          disabled={pending}
          onClick={() => onAnswer(null)}
          className="shrink-0"
        >
          Passer
        </Button>
        <Button
          variant="action"
          largeur="pleine"
          disabled={pending || selected === null}
          onClick={() => onAnswer(selected)}
        >
          {pending
            ? "Envoi…"
            : question.number === question.total
              ? "Valider et terminer"
              : "Valider"}
        </Button>
      </div>
    </div>
  );
}

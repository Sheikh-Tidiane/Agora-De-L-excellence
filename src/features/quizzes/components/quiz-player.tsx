"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { answerQuestionAction, finishQuizAction } from "@/features/quizzes/actions";
import {
  QuizStage,
  useCountdown,
  type StageQuestion,
} from "@/features/quizzes/components/quiz-stage";

type Playing = { attemptId: string; remainingSeconds: number; question: StageQuestion };

/**
 * Tentative en cours. Le chrono affiché part du temps restant donné par le serveur (pas de
 * l'horloge du téléphone) ; c'est le serveur qui décide : une réponse trop tardive est refusée
 * et la tentative se termine. À la fin, la page est rechargée pour afficher le résultat.
 */
export function QuizPlayer({ initial }: { initial: Playing }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [endsAt, setEndsAt] = useState(() => Date.now() + initial.remainingSeconds * 1000);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [timeUp, setTimeUp] = useState(false);
  const [done, setDone] = useState(false);
  const finishing = useRef(false);
  /** Réponse en route : la fin attend qu'elle arrive (le serveur accorde quelques secondes). */
  const inFlight = useRef<Promise<unknown> | null>(null);

  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    setDone(true);
    start(async () => {
      await inFlight.current?.catch(() => undefined);
      await finishQuizAction({ attemptId: state.attemptId });
      router.refresh();
    });
  };

  const remaining = useCountdown(endsAt, () => {
    setTimeUp(true);
    finish();
  });

  const answer = (choiceId: string | null) =>
    start(async () => {
      setError(undefined);
      const request = answerQuestionAction({
        attemptId: state.attemptId,
        questionId: state.question.id,
        choiceId,
      });
      inFlight.current = request;
      const result = await request.finally(() => {
        if (inFlight.current === request) inFlight.current = null;
      });
      if (!result.ok) {
        setError(result.message);
        router.refresh();
        return;
      }
      const next = result.data.state;
      if (!result.data.accepted) setTimeUp(true);
      if (next.status === "finished") {
        finishing.current = true;
        setDone(true);
        router.refresh();
        return;
      }
      setState({
        attemptId: next.attemptId,
        remainingSeconds: next.remainingSeconds,
        question: next.question,
      });
      setEndsAt(Date.now() + next.remainingSeconds * 1000);
    });

  if (timeUp || done) {
    return (
      <div role="status" className="mx-auto max-w-[40rem] py-16 text-center">
        <p className="font-serif text-[2rem] leading-tight">
          {timeUp ? "Temps écoulé." : "C’est terminé."}
        </p>
        <p className="mt-3 text-gris">Le serveur compte vos réponses…</p>
      </div>
    );
  }

  return (
    <QuizStage
      question={state.question}
      remaining={remaining}
      pending={pending}
      error={error}
      onAnswer={answer}
    />
  );
}

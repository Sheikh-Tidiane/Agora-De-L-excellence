"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startQuizAction } from "@/features/quizzes/actions";

/** Démarre la tentative (le chrono du serveur part à cet instant), puis affiche la première question. */
export function StartQuizButton({ quizId, minutes }: { quizId: string; minutes: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 bg-ivoire/95 px-4 py-3 lg:static lg:mx-0 lg:bg-transparent lg:px-0">
      <Button
        variant="action"
        size="lg"
        largeur="pleine"
        className="sm:w-auto"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(undefined);
            const result = await startQuizAction({ quizId });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Préparation…" : `Commencer · ${minutes} min`}
      </Button>
      {error ? (
        <p role="alert" className="petit mt-2 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

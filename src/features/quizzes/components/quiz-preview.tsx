"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QuizStage, type StageQuestion } from "@/features/quizzes/components/quiz-stage";

/**
 * Aperçu de l'administration : le même écran que le membre, sans chrono ni envoi au serveur
 * (aucune tentative n'est créée). On avance question par question.
 */
export function QuizPreview({ questions }: { questions: StageQuestion[] }) {
  const [index, setIndex] = useState(0);
  const question = questions[index];
  if (!question) {
    return (
      <div className="mx-auto max-w-[40rem] py-12 text-center">
        <p className="font-serif text-[2rem]">Fin de l’aperçu.</p>
        <p className="mt-2 text-gris">Le membre verrait ici son score et sa durée.</p>
        <Button variant="contour" className="mt-6" onClick={() => setIndex(0)}>
          Recommencer l’aperçu
        </Button>
      </div>
    );
  }
  return (
    <QuizStage
      label="Aperçu · aucune réponse n’est enregistrée"
      question={question}
      remaining={null}
      pending={false}
      onAnswer={() => setIndex(index + 1)}
    />
  );
}

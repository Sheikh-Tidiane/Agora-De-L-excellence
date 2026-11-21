"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2 } from "lucide-react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import {
  addQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
  updateQuestionAction,
} from "@/features/quizzes/actions";
import { emptyQuestion, QuestionForm } from "@/features/quizzes/components/question-form";
import { QUIZ_LIMITS } from "@/features/quizzes/schemas";
import { cn } from "@/lib/utils";

export type AdminQuestion = {
  id: string;
  prompt: string;
  choices: { id: string; label: string; isCorrect: boolean }[];
};

function QuestionView({ question, index }: { question: AdminQuestion; index: number }) {
  return (
    <div className="flex min-w-0 flex-1 gap-4">
      <span className="w-8 shrink-0 font-serif text-2xl leading-none text-terracotta tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{question.prompt}</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {question.choices.map((choice) => (
            <li
              key={choice.id}
              className={cn(
                "flex items-start gap-1.5 text-[0.9375rem]",
                choice.isCorrect ? "font-semibold text-succes" : "text-gris",
              )}
            >
              {choice.isCorrect ? (
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              ) : (
                <span aria-hidden="true" className="w-4 shrink-0" />
              )}
              {choice.label}
              {choice.isCorrect ? <span className="sr-only"> (bonne réponse)</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Questions d'un quiz. En brouillon : modifier, retirer, déplacer, ajouter. Publié : lecture
 * seule (les questions sont figées dès la publication).
 */
export function QuestionList({
  quizId,
  questions,
  editable,
}: {
  quizId: string;
  questions: AdminQuestion[];
  editable: boolean;
}) {
  const { run, pending, toast } = useAdminAction();
  const [editing, setEditing] = useState<string>();

  const move = (index: number, delta: -1 | 1) => {
    const ids = questions.map((question) => question.id);
    const target = index + delta;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    void run(() => reorderQuestionsAction({ quizId, questionIds: ids }));
  };

  const remove = (question: AdminQuestion) => {
    if (!window.confirm("Retirer cette question ?")) return;
    void run(() => deleteQuestionAction({ questionId: question.id }), {
      success: "Question retirée.",
    });
  };

  return (
    <div>
      {questions.length === 0 ? (
        <p className="border-t border-indigo/20 py-6 text-gris">
          Aucune question encore. Ajoutez-en au moins une pour pouvoir publier.
        </p>
      ) : (
        <ol className="border-b border-indigo/20">
          {questions.map((question, index) => (
            <li key={question.id} className="border-t border-indigo/20 py-5">
              {editing === question.id ? (
                <QuestionForm
                  idPrefix={`q-${question.id}`}
                  initial={{
                    prompt: question.prompt,
                    choices: question.choices.map(({ label, isCorrect }) => ({ label, isCorrect })),
                  }}
                  submitLabel="Enregistrer la question"
                  pending={pending}
                  onCancel={() => setEditing(undefined)}
                  onSubmit={(values) =>
                    run(() => updateQuestionAction({ questionId: question.id, ...values }), {
                      success: "Question enregistrée.",
                      onSuccess: () => setEditing(undefined),
                    })
                  }
                />
              ) : (
                <div className="flex gap-3">
                  <QuestionView question={question} index={index} />
                  {editable ? (
                    <div className="grid shrink-0 grid-cols-2 gap-1 sm:flex">
                      <Button
                        variant="discret"
                        size="icone"
                        onClick={() => move(index, -1)}
                        disabled={pending || index === 0}
                        aria-label={`Monter la question ${index + 1}`}
                      >
                        <ArrowUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="discret"
                        size="icone"
                        onClick={() => move(index, 1)}
                        disabled={pending || index === questions.length - 1}
                        aria-label={`Descendre la question ${index + 1}`}
                      >
                        <ArrowDown aria-hidden="true" />
                      </Button>
                      <Button
                        variant="discret"
                        size="icone"
                        onClick={() => setEditing(question.id)}
                        aria-label={`Modifier la question ${index + 1}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        variant="discret"
                        size="icone"
                        disabled={pending}
                        onClick={() => remove(question)}
                        aria-label={`Retirer la question ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {editable && questions.length < QUIZ_LIMITS.maxQuestions ? (
        <section aria-labelledby="ajout-question" className="mt-8 rounded-[14px] bg-blanc p-5">
          <h3 id="ajout-question" className="font-serif text-xl">
            Nouvelle question
          </h3>
          <div className="mt-4">
            <QuestionForm
              idPrefix="nouvelle"
              initial={emptyQuestion()}
              submitLabel="Ajouter la question"
              pending={pending}
              onSubmit={(values) =>
                run(() => addQuestionAction({ quizId, ...values }), {
                  success: "Question ajoutée.",
                })
              }
            />
          </div>
        </section>
      ) : null}
      {toast}
    </div>
  );
}

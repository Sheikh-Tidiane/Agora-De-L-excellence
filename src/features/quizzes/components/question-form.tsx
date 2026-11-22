"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { QUIZ_LIMITS } from "@/features/quizzes/schemas";
import { cn } from "@/lib/utils";

export type ChoiceDraft = { label: string; isCorrect: boolean };
export type QuestionDraftValues = { prompt: string; choices: ChoiceDraft[] };

export const emptyQuestion = (): QuestionDraftValues => ({
  prompt: "",
  choices: [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
    { label: "", isCorrect: false },
  ],
});

/** Vérifications locales, les mêmes que le serveur (qui refait tout). */
function problem(values: QuestionDraftValues): string | null {
  if (values.prompt.trim().length < 3) return "Écrivez l’énoncé.";
  if (values.choices.some((choice) => choice.label.trim() === "")) {
    return "Chaque proposition doit avoir un texte (retirez celles qui sont vides).";
  }
  if (values.choices.filter((choice) => choice.isCorrect).length !== 1) {
    return "Cochez exactement une bonne réponse.";
  }
  return null;
}

/**
 * Formulaire d'une question : énoncé, 2 à 6 propositions, une seule bonne (bouton radio).
 * Sert à l'ajout comme à la modification.
 */
export function QuestionForm({
  idPrefix,
  initial,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: {
  idPrefix: string;
  initial: QuestionDraftValues;
  submitLabel: string;
  pending: boolean;
  onSubmit: (values: QuestionDraftValues) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<string>();

  const setLabel = (index: number, label: string) =>
    setValues((current) => ({
      ...current,
      choices: current.choices.map((choice, i) => (i === index ? { ...choice, label } : choice)),
    }));

  const setCorrect = (index: number) =>
    setValues((current) => ({
      ...current,
      choices: current.choices.map((choice, i) => ({ ...choice, isCorrect: i === index })),
    }));

  const removeChoice = (index: number) =>
    setValues((current) => {
      const choices = current.choices.filter((_, i) => i !== index);
      if (!choices.some((choice) => choice.isCorrect) && choices[0]) {
        choices[0] = { ...choices[0], isCorrect: true };
      }
      return { ...current, choices };
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = problem(values);
    setError(found ?? undefined);
    if (found) return;
    const submitted = {
      prompt: values.prompt.trim(),
      choices: values.choices.map((choice) => ({ ...choice, label: choice.label.trim() })),
    };
    // Ajout : le formulaire se vide tout de suite (la question ajoutée peut s'afficher avant la
    // fin de l'appel, et une saisie commencée entre-temps ne doit pas être effacée) ; il est
    // rétabli si le serveur refuse.
    if (!onCancel) setValues(emptyQuestion());
    const done = await onSubmit(submitted);
    if (!done && !onCancel) setValues(values);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field id={`${idPrefix}-prompt`} label="Énoncé">
        <Textarea
          id={`${idPrefix}-prompt`}
          value={values.prompt}
          onChange={(e) => setValues({ ...values, prompt: e.target.value })}
          rows={2}
          maxLength={300}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[0.9375rem] font-semibold">
          Propositions <span className="font-normal text-gris">(cochez la bonne réponse)</span>
        </legend>
        <ul className="space-y-2">
          {values.choices.map((choice, index) => (
            <li key={index} className="flex items-center gap-2">
              <label
                className={cn(
                  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-champ border transition-colors duration-200",
                  choice.isCorrect ? "border-succes bg-succes-fond" : "border-indigo/25",
                )}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-correct`}
                  checked={choice.isCorrect}
                  onChange={() => setCorrect(index)}
                  className="size-4 accent-succes"
                  aria-label={`Proposition ${index + 1} : bonne réponse`}
                />
              </label>
              <Input
                aria-label={`Proposition ${index + 1}`}
                value={choice.label}
                onChange={(e) => setLabel(index, e.target.value)}
                maxLength={160}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="discret"
                size="icone"
                onClick={() => removeChoice(index)}
                disabled={values.choices.length <= QUIZ_LIMITS.minChoices}
                aria-label={`Retirer la proposition ${index + 1}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        {values.choices.length < QUIZ_LIMITS.maxChoices ? (
          <Button
            type="button"
            variant="discret"
            size="sm"
            className="mt-2"
            onClick={() =>
              setValues({
                ...values,
                choices: [...values.choices, { label: "", isCorrect: false }],
              })
            }
          >
            <Plus aria-hidden="true" />
            Ajouter une proposition
          </Button>
        ) : null}
      </fieldset>
      {error ? (
        <p role="alert" className="petit font-semibold text-erreur">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="contour" size="sm" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

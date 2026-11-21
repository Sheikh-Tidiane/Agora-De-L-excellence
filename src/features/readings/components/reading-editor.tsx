"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useWatch } from "react-hook-form";
import { CheckboxField, TextareaField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import {
  removeReadingAction,
  submitReadingAction,
  updateReadingAction,
} from "@/features/readings/actions";
import {
  readingStatuses,
  readingStatusLabels,
  updateReadingSchema,
  type UpdateReadingInput,
} from "@/features/readings/schemas";
import { cn } from "@/lib/utils";

type Completion = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

/** Statut, progression, note personnelle et favori d'une lecture ; envoi en validation ; retrait. */
export function ReadingEditor({
  defaults,
  completion,
}: {
  defaults: UpdateReadingInput;
  completion: Completion;
}) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: updateReadingSchema,
    defaultValues: defaults,
    action: updateReadingAction,
    // L'action relit la page côté serveur (refresh) : le statut change ce qu'elle propose.
  });
  const status = useWatch({ control: form.control, name: "status" });
  const progress = useWatch({ control: form.control, name: "progress" });
  const locked = completion === "APPROVED";

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-[0.9375rem] font-semibold">Où en êtes-vous&nbsp;?</legend>
        <div className="grid grid-cols-3 gap-1 rounded-champ bg-sable p-1">
          {readingStatuses.map((code) => (
            <label
              key={code}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-[8px] px-2 text-center text-[0.9375rem] font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                status === code
                  ? "bg-blanc text-indigo shadow-posee"
                  : "text-gris hover:text-indigo",
                locked && code !== "FINISHED" && "pointer-events-none opacity-40",
              )}
            >
              <input
                type="radio"
                value={code}
                disabled={locked && code !== "FINISHED"}
                className="sr-only"
                {...form.register("status")}
              />
              {readingStatusLabels[code]}
            </label>
          ))}
        </div>
        {locked ? (
          <p className="petit mt-2 text-gris">
            Lecture validée par le club&nbsp;: elle reste terminée.
          </p>
        ) : null}
      </fieldset>

      {status === "READING" ? (
        <div>
          <label
            htmlFor="lecture-progress"
            className="mb-2 flex justify-between text-[0.9375rem] font-semibold"
          >
            Progression <span className="tabular-nums">{Number(progress)}&nbsp;%</span>
          </label>
          <input
            id="lecture-progress"
            type="range"
            min={0}
            max={100}
            step={5}
            className="h-11 w-full accent-terracotta"
            {...form.register("progress", { valueAsNumber: true })}
          />
        </div>
      ) : null}

      <TextareaField
        form={form}
        name="personalNote"
        label="Note personnelle"
        optional
        hint="Pour vous seul : citations, idées, questions pour la rencontre."
        rows={5}
        idPrefix="lecture"
      />
      <CheckboxField form={form} name="isFavorite" idPrefix="lecture">
        Parmi mes favoris
      </CheckboxField>

      {formError ? (
        <p role="alert" className="petit font-semibold text-erreur">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} className="max-sm:w-full">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <p aria-live="polite" className="petit font-semibold text-succes">
          {result && !pending ? "Lecture enregistrée." : null}
        </p>
      </div>
    </form>
  );
}

/** Demande de validation « livre terminé » : condition des points. */
export function SubmitForValidation({ readingId }: { readingId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div>
      <Button
        variant="action"
        disabled={pending}
        className="max-sm:w-full"
        onClick={() =>
          start(async () => {
            setError(undefined);
            const result = await submitReadingAction({ readingId });
            if (!result.ok) setError(result.message);
          })
        }
      >
        {pending ? "Envoi…" : "Demander la validation"}
      </Button>
      {error ? (
        <p role="alert" className="petit mt-2 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Retirer un livre de ses lectures, en deux temps. */
export function RemoveReading({ readingId }: { readingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  if (!confirming) {
    return (
      <Button variant="discret" size="sm" onClick={() => setConfirming(true)}>
        Retirer de mes lectures
      </Button>
    );
  }
  return (
    <div className="rounded-champ bg-alerte-fond p-4">
      <p className="petit font-semibold text-alerte">
        Votre progression et votre note personnelle seront effacées. Continuer&nbsp;?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await removeReadingAction({ readingId });
              if (result.ok) router.push("/member/readings");
              else setError(result.message);
            })
          }
        >
          {pending ? "Retrait…" : "Oui, retirer"}
        </Button>
        <Button size="sm" variant="discret" disabled={pending} onClick={() => setConfirming(false)}>
          Annuler
        </Button>
      </div>
      {error ? (
        <p role="alert" className="petit mt-2 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

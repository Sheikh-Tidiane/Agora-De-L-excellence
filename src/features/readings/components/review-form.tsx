"use client";

import { useWatch } from "react-hook-form";
import { CheckboxField, TextareaField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { saveReviewAction } from "@/features/readings/actions";
import { reviewSchema, type ReviewInput } from "@/features/readings/schemas";
import { cn } from "@/lib/utils";

/** Critique d'un livre terminé : une note de 1 à 5 en tuiles, un texte, l'accord de publication. */
export function ReviewForm({ defaults, isEdit }: { defaults: ReviewInput; isEdit: boolean }) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: reviewSchema,
    defaultValues: defaults,
    action: saveReviewAction,
  });
  const rating = Number(useWatch({ control: form.control, name: "rating" }));
  const ratingError = form.formState.errors.rating?.message;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-[0.9375rem] font-semibold">Votre note</legend>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              className={cn(
                "grid size-11 cursor-pointer place-items-center rounded-[8px] font-serif text-xl transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                value <= rating ? "bg-indigo text-ivoire" : "bg-blanc text-indigo shadow-posee",
              )}
            >
              <input
                type="radio"
                value={value}
                className="sr-only"
                aria-label={`${value} sur 5`}
                {...form.register("rating", { valueAsNumber: true })}
              />
              {value}
            </label>
          ))}
        </div>
        {ratingError ? (
          <p className="petit mt-1.5 font-semibold text-erreur">{ratingError}</p>
        ) : null}
      </fieldset>
      <TextareaField
        form={form}
        name="content"
        label="Votre critique"
        hint="Ce que le livre vous a apporté, ce qui vous a résisté. Relue par un responsable avant publication."
        rows={7}
        idPrefix="critique"
      />
      <CheckboxField form={form} name="publishWithFirstName" idPrefix="critique">
        Publier ma critique sous mon prénom sur la fiche publique du livre
        <span className="petit mt-0.5 block text-gris">
          Sans cette case, seuls les responsables la lisent.
        </span>
      </CheckboxField>
      {formError ? (
        <p role="alert" className="petit font-semibold text-erreur">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending} className="max-sm:w-full">
          {pending ? "Envoi…" : isEdit ? "Envoyer la nouvelle version" : "Envoyer ma critique"}
        </Button>
        <p aria-live="polite" className="petit font-semibold text-succes">
          {result && !pending
            ? "Critique envoyée : elle attend la relecture d’un responsable."
            : null}
        </p>
      </div>
    </form>
  );
}

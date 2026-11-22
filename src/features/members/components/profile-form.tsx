"use client";

import { CheckboxField, TextField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { updateOwnProfileAction } from "@/features/members/profile-actions";
import { ownProfileSchema, type OwnProfileInput } from "@/features/members/profile-schemas";

/** Ce que le membre modifie lui-même : son téléphone et sa présence dans les classements. */
export function ProfileForm({ defaults }: { defaults: OwnProfileInput }) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: ownProfileSchema,
    defaultValues: defaults,
    action: updateOwnProfileAction,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <TextField
        form={form}
        name="phone"
        label="Téléphone"
        optional
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="77 123 45 67"
        hint="Numéro sénégalais par défaut (+221). Utilisé par les responsables du club uniquement."
        idPrefix="profil"
      />
      <CheckboxField form={form} name="hiddenFromRankings" idPrefix="profil">
        Ne pas apparaître dans les classements de points
        <span className="petit mt-0.5 block text-gris">
          Vos points restent comptés et visibles de vous seul.
        </span>
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
          {result && !pending ? "Modifications enregistrées." : null}
        </p>
      </div>
    </form>
  );
}

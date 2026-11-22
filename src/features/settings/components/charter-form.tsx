"use client";

import { useWatch } from "react-hook-form";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { CheckboxField, TextareaField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { saveCharterAction } from "@/features/settings/actions";
import { charterSchema, type CharterInput } from "@/features/settings/charter-schema";
import { Markdown } from "@/lib/markdown";

/** Charte du club : le texte à gauche, son rendu public à droite. */
export function CharterForm({ initial, version }: { initial: CharterInput; version: number }) {
  const { run, toast } = useAdminAction();
  const { form, pending, formError, submit } = useActionForm({
    schema: charterSchema,
    defaultValues: initial,
    action: saveCharterAction,
    onSuccess: (data) =>
      void run(async () => ({ ok: true as const, data: undefined }), {
        success: data.changed
          ? `Charte enregistrée (version ${data.version}). La page publique est à jour.`
          : "Aucun changement.",
      }),
  });
  const content = useWatch({ control: form.control, name: "content" });

  return (
    <form onSubmit={submit} noValidate className="grid gap-x-12 gap-y-8 xl:grid-cols-2">
      <div className="flex flex-col gap-5">
        <FormError message={formError} />
        <TextareaField
          form={form}
          name="content"
          idPrefix="charte"
          label={`Texte de la charte (version ${version})`}
          rows={18}
          hint="Markdown : « - » pour une liste, « ## » pour un intertitre, **gras**. Modifier le texte crée une nouvelle version ; les demandes déjà reçues gardent celle qu’elles ont acceptée."
        />
        <CheckboxField form={form} name="provisional" idPrefix="charte">
          Version provisoire : la mention s’affiche sur la page et dans le formulaire d’adhésion,
          tant que le comité n’a pas validé le texte définitif
        </CheckboxField>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enregistrement…" : "Enregistrer la charte"}
          </Button>
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[0.9375rem] font-semibold">Aperçu</p>
        <div className="rounded-champ bg-blanc p-5 text-[1.0625rem] xl:sticky xl:top-24">
          <Markdown source={content ?? ""} />
        </div>
      </div>
      {toast}
    </form>
  );
}

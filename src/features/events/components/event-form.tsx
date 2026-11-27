"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWatch } from "react-hook-form";
import { useAdminAction } from "@/components/admin/use-admin-action";
import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { saveEventAction } from "@/features/events/admin-actions";
import { eventTypeCodes, eventTypeLabels, type EventTypeCode } from "@/features/events/rules";
import { eventSchema, type EventInput } from "@/features/events/schemas";

export const blankEvent: EventInput = {
  title: "",
  type: "RENDEZ_VOUS_LECTURE",
  activities: ["RENDEZ_VOUS_LECTURE"],
  summary: "",
  description: "",
  location: "",
  isTentative: false,
  program: "",
  speakerName: "",
  speakerTitle: "",
  speakerMode: "",
  videoLink: "",
  startsAt: "",
  endsAt: "",
  capacity: "",
  isPublic: false,
  cancellationDeadlineHours: "",
};

/** Fiche d'un événement : création (brouillon) ou modification. */
export function EventForm({
  id,
  initial,
  defaultDeadlineHours,
}: {
  id?: string;
  initial: EventInput;
  defaultDeadlineHours: number;
}) {
  const router = useRouter();
  const { run, toast } = useAdminAction();
  const { form, pending, formError, submit } = useActionForm({
    schema: eventSchema,
    defaultValues: initial,
    action: (values) => saveEventAction({ ...values, id }),
    onSuccess: (saved) => {
      if (id) {
        void run(async () => ({ ok: true as const, data: undefined }), {
          success: "Événement enregistré.",
        });
      } else {
        router.push(`/admin/events/${saved.id}`);
      }
    },
  });

  // L'activité principale est toujours l'une des activités cochées : décocher la principale
  // reporte ce rôle sur la première activité restante.
  const watched = useWatch({ control: form.control, name: "activities" }) as
    EventTypeCode[] | undefined;
  const checked = useMemo(() => watched ?? [], [watched]);
  const primary = useWatch({ control: form.control, name: "type" }) as EventTypeCode;
  useEffect(() => {
    if (checked.length > 0 && !checked.includes(primary)) {
      form.setValue("type", checked[0]!, { shouldDirty: true });
    }
  }, [checked, primary, form]);
  const activitiesError = form.formState.errors.activities?.message as string | undefined;
  const primaryOptions = eventTypeCodes
    .filter((code) => checked.includes(code))
    .map((value) => ({ value, label: eventTypeLabels[value] }));

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <TextField form={form} name="title" idPrefix="evt" label="Titre" autoComplete="off" />
      <fieldset aria-describedby={activitiesError ? "evt-activites-erreur" : "evt-activites-aide"}>
        <legend className="text-[0.9375rem] font-semibold">Activités de la rencontre</legend>
        <p id="evt-activites-aide" className="petit text-gris">
          Une rencontre peut en réunir plusieurs (lecture et quiz, débat et Agora Ciné…). Elle
          paraît sous chacune d’elles sur le site.
        </p>
        <div className="mt-1 grid sm:grid-cols-2 lg:grid-cols-3">
          {eventTypeCodes.map((value) => (
            <CheckboxField key={value} form={form} name="activities" value={value}>
              {eventTypeLabels[value]}
            </CheckboxField>
          ))}
        </div>
        {activitiesError ? (
          <p id="evt-activites-erreur" role="alert" className="petit font-semibold text-erreur">
            {activitiesError}
          </p>
        ) : null}
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <SelectField
          form={form}
          name="type"
          idPrefix="evt"
          label="Activité principale"
          hint="Affichée en premier, et seule comptée si les points ne vont qu’à l’activité principale."
          options={primaryOptions}
        />
        <TextField
          form={form}
          name="location"
          idPrefix="evt"
          label="Lieu"
          optional
          autoComplete="off"
          hint="Tel qu’il sera affiché au public. Vide : « Lieu à confirmer »."
        />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          form={form}
          name="startsAt"
          idPrefix="evt"
          label="Début"
          type="datetime-local"
          hint="Heure de Dakar."
        />
        <TextField
          form={form}
          name="endsAt"
          idPrefix="evt"
          label="Fin"
          optional
          type="datetime-local"
        />
      </div>
      <TextField
        form={form}
        name="summary"
        idPrefix="evt"
        label="Accroche"
        optional
        autoComplete="off"
        hint="Une phrase, affichée dans l’agenda sous le titre."
      />
      <TextareaField
        form={form}
        name="description"
        idPrefix="evt"
        label="Présentation"
        rows={8}
        hint="Laissez une ligne vide entre deux paragraphes."
      />
      <TextareaField
        form={form}
        name="program"
        idPrefix="evt"
        label="Déroulé"
        optional
        rows={5}
        hint="Une étape par ligne, sous la forme : 17 h 00 – 17 h 20 | Présentation du club."
      />
      <fieldset className="grid gap-5 border-t border-trait pt-5 md:grid-cols-2">
        <legend className="float-left mb-1 w-full text-[0.9375rem] font-semibold md:col-span-2">
          L’Invité de l’Agora et suivi à distance
        </legend>
        <TextField
          form={form}
          name="speakerName"
          idPrefix="evt"
          label="Nom de l’invité"
          optional
          autoComplete="off"
        />
        <TextField
          form={form}
          name="speakerTitle"
          idPrefix="evt"
          label="Qualité"
          optional
          autoComplete="off"
          hint="Par exemple : historienne, enseignant de lettres."
        />
        <SelectField
          form={form}
          name="speakerMode"
          idPrefix="evt"
          label="Présence de l’invité"
          optional
          placeholder="Sans invité"
          options={[
            { value: "ON_SITE", label: "Sur place" },
            { value: "REMOTE", label: "En visioconférence" },
          ]}
        />
        <TextField
          form={form}
          name="videoLink"
          idPrefix="evt"
          label="Lien de visio"
          optional
          type="url"
          autoComplete="off"
          hint="Visible uniquement des membres inscrits à la rencontre."
        />
      </fieldset>
      <div className="grid gap-5 md:grid-cols-2">
        <TextField
          form={form}
          name="capacity"
          idPrefix="evt"
          label="Nombre de places"
          optional
          inputMode="numeric"
          autoComplete="off"
          hint="Vide : sans limite."
        />
        <TextField
          form={form}
          name="cancellationDeadlineHours"
          idPrefix="evt"
          label="Délai d’annulation (heures)"
          optional
          inputMode="numeric"
          autoComplete="off"
          hint={`Vide : réglage du club (${defaultDeadlineHours} h avant le début).`}
        />
      </div>
      <CheckboxField
        form={form}
        name="isTentative"
        idPrefix="evt"
        className="border-t border-trait pt-2"
      >
        Date provisoire : la mention s’affiche à côté de la date
      </CheckboxField>
      <CheckboxField form={form} name="isPublic" idPrefix="evt" className="-mt-4">
        Ouvert au public : un visiteur peut s’inscrire avec son nom et son e-mail
      </CheckboxField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : id ? "Enregistrer" : "Créer le brouillon"}
        </Button>
      </div>
      {toast}
    </form>
  );
}

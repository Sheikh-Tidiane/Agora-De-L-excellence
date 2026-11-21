"use client";

import Link from "next/link";
import { useWatch } from "react-hook-form";
import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { submitMembershipRequestAction } from "@/features/memberships/actions";
import {
  ageRangeLabels,
  interestLabels,
  isMinor,
  membershipRequestSchema,
  occupationLabels,
  type MembershipRequestInput,
} from "@/features/memberships/schemas";

const options = (labels: Record<string, string>) =>
  Object.entries(labels).map(([value, label]) => ({ value, label }));

const defaults = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  ageRange: "",
  occupation: "",
  interests: [],
  motivation: "",
  guardianName: "",
  guardianPhone: "",
  consent: false,
  charter: false,
} as unknown as MembershipRequestInput;

/** Demande d'adhésion : un champ par ligne, deux minutes, sans créer de compte. */
export function MembershipForm({ charterProvisional }: { charterProvisional: boolean }) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: membershipRequestSchema,
    defaultValues: defaults,
    action: submitMembershipRequestAction,
  });
  const ageRange = useWatch({ control: form.control, name: "ageRange" });
  const minor = isMinor(ageRange);
  const interestsError = form.formState.errors.interests?.message as string | undefined;

  if (result) {
    return (
      <div role="status" className="rounded-feuille bg-blanc p-6 sm:p-8">
        <p className="surtitre">Demande envoyée</p>
        <h2 className="titre-2 mt-3">Merci, {form.getValues("firstName")}.</h2>
        <p className="mt-4 text-[1.0625rem]">
          Votre demande d’adhésion est enregistrée. Un accusé de réception vient de partir à{" "}
          <span className="font-semibold break-all">{form.getValues("email")}</span>.
        </p>
        <p className="mt-3 text-gris">
          Un responsable du club la lit, puis vous répond par e-mail. Si elle est acceptée, vous
          recevrez un lien pour activer votre espace membre.
        </p>
        <Link href="/events" className="lien mt-5 inline-flex min-h-11 items-center">
          En attendant, voir les prochaines rencontres
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />

      <TextField
        form={form}
        name="firstName"
        label="Prénom"
        autoComplete="given-name"
        autoCapitalize="words"
      />
      <TextField
        form={form}
        name="lastName"
        label="Nom"
        autoComplete="family-name"
        autoCapitalize="words"
      />
      <TextField
        form={form}
        name="email"
        label="Adresse e-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        hint="Elle servira d’identifiant à votre espace membre."
      />
      <TextField
        form={form}
        name="phone"
        label="Téléphone"
        optional
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="77 123 45 67"
        hint="Numéro sénégalais (+221) par défaut. Pour un autre pays, commencez par +."
      />
      <SelectField
        form={form}
        name="ageRange"
        label="Tranche d’âge"
        placeholder="Choisir…"
        options={options(ageRangeLabels)}
      />
      <SelectField
        form={form}
        name="occupation"
        label="Situation"
        placeholder="Choisir…"
        options={options(occupationLabels)}
      />

      {minor ? (
        <fieldset className="rounded-champ bg-sable p-4 sm:p-5">
          <legend className="float-left mb-1 w-full text-[0.9375rem] font-semibold">
            Parent ou tuteur
          </legend>
          <p className="petit clear-both mb-4 text-gris">
            Vous avez moins de 18 ans&nbsp;: le club a besoin du nom et du téléphone d’un adulte
            responsable de vous.
          </p>
          <div className="flex flex-col gap-4">
            <TextField
              form={form}
              name="guardianName"
              label="Nom du parent ou tuteur"
              autoComplete="off"
              autoCapitalize="words"
            />
            <TextField
              form={form}
              name="guardianPhone"
              label="Téléphone du parent ou tuteur"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="77 123 45 67"
            />
          </div>
        </fieldset>
      ) : null}

      <fieldset aria-describedby={interestsError ? "interets-erreur" : undefined}>
        <legend className="text-[0.9375rem] font-semibold">Ce qui vous attire au club</legend>
        <div className="mt-1 grid sm:grid-cols-2">
          {Object.entries(interestLabels).map(([value, label]) => (
            <CheckboxField key={value} form={form} name="interests" value={value}>
              {label}
            </CheckboxField>
          ))}
        </div>
        {interestsError ? (
          <p id="interets-erreur" className="petit font-semibold text-erreur">
            {interestsError}
          </p>
        ) : null}
      </fieldset>

      <TextareaField
        form={form}
        name="motivation"
        label="Un mot sur vous"
        optional
        rows={4}
        hint="Ce que vous lisez, ce que vous attendez du club… Rien d’obligatoire."
      />

      <CheckboxField form={form} name="consent" className="border-t border-indigo/20 pt-3">
        J’accepte que le club utilise ces informations pour traiter ma demande d’adhésion, comme
        l’explique la{" "}
        <Link href="/privacy" className="lien">
          page Confidentialité
        </Link>
        .
      </CheckboxField>
      <CheckboxField form={form} name="charter" className="-mt-3">
        J’accepte la{" "}
        <Link href="/charte" target="_blank" className="lien">
          charte du club
        </Link>
        {charterProvisional ? " (version provisoire)" : ""}.
      </CheckboxField>

      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer ma demande"}
      </Button>
    </form>
  );
}

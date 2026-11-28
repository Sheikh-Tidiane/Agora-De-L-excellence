"use client";

import { useAdminAction } from "@/components/admin/use-admin-action";
import { CheckboxField, TextField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { saveClubSettingsAction } from "@/features/settings/actions";
import {
  clubSettingsSchema,
  socialLabels,
  type ClubSettingsInput,
} from "@/features/settings/schemas";

function Group({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="grid gap-x-12 gap-y-5 border-t border-indigo/20 py-8 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <legend className="titre-3">{title}</legend>
        <p className="petit mt-1.5 text-gris">{hint}</p>
      </div>
      <div className="flex flex-col gap-5 lg:col-span-7">{children}</div>
    </fieldset>
  );
}

/** Paramètres du club : identité, coordonnées, réseaux, règles. Les champs vides ne s'affichent pas sur le site. */
export function SettingsForm({ initial }: { initial: ClubSettingsInput }) {
  const { run, toast } = useAdminAction();
  const { form, pending, formError, submit } = useActionForm({
    schema: clubSettingsSchema,
    defaultValues: initial,
    action: saveClubSettingsAction,
    onSuccess: (data) =>
      void run(async () => ({ ok: true as const, data: undefined }), {
        success:
          data.changed > 0 ? "Paramètres enregistrés. Le site est à jour." : "Aucun changement.",
      }),
  });

  return (
    <form onSubmit={submit} noValidate className="max-w-[72rem]">
      <FormError message={formError} className="mb-5" />
      <Group
        title="Identité"
        hint="Le nom affiché dans les pages, les e-mails et le pied de page. Le logo, lui, ne change pas."
      >
        <TextField form={form} name="name" idPrefix="reg" label="Nom du club" autoComplete="off" />
        <TextField
          form={form}
          name="shortName"
          idPrefix="reg"
          label="Forme courte"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="slogan"
          idPrefix="reg"
          label="Slogan"
          optional
          autoComplete="off"
          hint="Affiché sur l’accueil et dans le pied de page."
        />
      </Group>
      <Group
        title="Coordonnées"
        hint="Affichées sur la page Contact. L’adresse e-mail reçoit aussi les messages du formulaire de contact."
      >
        <TextField
          form={form}
          name="email"
          idPrefix="reg"
          label="E-mail du club"
          optional
          type="email"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="phone"
          idPrefix="reg"
          label="Téléphone"
          optional
          type="tel"
          autoComplete="off"
          placeholder="+221 77 123 45 67"
        />
        <TextField
          form={form}
          name="address"
          idPrefix="reg"
          label="Où nous trouver"
          optional
          autoComplete="off"
          hint="Lieu habituel des rencontres, tel qu’il doit apparaître au public."
        />
      </Group>
      <Group
        title="Réseaux sociaux"
        hint="Adresses complètes, en https://. Seuls les réseaux renseignés s’affichent."
      >
        {(Object.keys(socialLabels) as (keyof typeof socialLabels)[]).map((key) => (
          <TextField
            key={key}
            form={form}
            name={key}
            idPrefix="reg"
            label={socialLabels[key]}
            optional
            type="url"
            autoComplete="off"
          />
        ))}
      </Group>
      <Group
        title="Règles"
        hint="Valeurs par défaut du club. Un événement peut avoir son propre délai d’annulation."
      >
        <TextField
          form={form}
          name="cancellationDeadlineHours"
          idPrefix="reg"
          label="Délai d’annulation d’une inscription (heures avant le début)"
          inputMode="numeric"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="membershipDurationMonths"
          idPrefix="reg"
          label="Durée d’une adhésion (mois)"
          inputMode="numeric"
          autoComplete="off"
          hint="S’applique aux prochaines validations et aux renouvellements."
        />
      </Group>
      <Group
        title="Cotisations"
        hint="Montants en F CFA, affichés sur la page Adhésion et repris à chaque encaissement. Un changement ne modifie pas les encaissements déjà enregistrés."
      >
        <TextField
          form={form}
          name="membershipCardFee"
          idPrefix="reg"
          label="Carte de membre (F CFA)"
          inputMode="numeric"
          autoComplete="off"
          hint="Versée une fois, à l’adhésion."
        />
        <TextField
          form={form}
          name="sessionFee"
          idPrefix="reg"
          label="Participation par séance (F CFA)"
          inputMode="numeric"
          autoComplete="off"
        />
      </Group>
      <Group
        title="Régler à distance"
        hint="Pas de paiement en ligne sur le site : le membre envoie la somme sur l’un de ces numéros, avec son numéro de membre en référence. Un responsable enregistre ensuite l’encaissement. Un numéro vide n’est pas affiché."
      >
        <TextField
          form={form}
          name="waveNumber"
          idPrefix="reg"
          label="Numéro Wave du club"
          optional
          type="tel"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="orangeMoneyNumber"
          idPrefix="reg"
          label="Numéro Orange Money du club"
          optional
          type="tel"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="cardGraceDays"
          idPrefix="reg"
          label="Délai pour régler la carte (jours après l’acceptation)"
          inputMode="numeric"
          autoComplete="off"
          hint="Rappels au membre : 7 jours après l’acceptation, puis 3 jours avant la fin du délai."
        />
        <CheckboxField form={form} name="hideVideoWhenCardUnpaid">
          Masquer le lien de visio d’une rencontre aux membres dont la carte n’est pas réglée après
          ce délai
        </CheckboxField>
      </Group>
      <div className="sticky bottom-0 -mx-4 border-t border-trait bg-ivoire px-4 py-3 lg:-mx-10 lg:px-10">
        <Button type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
        </Button>
      </div>
      {toast}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError, FormNotice } from "@/features/auth/components/form-parts";
import {
  cancelGuestRegistrationAction,
  cancelMemberRegistrationAction,
  confirmGuestRegistrationAction,
  joinWaitlistAction,
  joinWaitlistGuestAction,
  registerGuestAction,
  registerMemberAction,
} from "@/features/events/actions";
import { guestRegistrationSchema } from "@/features/events/schemas";
import type { ActionResult } from "@/lib/errors";

/** Bouton relié à une action sans champ : état d'attente, erreur affichée dessous, page rafraîchie au succès. */
function ActionButton({
  action,
  children,
  pendingLabel,
  variant = "action",
  confirm,
}: {
  action: () => Promise<ActionResult<unknown>>;
  children: string;
  pendingLabel: string;
  variant?: "action" | "contour";
  /** Demande une seconde pression avant d'agir (annulation). */
  confirm?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [armed, setArmed] = useState(false);

  const run = () => {
    if (confirm && !armed) {
      setArmed(true);
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await action();
      if (result.ok) router.refresh();
      else setError(result.message);
      setArmed(false);
    });
  };

  return (
    <div>
      <Button
        variant={variant}
        size={variant === "action" ? "lg" : "md"}
        onClick={run}
        disabled={pending}
        className="max-sm:w-full"
      >
        {pending ? pendingLabel : armed ? confirm! : children}
      </Button>
      <FormError message={error} className="mt-3" />
    </div>
  );
}

/** Rencontre complète : le membre rejoint la liste d'attente (ou s'inscrit si une place s'est libérée). */
export function MemberJoinWaitlistButton({ eventId }: { eventId: string }) {
  return (
    <ActionButton action={() => joinWaitlistAction({ eventId })} pendingLabel="Un instant…">
      Rejoindre la liste d’attente
    </ActionButton>
  );
}

export function MemberLeaveWaitlistButton({ registrationId }: { registrationId: string }) {
  return (
    <ActionButton
      action={() => cancelMemberRegistrationAction({ registrationId })}
      pendingLabel="Un instant…"
      variant="contour"
      confirm="Confirmer : quitter la liste"
    >
      Quitter la liste d’attente
    </ActionButton>
  );
}

export function MemberRegisterButton({ eventId }: { eventId: string }) {
  return (
    <ActionButton action={() => registerMemberAction({ eventId })} pendingLabel="Inscription…">
      Je m’inscris
    </ActionButton>
  );
}

export function MemberCancelButton({ registrationId }: { registrationId: string }) {
  return (
    <ActionButton
      action={() => cancelMemberRegistrationAction({ registrationId })}
      pendingLabel="Annulation…"
      variant="contour"
      confirm="Confirmer l’annulation"
    >
      Annuler mon inscription
    </ActionButton>
  );
}

export function GuestConfirmButton({
  token,
  waitlist = false,
}: {
  token: string;
  waitlist?: boolean;
}) {
  return (
    <ActionButton
      action={() => confirmGuestRegistrationAction({ token })}
      pendingLabel="Confirmation…"
    >
      {waitlist ? "Confirmer ma place sur la liste" : "Confirmer mon inscription"}
    </ActionButton>
  );
}

export function GuestCancelButton({
  token,
  waitlist = false,
}: {
  token: string;
  waitlist?: boolean;
}) {
  return (
    <ActionButton
      action={() => cancelGuestRegistrationAction({ token })}
      pendingLabel={waitlist ? "Un instant…" : "Annulation…"}
      variant="contour"
      confirm={waitlist ? "Confirmer : quitter la liste" : "Confirmer l’annulation"}
    >
      {waitlist ? "Quitter la liste d’attente" : "Annuler mon inscription"}
    </ActionButton>
  );
}

/** Inscription d'un visiteur : nom + e-mail, puis confirmation par le lien reçu. */
export function GuestRegistrationForm({ eventId }: { eventId: string }) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: guestRegistrationSchema,
    defaultValues: { eventId, name: "", email: "" },
    action: registerGuestAction,
  });

  if (result) {
    return (
      <FormNotice>
        Presque fini : nous venons d’envoyer un e-mail à {form.getValues("email")}. Cliquez sur le
        lien qu’il contient pour confirmer votre place.
      </FormNotice>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <TextField
        form={form}
        name="name"
        idPrefix="invite"
        label="Prénom et nom"
        autoComplete="name"
        autoCapitalize="words"
      />
      <TextField
        form={form}
        name="email"
        idPrefix="invite"
        label="Adresse e-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        hint="Nous y envoyons le lien de confirmation. Rien d’autre."
      />
      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? "Envoi…" : "Réserver ma place"}
      </Button>
    </form>
  );
}

/** Rencontre complète : un visiteur demande une place sur la liste d'attente (nom + e-mail). */
export function GuestWaitlistForm({ eventId }: { eventId: string }) {
  const { form, pending, formError, result, submit } = useActionForm({
    schema: guestRegistrationSchema,
    defaultValues: { eventId, name: "", email: "" },
    action: joinWaitlistGuestAction,
  });

  if (result) {
    return (
      <FormNotice>
        {result.data.outcome === "verify"
          ? `Presque fini : nous venons d’envoyer un e-mail à ${form.getValues("email")}. Cliquez sur le lien qu’il contient pour prendre votre rang sur la liste d’attente.`
          : `Une place vient de se libérer ! Nous venons d’envoyer un e-mail à ${form.getValues("email")} : cliquez sur le lien qu’il contient pour confirmer votre place.`}
      </FormNotice>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormError message={formError} />
      <TextField
        form={form}
        name="name"
        idPrefix="attente"
        label="Prénom et nom"
        autoComplete="name"
        autoCapitalize="words"
      />
      <TextField
        form={form}
        name="email"
        idPrefix="attente"
        label="Adresse e-mail"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        hint="Pour confirmer votre rang, puis vous prévenir si une place se libère."
      />
      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? "Envoi…" : "Rejoindre la liste d’attente"}
      </Button>
    </form>
  );
}

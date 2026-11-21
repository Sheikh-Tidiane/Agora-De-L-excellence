"use client";

import { TextField, TextareaField } from "@/components/shared/form-fields";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError, FormNotice } from "@/features/auth/components/form-parts";
import { sendContactMessageAction } from "@/features/contact/actions";
import { contactSchema } from "@/features/contact/schemas";

export function ContactForm() {
  const { form, pending, formError, result, submit, reset } = useActionForm({
    schema: contactSchema,
    defaultValues: { name: "", email: "", subject: "", message: "", website: "" },
    action: sendContactMessageAction,
  });

  if (result) {
    return (
      <div>
        <FormNotice>
          Message envoyé. Le club vous répondra à l’adresse {form.getValues("email")}.
        </FormNotice>
        <Button variant="contour" className="mt-5" onClick={reset}>
          Écrire un autre message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <TextField
        form={form}
        name="name"
        label="Votre nom"
        autoComplete="name"
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
        hint="Pour que le club puisse vous répondre."
      />
      <TextField form={form} name="subject" label="Objet" />
      <TextareaField form={form} name="message" label="Votre message" rows={6} />
      {/* Champ piège pour les robots : hors écran, hors tabulation, ignoré des lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
        <label htmlFor="contact-website">Ne pas remplir</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          {...form.register("website")}
        />
      </div>
      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer le message"}
      </Button>
    </form>
  );
}

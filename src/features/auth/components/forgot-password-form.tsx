"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authConfig, authRoutes } from "@/config/auth";
import { forgotPasswordAction } from "@/features/auth/actions";
import { AuthHeading, FormError } from "@/features/auth/components/form-parts";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/features/auth/schemas";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await forgotPasswordAction(values);
      if (result.ok) {
        setSent(true);
        return;
      }
      if (result.fieldErrors?.email) setError("email", { message: result.fieldErrors.email });
      if (result.code !== "VALIDATION") setFormError(result.message);
    });
  });

  if (sent) {
    return (
      <div role="status">
        <AuthHeading surtitre="C’est parti" title="Regardez votre boîte de réception.">
          Si un compte existe avec cette adresse, un lien vient d’y être envoyé. Il reste valable{" "}
          {authConfig.resetLinkMinutes}&nbsp;minutes. Pensez à vérifier les courriers indésirables.
        </AuthHeading>
        <Link
          href={authRoutes.login}
          className={cn(
            buttonVariants({ variant: "principal", size: "lg", largeur: "pleine" }),
            "mt-8",
          )}
        >
          Revenir à la connexion
        </Link>
      </div>
    );
  }

  return (
    <>
      <AuthHeading surtitre="Mot de passe oublié" title="On vous renvoie la clé.">
        Indiquez l’adresse e-mail de votre compte&nbsp;: nous y envoyons un lien pour choisir un
        nouveau mot de passe.
      </AuthHeading>
      <form onSubmit={onSubmit} noValidate className="mt-8 flex flex-col gap-5">
        <FormError message={formError} />
        <Field id="email" label="Adresse e-mail" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "email-erreur" : undefined}
            {...register("email")}
          />
        </Field>
        <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
          {pending ? "Envoi…" : "Recevoir le lien"}
        </Button>
      </form>
      <p className="mt-6">
        <Link href={authRoutes.login} className="lien inline-flex min-h-11 items-center">
          Revenir à la connexion
        </Link>
      </p>
    </>
  );
}

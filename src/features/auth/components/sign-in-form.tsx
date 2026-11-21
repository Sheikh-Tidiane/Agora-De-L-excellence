"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authRoutes } from "@/config/auth";
import { signInAction } from "@/features/auth/actions";
import { FormError } from "@/features/auth/components/form-parts";
import { PasswordField } from "@/features/auth/components/password-field";
import { signInSchema, type SignInInput } from "@/features/auth/schemas";

export function SignInForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      // La destination demandée est lue dans l'adresse au moment de l'envoi ; le serveur la revalide.
      const next = new URLSearchParams(window.location.search).get("next") ?? undefined;
      const result = await signInAction({ ...values, next });
      if (result.ok) {
        // Navigation complète : l'espace protégé se charge avec la nouvelle session,
        // et le formulaire (avec le mot de passe saisi) quitte la mémoire de la page.
        window.location.assign(result.data.redirectTo);
        return;
      }
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        if (name === "email" || name === "password") setError(name, { message });
      }
      if (result.code !== "VALIDATION") setFormError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
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
      <PasswordField
        id="password"
        label="Mot de passe"
        autoComplete="current-password"
        error={errors.password?.message}
        aside={
          <Link
            href={authRoutes.forgotPassword}
            className="lien -mt-2.5 inline-flex min-h-11 items-center text-[0.9375rem]"
          >
            Mot de passe oublié&nbsp;?
          </Link>
        }
        {...register("password")}
      />
      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}

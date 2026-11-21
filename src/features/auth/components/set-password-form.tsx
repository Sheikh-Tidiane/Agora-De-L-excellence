"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { authConfig, authRoutes } from "@/config/auth";
import { activateAccountAction, resetPasswordAction } from "@/features/auth/actions";
import { FormError } from "@/features/auth/components/form-parts";
import { PasswordField } from "@/features/auth/components/password-field";
import { setPasswordSchema, type SetPasswordInput } from "@/features/auth/schemas";

const modes = {
  activation: {
    action: activateAccountAction,
    label: "Mot de passe",
    submit: "Activer mon compte",
    pending: "Activation…",
    notice: "activated",
  },
  reset: {
    action: resetPasswordAction,
    label: "Nouveau mot de passe",
    submit: "Enregistrer le mot de passe",
    pending: "Enregistrement…",
    notice: "reset",
  },
} as const;

/** Choix d'un mot de passe : activation d'un compte ou réinitialisation. */
export function SetPasswordForm({ mode, token }: { mode: keyof typeof modes; token: string }) {
  const config = modes[mode];
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SetPasswordInput>({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { token, password: "", confirmation: "" },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await config.action(values);
      if (result.ok) {
        // Navigation complète : le formulaire et le mot de passe saisi quittent la mémoire de la page.
        window.location.replace(`${authRoutes.login}?notice=${config.notice}`);
        return;
      }
      for (const [name, message] of Object.entries(result.fieldErrors ?? {})) {
        if (name === "password" || name === "confirmation") setError(name, { message });
      }
      if (result.code !== "VALIDATION" || result.fieldErrors?.token) setFormError(result.message);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <input type="hidden" {...register("token")} />
      <PasswordField
        id="password"
        label={config.label}
        autoComplete="new-password"
        hint={`Au moins ${authConfig.passwordMinLength} caractères. Une courte phrase se retient mieux qu’un mot compliqué.`}
        error={errors.password?.message}
        {...register("password")}
      />
      <PasswordField
        id="confirmation"
        label="Encore une fois"
        autoComplete="new-password"
        error={errors.confirmation?.message}
        {...register("confirmation")}
      />
      <Button type="submit" variant="action" size="lg" largeur="pleine" disabled={pending}>
        {pending ? config.pending : config.submit}
      </Button>
    </form>
  );
}

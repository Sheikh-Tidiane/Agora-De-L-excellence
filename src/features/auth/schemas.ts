import { z } from "zod";
import { authConfig } from "@/config/auth";

/** Schémas partagés par les formulaires (client) et les Server Actions (serveur). */
export const emailSchema = z
  .string({ error: "Indiquez votre adresse e-mail." })
  .trim()
  .toLowerCase()
  .min(1, "Indiquez votre adresse e-mail.")
  .max(254, "Cette adresse est trop longue.")
  .pipe(z.email({ error: "Cette adresse e-mail n’est pas valide." }));

export const newPasswordSchema = z
  .string({ error: "Choisissez un mot de passe." })
  .min(
    authConfig.passwordMinLength,
    `Au moins ${authConfig.passwordMinLength} caractères : une courte phrase fait très bien l’affaire.`,
  )
  .max(authConfig.passwordMaxLength, `Pas plus de ${authConfig.passwordMaxLength} caractères.`);

const tokenSchema = z.string().min(16).max(512);

export const signInSchema = z.object({
  email: emailSchema,
  password: z
    .string({ error: "Indiquez votre mot de passe." })
    .min(1, "Indiquez votre mot de passe.")
    .max(authConfig.passwordMaxLength, "Ce mot de passe est trop long."),
  next: z.string().max(512).optional(),
});
export type SignInInput = z.input<typeof signInSchema>;

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.input<typeof forgotPasswordSchema>;

const withConfirmation = z
  .object({
    token: tokenSchema,
    password: newPasswordSchema,
    confirmation: z.string({ error: "Saisissez le mot de passe une seconde fois." }),
  })
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne sont pas identiques.",
  });

export const setPasswordSchema = withConfirmation;
export type SetPasswordInput = z.input<typeof setPasswordSchema>;

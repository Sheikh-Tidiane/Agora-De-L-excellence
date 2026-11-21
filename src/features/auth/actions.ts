"use server";

import { refresh, updateTag } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { authRoutes, safeNextPath } from "@/config/auth";
import {
  forgotPasswordSchema,
  setPasswordSchema,
  signInSchema,
  type ForgotPasswordInput,
  type SetPasswordInput,
  type SignInInput,
} from "@/features/auth/schemas";
import { activateAccount, purgeExpiredVerifications } from "@/features/auth/service";
import { viewerTag } from "@/features/auth/viewer";
import { ACCOUNT_NOT_ACTIVE, auth } from "@/lib/auth";
import { AppError, parseInput, runAction, type ActionResult } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { can, loadUserAccess } from "@/lib/permissions";
import { clientAddress } from "@/lib/request";
import { enforceRateLimit, purgeExpiredRateLimits, resetRateLimit } from "@/lib/rate-limit";

/**
 * Actions d'authentification. Ce sont les seules portes d'entrée vers Better Auth :
 * chacune valide son entrée (Zod) et limite le débit avant tout accès aux comptes.
 * Connexion, mot de passe oublié, réinitialisation et activation sont publiques par nature ;
 * la déconnexion exige une session.
 */

function isBlockedAccount(error: unknown): boolean {
  if (!(error instanceof APIError)) return false;
  const body = error.body as { code?: string; message?: string } | undefined;
  return body?.code === ACCOUNT_NOT_ACTIVE || body?.message === ACCOUNT_NOT_ACTIVE;
}

export async function signInAction(
  input: SignInInput,
): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction("auth.signIn", async () => {
    const data = parseInput(signInSchema, input);
    await enforceRateLimit("auth.sign-in.ip", await clientAddress());
    await enforceRateLimit("auth.sign-in.email", data.email);

    let userId: string;
    try {
      const result = await auth.api.signInEmail({
        body: { email: data.email, password: data.password, rememberMe: true },
        headers: await headers(),
      });
      userId = result.user.id;
    } catch (error) {
      if (isBlockedAccount(error)) {
        throw new AppError(
          "FORBIDDEN",
          "Ce compte n’est pas actif. Écrivez au club pour en savoir plus.",
        );
      }
      if (error instanceof APIError) {
        // Même message que l'adresse existe ou non : on ne révèle pas quels comptes existent.
        throw new AppError("INVALID_CREDENTIALS");
      }
      throw error;
    }

    await resetRateLimit("auth.sign-in.email", data.email);
    const user = await loadUserAccess(userId);
    const requested = safeNextPath(data.next);
    const home = can(user, "admin.access") ? authRoutes.admin : authRoutes.member;
    // On ne renvoie vers l'administration que ceux qui y ont accès.
    const redirectTo =
      requested && (!requested.startsWith(authRoutes.admin) || can(user, "admin.access"))
        ? requested
        : home;
    return { redirectTo };
  });
}

export async function signOutAction(): Promise<void> {
  // Pas de `requireUser()` ici, volontairement : fermer une session ne donne accès à rien, et un compte
  // suspendu (session encore en base, mais plus « actif ») doit pouvoir être déconnecté lui aussi.
  await auth.api.signOut({ headers: await headers() }).catch(() => undefined);
  // Le header lu côté serveur est gardé une minute par le navigateur : on le vide tout de suite.
  updateTag(viewerTag);
  refresh();
  redirect(authRoutes.login);
}

export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<ActionResult> {
  return runAction("auth.forgotPassword", async () => {
    const data = parseInput(forgotPasswordSchema, input);
    await enforceRateLimit("auth.forgot-password.ip", await clientAddress());
    await enforceRateLimit("auth.forgot-password.email", data.email);
    try {
      // Répond de la même façon que le compte existe ou non. L'e-mail part de lib/auth (sendResetPassword).
      await auth.api.requestPasswordReset({
        body: { email: data.email, redirectTo: authRoutes.resetPassword },
        headers: await headers(),
      });
    } catch (error) {
      // Un échec d'envoi ne doit pas révéler l'existence du compte : il est journalisé, pas affiché.
      logger.error("Demande de réinitialisation en échec", error);
    }
    // Ménage opportuniste des jetons et compteurs expirés, sans faire attendre le visiteur.
    void Promise.all([purgeExpiredVerifications(), purgeExpiredRateLimits()]).catch(
      () => undefined,
    );
    return undefined;
  });
}

export async function resetPasswordAction(input: SetPasswordInput): Promise<ActionResult> {
  return runAction("auth.resetPassword", async () => {
    const data = parseInput(setPasswordSchema, input);
    await enforceRateLimit("auth.reset-password.ip", await clientAddress());
    try {
      await auth.api.resetPassword({
        body: { newPassword: data.password, token: data.token },
        headers: await headers(),
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw new AppError(
          "INVALID_TOKEN",
          "Ce lien n’est plus valable. Demandez-en un nouveau depuis « Mot de passe oublié ».",
        );
      }
      throw error;
    }
    return undefined;
  });
}

export async function activateAccountAction(input: SetPasswordInput): Promise<ActionResult> {
  return runAction("auth.activate", async () => {
    const data = parseInput(setPasswordSchema, input);
    await enforceRateLimit("auth.activate.ip", await clientAddress());
    await activateAccount(data.token, data.password);
    return undefined;
  });
}

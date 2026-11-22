import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { authConfig, authRoutes, RESET_PASSWORD_PREFIX } from "@/config/auth";
import { site } from "@/config/site";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { resetPasswordEmail } from "@/lib/mail/templates";
import { prisma } from "@/lib/prisma";
import { sendActivationEmail } from "@/features/auth/service";

/** Code d'erreur levé quand un compte existe mais n'a pas le droit de se connecter. */
export const ACCOUNT_NOT_ACTIVE = "ACCOUNT_NOT_ACTIVE";

/**
 * Better Auth : e-mail + mot de passe, sessions en base (adaptateur Prisma).
 *
 * - Inscription publique désactivée : un compte naît de la validation d'une adhésion
 *   (ou de `pnpm create-admin`), puis s'active par lien (features/auth/service.ts).
 * - Aucun endpoint HTTP `/api/auth/*` n'est exposé : tout passe par les Server Actions de
 *   features/auth/actions.ts, qui valident (Zod) et limitent le débit avant d'appeler `auth.api`.
 * - Les rôles et permissions ne sont pas gérés ici mais par lib/permissions.
 */
export const auth = betterAuth({
  appName: site.name,
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: authConfig.passwordMinLength,
    maxPasswordLength: authConfig.passwordMaxLength,
    resetPasswordTokenExpiresIn: authConfig.resetLinkMinutes * 60,
    // Changer de mot de passe ferme toutes les sessions ouvertes.
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, token }) {
      const account = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, firstName: true, email: true, status: true },
      });
      if (!account) return;
      if (account.status === "PENDING_ACTIVATION") {
        // Compte jamais activé : on renvoie un lien d'activation plutôt qu'un lien de réinitialisation.
        await sendActivationEmail(account.id, null);
        return;
      }
      if (account.status !== "ACTIVE") {
        logger.info("Réinitialisation ignorée : compte inactif", { userId: account.id });
        return;
      }
      await sendMail(
        resetPasswordEmail({
          to: account.email,
          firstName: account.firstName,
          url: `${env.APP_URL}${authRoutes.resetPassword}?token=${encodeURIComponent(token)}`,
          validMinutes: authConfig.resetLinkMinutes,
        }),
      );
      await audit({
        actorId: null,
        action: "auth.password_reset_requested",
        entityType: "User",
        entityId: account.id,
      });
    },
    async onPasswordReset({ user }) {
      await audit({
        actorId: user.id,
        action: "auth.password_reset",
        entityType: "User",
        entityId: user.id,
      });
    },
  },

  session: {
    expiresIn: authConfig.sessionDays * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  // Jeton de réinitialisation du mot de passe : seule son empreinte SHA-256 est stockée
  // (`Verification.identifier`), comme pour les liens d'activation (features/auth/service.ts).
  // Un jeton aléatoire de 256 bits n'a pas besoin d'un hachage lent ni d'un sel : le deviner
  // reste impossible, et une fuite de la base (ou d'une sauvegarde) ne donne aucun lien utilisable.
  // Les autres identifiants (aucun aujourd'hui) restent tels quels.
  verification: {
    storeIdentifier: { default: "plain", overrides: { [RESET_PASSWORD_PREFIX]: "hashed" } },
  },

  // La limitation de débit est faite en amont par lib/rate-limit (en base), action par action.
  rateLimit: { enabled: false },

  advanced: {
    cookiePrefix: authConfig.cookiePrefix,
    useSecureCookies: env.APP_URL.startsWith("https://"),
  },

  databaseHooks: {
    session: {
      create: {
        // Dernier verrou avant l'ouverture d'une session : seuls les comptes actifs se connectent.
        async before(session) {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { status: true },
          });
          if (user?.status !== "ACTIVE") {
            await audit({
              actorId: null,
              action: "auth.sign_in_blocked",
              entityType: "User",
              entityId: session.userId,
              metadata: { status: user?.status ?? "INCONNU" },
            });
            throw new APIError("FORBIDDEN", {
              code: ACCOUNT_NOT_ACTIVE,
              message: ACCOUNT_NOT_ACTIVE,
            });
          }
        },
      },
    },
  },

  // `nextCookies` doit rester le dernier plugin : il pose les cookies depuis les Server Actions.
  plugins: [nextCookies()],
});

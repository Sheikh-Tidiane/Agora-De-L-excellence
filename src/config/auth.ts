/** Réglages d'authentification. Voir docs/REGLES-METIER.md. */
export const authConfig = {
  /** Longueur minimale du mot de passe (une phrase courte vaut mieux qu'un mot compliqué). */
  passwordMinLength: 10,
  passwordMaxLength: 128,
  /** Validité du lien d'activation envoyé à la validation de l'adhésion. */
  activationLinkDays: 7,
  /** Validité du lien de réinitialisation du mot de passe. */
  resetLinkMinutes: 60,
  /** Durée d'une session ; prolongée à chaque jour d'utilisation. */
  sessionDays: 30,
  /** Préfixe des cookies de session. */
  cookiePrefix: "agora",
} as const;

export const authRoutes = {
  login: "/login",
  activate: "/activate",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  accessDenied: "/access-denied",
  member: "/member",
  admin: "/admin",
} as const;

/** Destinations permises après connexion : chemins internes connus, jamais une adresse externe. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  // Ni espace ni caractère de contrôle (retour à la ligne dans un en-tête `Location`, tabulation
  // que le navigateur efface et qui recompose « // »), ni segment « .. » (sortie de l'espace visé).
  if (/[\s\u0000-\u001f\u007f]/.test(next) || /(^|\/)\.\.?(\/|$|\?)/.test(next)) return null;
  // Espaces protégés, ou fiche d'une rencontre (« Connectez-vous pour vous inscrire »).
  if (/^\/(member|admin)(\/|$|\?)/.test(next)) return next;
  return /^\/events\/[a-z0-9-]{1,120}$/.test(next) ? next : null;
}

/** Préfixe des jetons de réinitialisation chez Better Auth (`reset-password:<jeton>`). */
export const RESET_PASSWORD_PREFIX = "reset-password:";

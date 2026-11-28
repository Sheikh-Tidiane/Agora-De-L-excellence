import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

/**
 * Limitation de débit en base (pas de Redis) : fenêtre fixe, incrément atomique en une requête SQL.
 * La clé stockée est un HMAC de l'action et de l'identifiant : ni IP ni e-mail en clair.
 */
export type RateLimitRule = {
  /** Nombre de tentatives permises par fenêtre. */
  limit: number;
  /** Durée de la fenêtre, en secondes. */
  windowSeconds: number;
};

/** Règles par défaut. Modifiables ici ; voir docs/REGLES-METIER.md. */
export const rateLimits = {
  /** Connexion, par adresse e-mail visée : freine la recherche de mot de passe sur un compte. */
  "auth.sign-in.email": { limit: 5, windowSeconds: 15 * 60 },
  /** Connexion, par adresse IP : freine le balayage de nombreux comptes. */
  "auth.sign-in.ip": { limit: 20, windowSeconds: 15 * 60 },
  "auth.forgot-password.email": { limit: 3, windowSeconds: 60 * 60 },
  "auth.forgot-password.ip": { limit: 10, windowSeconds: 60 * 60 },
  "auth.reset-password.ip": { limit: 10, windowSeconds: 60 * 60 },
  "auth.activate.ip": { limit: 10, windowSeconds: 60 * 60 },
  /**
   * Adhésion : la limite qui compte est par adresse e-mail (3 demandes par jour). Celle par IP est
   * large exprès : le jour du lancement, une salle entière adhère depuis le même Wi-Fi (une seule
   * adresse IP), et les opérateurs mobiles partagent aussi une adresse entre leurs abonnés.
   */
  "membership.submit.email": { limit: 3, windowSeconds: 24 * 60 * 60 },
  "membership.submit.ip": { limit: 100, windowSeconds: 60 * 60 },
  /** Inscription d'un visiteur à une rencontre : même logique que l'adhésion. */
  "events.guest.email": { limit: 3, windowSeconds: 24 * 60 * 60 },
  "events.guest.ip": { limit: 100, windowSeconds: 60 * 60 },
  /** Liste d'attente d'un membre : freine les allers-retours entrée / sortie. */
  "events.waitlist.user": { limit: 10, windowSeconds: 60 * 60 },
  /** Formulaire de contact : limite stricte par IP (un message arrive dans la boîte du club). */
  "contact.ip": { limit: 5, windowSeconds: 60 * 60 },
  /** Confirmation ou annulation par le lien reçu par e-mail : le jeton protège déjà, la limite reste large. */
  "public.token.ip": { limit: 30, windowSeconds: 60 * 60 },
  /** Un membre qui régénère sa carte de membre, par compte. */
  "member.card.regenerate": { limit: 3, windowSeconds: 60 * 60 },
  /** Photo de profil envoyée ou retirée, par membre : freine le remplissage du disque. */
  "member.photo.user": { limit: 10, windowSeconds: 60 * 60 },
  /**
   * Scan des présences, par responsable : une file d'une centaine de membres passe en quelques
   * minutes, mais un balayage de jetons forgés est freiné.
   */
  "attendance.scan.user": { limit: 240, windowSeconds: 10 * 60 },
  /** Recherche d'un inscrit (saisie de secours), par responsable. */
  "attendance.search.user": { limit: 120, windowSeconds: 10 * 60 },
  /** Quiz en ligne (départ, réponses, fin), par membre : large pour un humain, freine le martèlement. */
  "quiz.play.user": { limit: 150, windowSeconds: 10 * 60 },
  /** Questions à l'assistant, par membre : freine les rafales (le quota quotidien est à part). */
  "assistant.ask.user": { limit: 5, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof rateLimits;

export type RateLimitState = {
  allowed: boolean;
  remaining: number;
  /** Secondes avant la fin de la fenêtre en cours. */
  retryAfter: number;
};

export function rateLimitKey(name: string, identifier: string): string {
  const digest = createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`${name}:${identifier.trim().toLowerCase()}`)
    .digest("base64url");
  return `${name}:${digest}`;
}

/** Calcul pur de l'état à partir du compteur : exporté pour les tests. */
export function evaluate(
  rule: RateLimitRule,
  count: number,
  windowStart: Date,
  now: Date,
): RateLimitState {
  const elapsed = (now.getTime() - windowStart.getTime()) / 1000;
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfter: Math.max(1, Math.ceil(rule.windowSeconds - elapsed)),
  };
}

/** Compte une tentative et dit si elle est permise. */
export async function consumeRateLimit(
  name: RateLimitName,
  identifier: string,
): Promise<RateLimitState> {
  const rule: RateLimitRule = rateLimits[name];
  const key = rateLimitKey(name, identifier);
  const rows = await prisma.$queryRaw<{ count: number; windowStart: Date; now: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, now(), now() + make_interval(secs => ${rule.windowSeconds}), now(), now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN now() ELSE "RateLimit"."windowStart" END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= now()
        THEN now() + make_interval(secs => ${rule.windowSeconds}) ELSE "RateLimit"."expiresAt" END,
      "updatedAt" = now()
    RETURNING "count", "windowStart", now() AS "now"`;
  const row = rows[0]!;
  return evaluate(rule, row.count, row.windowStart, row.now);
}

/** Comme `consumeRateLimit`, mais lève une `AppError` RATE_LIMITED si la limite est dépassée. */
export async function enforceRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const state = await consumeRateLimit(name, identifier);
  if (!state.allowed) {
    const minutes = Math.ceil(state.retryAfter / 60);
    throw new AppError(
      "RATE_LIMITED",
      `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.`,
      { retryAfter: state.retryAfter },
    );
  }
}

/** Remet un compteur à zéro (après une connexion réussie, par exemple). */
export async function resetRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key: rateLimitKey(name, identifier) } });
}

/** Supprime les compteurs expirés. Appelée de temps en temps, sans bloquer la requête. */
export async function purgeExpiredRateLimits(): Promise<number> {
  const { count } = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}

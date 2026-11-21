import "server-only";
import { prisma } from "@/lib/prisma";
import { rateLimitKey } from "@/lib/rate-limit";

/**
 * Quota quotidien de l'assistant, par membre, en base (docs/DECISIONS.md §14).
 *
 * Stockage : une ligne de la table `RateLimit` par membre et par jour, clé HMAC de
 * `assistant.daily` + identifiant + jour (aucun identifiant en clair, aucun contenu de conversation).
 * Le jour est celui de Dakar, c'est-à-dire le jour UTC (UTC+0 toute l'année, sans heure d'été).
 * La ligne expire le lendemain de minuit : `purgeExpiredRateLimits` la nettoie.
 */
const QUOTA_NAME = "assistant.daily";

/** « 2026-11-15 » : le jour de Dakar de `now`. */
export function dakarDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Minuit (heure de Dakar) qui suit `now` : moment où le quota revient. */
export function nextDakarMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function quotaKey(userId: string, day: string): string {
  return rateLimitKey(QUOTA_NAME, `${userId}:${day}`);
}

export type QuotaReservation =
  | { allowed: true; day: string; used: number; remaining: number; resetsAt: Date }
  | { allowed: false; day: string; used: number; remaining: 0; resetsAt: Date };

/**
 * Réserve une question si le membre n'a pas atteint `limit` aujourd'hui. Une seule requête SQL,
 * atomique : l'incrément n'a lieu que sous la limite (`ON CONFLICT … WHERE`). Deux requêtes
 * simultanées sur le dernier crédit ne passent pas toutes les deux : la seconde attend le verrou de
 * la ligne, relit le compteur à jour et n'obtient aucune ligne.
 */
export async function reserveQuestion(
  userId: string,
  limit: number,
  now: Date = new Date(),
): Promise<QuotaReservation> {
  const day = dakarDay(now);
  const resetsAt = nextDakarMidnight(now);
  const expiresAt = new Date(resetsAt.getTime() + 24 * 60 * 60 * 1000);
  const key = quotaKey(userId, day);
  if (limit < 1) return { allowed: false, day, used: 0, remaining: 0, resetsAt };
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart", "expiresAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, ${now}, ${expiresAt}, now(), now())
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimit"."count" + 1, "updatedAt" = now()
      WHERE "RateLimit"."count" < ${limit}
    RETURNING "count"`;
  const row = rows[0];
  if (!row) {
    return { allowed: false, day, used: await usedOn(key, limit), remaining: 0, resetsAt };
  }
  const used = Number(row.count);
  return { allowed: true, day, used, remaining: Math.max(0, limit - used), resetsAt };
}

/**
 * Rend la question réservée quand le membre n'a reçu aucune réponse (échec du fournisseur ou
 * annulation avant le premier mot). Le compteur ne descend jamais sous zéro.
 */
export async function refundQuestion(userId: string, day: string): Promise<void> {
  const key = quotaKey(userId, day);
  await prisma.$executeRaw`
    UPDATE "RateLimit" SET "count" = GREATEST("count" - 1, 0), "updatedAt" = now()
    WHERE "key" = ${key}`;
}

async function usedOn(key: string, limit: number): Promise<number> {
  const row = await prisma.rateLimit.findUnique({ where: { key }, select: { count: true } });
  return Math.min(row?.count ?? 0, limit);
}

export type QuotaUsage = { day: string; used: number; remaining: number; resetsAt: Date };

/** Questions déjà posées aujourd'hui, sans rien compter. */
export async function readQuota(
  userId: string,
  limit: number,
  now: Date = new Date(),
): Promise<QuotaUsage> {
  const day = dakarDay(now);
  const used = await usedOn(quotaKey(userId, day), limit);
  return { day, used, remaining: Math.max(0, limit - used), resetsAt: nextDakarMidnight(now) };
}

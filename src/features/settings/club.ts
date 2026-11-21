import { cacheLife, cacheTag } from "next/cache";
import {
  defaultClubSettings,
  mergeSettings,
  settingKeys,
  socialLabels,
  type ClubSettings,
} from "@/features/settings/schemas";
import { audit } from "@/lib/audit";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/** Réglages du club lus en base, sans cache (administration, services). */
export async function loadClubSettings(): Promise<ClubSettings> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.values(settingKeys) } },
  });
  return mergeSettings(rows);
}

/** Réglages du club pour les pages publiques (mis en cache, invalidés à chaque modification). */
export async function getClubSettings(): Promise<ClubSettings> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.settings);
  try {
    return await loadClubSettings();
  } catch (error) {
    logger.error("Réglages du club illisibles : valeurs par défaut utilisées", error);
    return defaultClubSettings;
  }
}

/** Réseaux sociaux renseignés, dans l'ordre d'affichage. */
export function socialLinks(settings: ClubSettings): { label: string; href: string }[] {
  return (Object.keys(socialLabels) as (keyof typeof socialLabels)[])
    .filter((key) => settings[key])
    .map((key) => ({ label: socialLabels[key], href: settings[key] }));
}

/** Destinataire du formulaire de contact : l'adresse saisie par le club, sinon `CONTACT_EMAIL`. */
export function contactRecipient(settings: ClubSettings): string | null {
  return settings.email || env.CONTACT_EMAIL || null;
}

/** Enregistre les réglages (une ligne par clé) et trace les clés modifiées. */
export async function updateClubSettings(next: ClubSettings, actorId: string): Promise<string[]> {
  const current = await loadClubSettings();
  const changed = (Object.keys(settingKeys) as (keyof ClubSettings)[]).filter(
    (field) => current[field] !== next[field],
  );
  if (changed.length === 0) return [];
  await prisma.$transaction(async (tx) => {
    for (const field of changed) {
      const key = settingKeys[field];
      await tx.setting.upsert({
        where: { key },
        update: { value: next[field], updatedById: actorId },
        create: { key, value: next[field], updatedById: actorId },
      });
    }
    await audit(
      {
        actorId,
        action: "settings.updated",
        entityType: "Setting",
        metadata: { keys: changed.map((field) => settingKeys[field]) },
      },
      tx,
    );
  });
  return changed;
}

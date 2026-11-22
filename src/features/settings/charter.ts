import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { charterSchema, defaultCharter, type Charter } from "@/features/settings/charter-schema";
import { audit } from "@/lib/audit";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/**
 * Charte du club (règlement intérieur), page publique `/charte`.
 * Le texte vit dans la table `Setting` et se modifie depuis l'administration. Chaque changement
 * du texte incrémente la version : la version acceptée est enregistrée avec la demande d'adhésion.
 */
export { charterSchema, defaultCharter } from "@/features/settings/charter-schema";
export type { Charter, CharterInput } from "@/features/settings/charter-schema";

const keys = {
  content: "charter.content",
  version: "charter.version",
  provisional: "charter.provisional",
} as const;

/** Charte lue en base, sans cache (administration, enregistrement d'une demande). */
export async function loadCharter(): Promise<Charter> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(keys) } } });
  const byKey = new Map(rows.map((row) => [row.key, row]));
  const content = byKey.get(keys.content)?.value;
  const version = byKey.get(keys.version)?.value;
  const provisional = byKey.get(keys.provisional)?.value;
  return {
    content: typeof content === "string" && content.trim() ? content : defaultCharter.content,
    version: typeof version === "number" && version >= 1 ? version : defaultCharter.version,
    provisional: typeof provisional === "boolean" ? provisional : defaultCharter.provisional,
    updatedAt: byKey.get(keys.content)?.updatedAt ?? null,
  };
}

/** Charte pour les pages publiques (en cache, invalidée à chaque modification). */
export async function getCharter(): Promise<Charter> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.settings);
  try {
    return await loadCharter();
  } catch (error) {
    logger.error("Charte illisible : version provisoire par défaut utilisée", error);
    return defaultCharter;
  }
}

/** Enregistre la charte. La version n'augmente que si le texte change. */
export async function updateCharter(
  next: z.output<typeof charterSchema>,
  actorId: string,
): Promise<{ version: number; changed: boolean }> {
  const current = await loadCharter();
  const textChanged = current.content.trim() !== next.content;
  const flagChanged = current.provisional !== next.provisional;
  if (!textChanged && !flagChanged) return { version: current.version, changed: false };
  const version = textChanged ? current.version + 1 : current.version;
  await prisma.$transaction(async (tx) => {
    const entries: [string, string | number | boolean][] = [
      [keys.content, next.content],
      [keys.version, version],
      [keys.provisional, next.provisional],
    ];
    for (const [key, value] of entries) {
      await tx.setting.upsert({
        where: { key },
        update: { value, updatedById: actorId },
        create: { key, value, updatedById: actorId },
      });
    }
    await audit(
      {
        actorId,
        action: "charter.updated",
        entityType: "Charter",
        metadata: { version, textChanged, provisional: next.provisional },
      },
      tx,
    );
  });
  return { version, changed: true };
}

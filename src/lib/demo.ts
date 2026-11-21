import { cacheLife, cacheTag } from "next/cache";
import { logger } from "@/lib/logger";
import { countDemoData } from "@/lib/demo-data";

/** Étiquette de cache à invalider quand des données de démonstration sont créées ou supprimées. */
export const DEMO_CACHE_TAG = "demo-data";

/**
 * Reste-t-il des données de démonstration en base ? Pilote le bandeau (CLAUDE.md §5).
 * Mis en cache : le serveur revérifie chaque minute. `pnpm db:clear-demo` s'exécute hors de Next.js
 * et ne peut pas invalider le cache : le bandeau disparaît dans les minutes qui suivent.
 */
export async function hasDemoData(): Promise<boolean> {
  "use cache";
  // `stale` ≥ 5 min : condition pour que le bandeau fasse partie de la coquille statique (pas de saut de mise en page).
  cacheLife({ stale: 300, revalidate: 60, expire: 3600 });
  cacheTag(DEMO_CACHE_TAG);
  try {
    const counts = await countDemoData();
    return Object.values(counts).some((count) => count > 0);
  } catch (error) {
    // Base injoignable (pendant un build, par exemple) : on n'affirme rien, et on le consigne.
    logger.error("Impossible de vérifier la présence de données de démonstration", error);
    return false;
  }
}

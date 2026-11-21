/**
 * Étiquettes de cache des contenus publics. Chaque lecture publique est mise en cache
 * (`"use cache"`) sous l'une d'elles ; chaque action d'administration qui modifie le contenu
 * appelle `updateTag` avec la même étiquette, pour que le site reflète le changement aussitôt.
 */
export const cacheTags = {
  books: "books",
  events: "events",
  articles: "articles",
  settings: "settings",
  committee: "committee",
  scrabble: "scrabble",
  demo: "demo-data",
} as const;

/**
 * Durée de vie des contenus publics. `stale` ≥ 5 min : condition pour faire partie de la coquille
 * statique. Le serveur revérifie chaque minute : un changement fait hors de Next.js (seed, script)
 * ou une publication programmée apparaît en quelques minutes.
 */
export const publicCacheLife = { stale: 300, revalidate: 60, expire: 3600 } as const;

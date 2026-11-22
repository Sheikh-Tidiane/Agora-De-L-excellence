/**
 * Exécuté une fois au démarrage du serveur Next.js.
 * Valide les variables d'environnement : une configuration invalide arrête le démarrage
 * avec un message clair, au lieu d'échouer plus tard au milieu d'une requête.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    getEnv();
  }
}

import { env } from "@/lib/env";

/**
 * Le « Compagnon des Lettres » est-il disponible ? Seulement si la clé d'accès (`LLM_API_KEY`) ET
 * le modèle (`LLM_MODEL`) sont configurés (une valeur vide compte comme absente). Sinon, l'assistant
 * n'existe pas pour les membres : ni lien, ni encart, page et route en 404.
 *
 * Source unique : navigation, tableau de bord, page, route et fournisseur (`getLLMProvider`)
 * s'appuient tous dessus. Lu à chaque requête (jamais figé au build) : dès que la clé et le modèle
 * sont renseignés et l'application redémarrée, tout réapparaît sans autre changement.
 */
export function isAssistantEnabled(
  config: { LLM_API_KEY?: string; LLM_MODEL?: string } = env,
): boolean {
  return Boolean(config.LLM_API_KEY?.trim() && config.LLM_MODEL?.trim());
}

/** Page de l'assistant (et ses sous-adresses) : 404 dans le proxy tant qu'il n'est pas configuré. */
export function isAssistantPath(pathname: string): boolean {
  return pathname === "/member/assistant" || pathname.startsWith("/member/assistant/");
}

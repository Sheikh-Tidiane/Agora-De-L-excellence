import "server-only";
import { headers } from "next/headers";

/**
 * Adresse du visiteur, pour la limitation de débit uniquement (jamais stockée en clair).
 * Lue dans `X-Forwarded-For` : le proxy inverse doit écraser cet en-tête (voir docs/DECISIONS.md).
 */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "inconnue";
}

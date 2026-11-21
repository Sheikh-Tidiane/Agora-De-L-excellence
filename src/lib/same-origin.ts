import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Contrôle d'origine des Route Handlers qui modifient quelque chose (POST, DELETE).
 * Les Server Actions en bénéficient déjà (Next compare `Origin` et `Host`) ; les Route Handlers
 * non : sans ce contrôle, seul le cookie `SameSite=Lax` empêche un autre site, ou un sous-domaine
 * (« same-site »), de déclencher un envoi au nom d'un responsable connecté.
 *
 * Règle, dans l'ordre :
 * - `Sec-Fetch-Site` présent : seuls `same-origin` et `none` passent ;
 * - `Origin` présent : il doit désigner l'hôte de la requête (`Host` ou `X-Forwarded-Host`, que le
 *   navigateur de la victime fixe lui-même) ou celui de `APP_URL` ; `null` est refusé ;
 * - ni l'un ni l'autre : client hors navigateur (script, test), accepté : il lui faut de toute
 *   façon une session valide, et un navigateur moderne envoie toujours `Origin` sur un POST.
 */
export function isSameOriginRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;
  let originHost: string;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    originHost = parsed.host.toLowerCase();
  } catch {
    return false; // « null » (iframe isolée, redirection) ou valeur illisible.
  }

  const allowed = new Set<string>();
  const add = (host: string | null | undefined) => {
    const value = host?.split(",")[0]?.trim().toLowerCase();
    if (value) allowed.add(value);
  };
  add(request.headers.get("x-forwarded-host"));
  add(request.headers.get("host"));
  try {
    add(new URL(request.url).host);
  } catch {
    // Adresse relative : seuls les en-têtes comptent.
  }
  try {
    add(new URL(env.APP_URL).host);
  } catch {
    // APP_URL est validée au démarrage ; rien à ajouter si elle manquait.
  }
  return allowed.has(originHost);
}

/** Lève FORBIDDEN (403) si la requête vient d'une autre origine. À appeler après le contrôle d'accès. */
export function assertSameOrigin(request: Request): void {
  if (!isSameOriginRequest(request)) {
    throw new AppError("FORBIDDEN", "Requête refusée : elle ne vient pas du site du club.");
  }
}

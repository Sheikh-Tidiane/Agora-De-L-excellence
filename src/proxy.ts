import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { authConfig, authRoutes } from "@/config/auth";
import { isAssistantEnabled, isAssistantPath } from "@/features/assistant/enabled";
import { logger } from "@/lib/logger";
import { publicPageExists, type PublicSection } from "@/lib/public-pages";

/**
 * Premier filtre (Next.js 16 : `proxy`, ex-`middleware`), avant tout rendu.
 *
 * 1. Espaces protégés : contrôle optimiste ; sans cookie de session, on renvoie tout de suite à la
 *    connexion. Ce n'est PAS le contrôle d'accès : la session et les permissions sont vérifiées en
 *    base dans chaque layout, page et Server Action (lib/permissions).
 * 2. Fiches publiques (livre, article, rencontre, tournoi) : une adresse inconnue répond « 404 Not
 *    Found » (la page « introuvable », avec le bon code). Sans ce contrôle, le prérendu partiel
 *    envoie 200 avant que la page ne découvre l'absence de la fiche.
 * 3. Assistant non configuré (`isAssistantEnabled`) : `/member/assistant` répond 404.
 */
const PUBLIC_SHEET = /^\/(library|news|events|scrabble)\/([^/]+)$/;
/** Pages fixes rangées sous ces préfixes : jamais des fiches. */
const FIXED = new Set(["/events/registration", "/events/avis"]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Assistant non configuré : il n'existe pas (vrai 404, même pour un membre connecté).
  if (isAssistantPath(pathname) && !isAssistantEnabled()) {
    return NextResponse.rewrite(new URL("/introuvable", request.url), { status: 404 });
  }
  // Pages publiques fixes (lien personnel d'un invité) : jamais de contrôle de session.
  if (FIXED.has(pathname)) return NextResponse.next();
  const sheet = PUBLIC_SHEET.exec(pathname);
  if (sheet) {
    try {
      const exists = await publicPageExists(
        sheet[1] as PublicSection,
        decodeURIComponent(sheet[2]!),
      );
      if (!exists) {
        return NextResponse.rewrite(new URL("/introuvable", request.url), { status: 404 });
      }
    } catch (error) {
      // Base injoignable : la page décide elle-même (elle affiche « introuvable » si besoin).
      logger.error("Vérification d’une fiche publique impossible", error);
    }
    return NextResponse.next();
  }

  const hasSession = getSessionCookie(request, { cookiePrefix: authConfig.cookiePrefix });
  if (hasSession) return NextResponse.next();
  const login = new URL(authRoutes.login, request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/member/:path*",
    "/admin/:path*",
    "/library/:slug",
    "/news/:slug",
    "/events/:slug",
    "/scrabble/:slug",
  ],
};

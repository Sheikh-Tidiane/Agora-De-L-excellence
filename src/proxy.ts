import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { authConfig, authRoutes } from "@/config/auth";

/**
 * Premier filtre des espaces protégés (Next.js 16 : `proxy`, ex-`middleware`).
 * Contrôle optimiste : sans cookie de session, on renvoie tout de suite à la connexion.
 * Ce n'est PAS le contrôle d'accès : la session et les permissions sont vérifiées en base
 * dans chaque layout, page et Server Action (lib/permissions).
 */
export function proxy(request: NextRequest) {
  const hasSession = getSessionCookie(request, { cookiePrefix: authConfig.cookiePrefix });
  if (hasSession) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  const login = new URL(authRoutes.login, request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/member/:path*", "/admin/:path*"],
};

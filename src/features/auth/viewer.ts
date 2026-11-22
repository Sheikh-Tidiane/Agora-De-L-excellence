import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { headers } from "next/headers";
import { getSessionCookie } from "better-auth/cookies";
import { authConfig, authRoutes } from "@/config/auth";
import { can, getCurrentUser } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

/**
 * Qui regarde la page, pour adapter les boutons d'action du site public (un
 * membre ne voit jamais d'appel à adhérer). Ce n'est PAS un contrôle d'accès : les pages et les
 * actions vérifient toujours la session et les permissions en base.
 */
export type Viewer =
  | { kind: "visitor" }
  /** Membre : `cardPaid` dit si sa carte de membre est encaissée. */
  | { kind: "member"; firstName: string; cardPaid: boolean }
  /** Responsable (accès à l'administration), membre ou non. */
  | { kind: "staff"; firstName: string };

export const viewerTag = "viewer";

/**
 * Lu côté serveur, à la requête. `use cache: private` : jamais stocké sur le serveur, mais gardé
 * par le navigateur une minute, ce qui rend les navigations instantanées (le header ne repasse
 * pas par un état d'attente à chaque page). La déconnexion vide ce cache (`refresh`).
 */
export async function getViewer(): Promise<Viewer> {
  "use cache: private";
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  cacheTag(viewerTag);
  // Sans cookie de session, inutile d'interroger la base.
  if (!getSessionCookie(await headers(), { cookiePrefix: authConfig.cookiePrefix })) {
    return { kind: "visitor" };
  }
  const user = await getCurrentUser();
  if (!user) return { kind: "visitor" };
  if (can(user, "admin.access")) return { kind: "staff", firstName: user.firstName };
  if (!can(user, "member.access")) return { kind: "visitor" };
  const card = await prisma.payment.count({
    where: { userId: user.id, kind: "MEMBERSHIP_CARD", cancelledAt: null },
  });
  return { kind: "member", firstName: user.firstName, cardPaid: card > 0 };
}

/** Où mène « Mon espace » : l'administration pour un responsable, l'espace membre sinon. */
export function spaceHref(viewer: Exclude<Viewer, { kind: "visitor" }>): string {
  return viewer.kind === "staff" ? authRoutes.admin : authRoutes.member;
}

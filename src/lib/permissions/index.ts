import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authRoutes } from "@/config/auth";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { can, canAccessOwned, type CurrentUser } from "@/lib/permissions/can";
import type { PermissionCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

export { can, canAll, canAny, canAccessOwned, type CurrentUser } from "@/lib/permissions/can";
export type { PermissionCode, RoleCode } from "@/lib/permissions/catalog";

/** Charge l'utilisateur, ses rôles et ses permissions depuis la base. `null` s'il n'est pas actif. */
export async function loadUserAccess(userId: string): Promise<CurrentUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      memberNumber: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              code: true,
              permissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      },
    },
  });
  // Un compte suspendu ou archivé perd l'accès immédiatement, même avec une session encore valide.
  if (!user || user.status !== "ACTIVE") return null;
  const permissions = new Set<string>();
  for (const { role } of user.roles) {
    for (const { permission } of role.permissions) permissions.add(permission.code);
  }
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    name: user.name,
    email: user.email,
    memberNumber: user.memberNumber,
    roles: user.roles.map(({ role }) => role.code),
    permissions: [...permissions],
  };
}

/**
 * Utilisateur de la requête en cours, ou `null`. La session est vérifiée en base à chaque requête
 * (pas de cache de session dans le cookie) ; le résultat est mémorisé le temps d'un rendu.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return loadUserAccess(session.user.id);
});

/**
 * Première ligne de toute Server Action ou Route Handler réservée aux connectés.
 * Lève `UNAUTHENTICATED` (converti en résultat typé par `runAction`).
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("UNAUTHENTICATED");
  return user;
}

/** Première ligne de toute Server Action ou Route Handler soumise à une permission. */
export async function requirePermission(permission: PermissionCode): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user, permission)) throw new AppError("FORBIDDEN");
  return user;
}

/** Vérifie que l'utilisateur possède la ressource, ou détient la permission de gestion. */
export async function requireOwnership(
  ownerId: string | null | undefined,
  managePermission?: PermissionCode,
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canAccessOwned(user, ownerId, managePermission)) throw new AppError("FORBIDDEN");
  return user;
}

/**
 * Variante pour les pages et layouts : redirige au lieu de lever.
 * Sans session : vers la connexion (avec retour prévu). Sans la permission : vers « Accès refusé ».
 */
export async function requirePageAccess(
  permission: PermissionCode | null,
  returnTo: string,
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${authRoutes.login}?next=${encodeURIComponent(returnTo)}`);
  if (permission && !can(user, permission)) redirect(authRoutes.accessDenied);
  return user;
}

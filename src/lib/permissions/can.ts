import type { PermissionCode } from "@/lib/permissions/catalog";

/** Ce que les contrôles d'accès ont besoin de savoir d'un utilisateur connecté. */
export type CurrentUser = {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  memberNumber: string | null;
  roles: readonly string[];
  permissions: readonly string[];
};

type Subject = Pick<CurrentUser, "permissions"> | null | undefined;

/** L'utilisateur détient-il cette permission ? Sans utilisateur : toujours non. */
export function can(user: Subject, permission: PermissionCode): boolean {
  return !!user && user.permissions.includes(permission);
}

/** Toutes les permissions demandées. */
export function canAll(user: Subject, permissions: readonly PermissionCode[]): boolean {
  return permissions.every((permission) => can(user, permission));
}

/** Au moins une des permissions demandées. */
export function canAny(user: Subject, permissions: readonly PermissionCode[]): boolean {
  return permissions.some((permission) => can(user, permission));
}

/**
 * Propriété d'une ressource : un membre n'agit que sur ce qui lui appartient,
 * sauf s'il détient la permission de gestion correspondante.
 */
export function canAccessOwned(
  user: (Pick<CurrentUser, "permissions"> & { id: string }) | null | undefined,
  ownerId: string | null | undefined,
  managePermission?: PermissionCode,
): boolean {
  if (!user) return false;
  if (ownerId && ownerId === user.id) return true;
  return managePermission ? can(user, managePermission) : false;
}

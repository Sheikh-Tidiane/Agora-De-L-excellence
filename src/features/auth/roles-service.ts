import { createPendingUser, sendActivationEmail } from "@/features/auth/service";
import { audit } from "@/lib/audit";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { RoleCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

/**
 * Comptes administratifs et rôles (super-administrateur). Chaque attribution et chaque retrait
 * est tracé dans `AuditLog`. Deux garde-fous : on ne se retire pas à soi-même le rôle de
 * super-administrateur, et il en reste toujours au moins un d'actif.
 */

/** Ce qui change entre deux jeux de rôles. Fonction pure. */
export function roleChanges(current: readonly string[], next: readonly string[]) {
  return {
    added: next.filter((role) => !current.includes(role)),
    removed: current.filter((role) => !next.includes(role)),
  };
}

/** Raison de refuser un changement de rôles, ou `null` s'il est permis. Fonction pure. */
export function refuseRoleChange(input: {
  isSelf: boolean;
  removed: readonly string[];
  /** Nombre d'autres super-administrateurs actifs. */
  otherSuperAdmins: number;
}): string | null {
  if (!input.removed.includes("super_admin")) return null;
  if (input.isSelf) {
    return "Vous ne pouvez pas vous retirer le rôle de super-administrateur. Demandez-le à un autre super-administrateur.";
  }
  if (input.otherSuperAdmins === 0) {
    return "Il doit rester au moins un super-administrateur actif.";
  }
  return null;
}

export async function setUserRoles(
  userId: string,
  next: RoleCode[],
  actorId: string,
): Promise<{ added: string[]; removed: string[] }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { status: true, roles: { select: { role: { select: { code: true } } } } },
    });
    if (!user || user.status === "ARCHIVED") throw new AppError("NOT_FOUND", "Compte introuvable.");
    const current = user.roles.map(({ role }) => role.code);
    const { added, removed } = roleChanges(current, next);
    if (added.length === 0 && removed.length === 0) return { added, removed };

    const otherSuperAdmins = await tx.user.count({
      where: {
        id: { not: userId },
        status: "ACTIVE",
        roles: { some: { role: { code: "super_admin" } } },
      },
    });
    const refusal = refuseRoleChange({ isSelf: userId === actorId, removed, otherSuperAdmins });
    if (refusal) throw new AppError("FORBIDDEN", refusal);

    const roles = await tx.role.findMany({ where: { code: { in: [...added, ...removed] } } });
    const idOf = new Map(roles.map((role) => [role.code, role.id]));
    for (const code of removed) {
      await tx.userRole.deleteMany({ where: { userId, roleId: idOf.get(code)! } });
      await audit(
        {
          actorId,
          action: "roles.revoked",
          entityType: "User",
          entityId: userId,
          metadata: { role: code },
        },
        tx,
      );
    }
    for (const code of added) {
      await tx.userRole.create({
        data: { userId, roleId: idOf.get(code)!, assignedById: actorId },
      });
      await audit(
        {
          actorId,
          action: "roles.assigned",
          entityType: "User",
          entityId: userId,
          metadata: { role: code },
        },
        tx,
      );
    }
    return { added, removed };
  });
}

/** Crée le compte d'un responsable (en attente d'activation) et lui envoie son lien. */
export async function createStaffAccount(
  input: { firstName: string; lastName: string; email: string; roles: RoleCode[] },
  actorId: string,
): Promise<{ emailSent: boolean }> {
  const user = await createPendingUser(input, actorId);
  try {
    await sendActivationEmail(user.id, actorId);
    return { emailSent: true };
  } catch (error) {
    logger.error("E-mail d’activation non envoyé (compte de responsable)", error);
    return { emailSent: false };
  }
}

"use server";

import {
  staffAccountSchema,
  userRolesSchema,
  type StaffAccountInput,
} from "@/features/auth/roles-schemas";
import { createStaffAccount, setUserRoles } from "@/features/auth/roles-service";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";

/** Comptes administratifs et rôles : réservé à `roles.manage` (super-administrateur). */

export async function createStaffAccountAction(
  input: StaffAccountInput,
): Promise<ActionResult<{ emailSent: boolean }>> {
  return runAction("roles.createStaff", async () => {
    const actor = await requirePermission("roles.manage");
    return createStaffAccount(parseInput(staffAccountSchema, input), actor.id);
  });
}

export async function setUserRolesAction(input: {
  userId: string;
  roles: string[];
}): Promise<ActionResult<{ added: string[]; removed: string[] }>> {
  return runAction("roles.set", async () => {
    const actor = await requirePermission("roles.manage");
    const { userId, roles } = parseInput(userRolesSchema, input);
    return setUserRoles(userId, roles, actor.id);
  });
}

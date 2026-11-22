import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { ALL_ROLES, type RoleCode } from "@/lib/permissions/catalog";

const roles = z.array(z.enum(ALL_ROLES as [RoleCode, ...RoleCode[]])).max(ALL_ROLES.length);
/** Un rôle cité deux fois ne compte qu'une fois (sinon : double écriture, erreur interne). */
const unique = (list: RoleCode[]) => [...new Set(list)];

const name = (missing: string) =>
  z.string({ error: missing }).trim().min(2, missing).max(60, "Pas plus de 60 caractères.");

export const staffAccountSchema = z.object({
  firstName: name("Indiquez le prénom."),
  lastName: name("Indiquez le nom."),
  email: emailSchema,
  roles: roles.min(1, "Choisissez au moins un rôle.").transform(unique),
});
export type StaffAccountInput = z.input<typeof staffAccountSchema>;

export const userRolesSchema = z.object({
  userId: z.string().min(1).max(40),
  roles: roles.transform(unique),
});

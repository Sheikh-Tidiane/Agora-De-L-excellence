import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const id = z.string().min(1).max(40);
export const memberIdSchema = z.object({ userId: id });

const name = (missing: string) =>
  z.string({ error: missing }).trim().min(2, missing).max(60, "Pas plus de 60 caractères.");

const phoneMessage = "Indiquez un numéro valide, par exemple 77 123 45 67.";

export const memberUpdateSchema = z.object({
  userId: id,
  firstName: name("Indiquez le prénom."),
  lastName: name("Indiquez le nom."),
  phone: z
    .string()
    .trim()
    .max(30, phoneMessage)
    .refine((value) => value === "" || normalizePhone(value) !== null, { message: phoneMessage })
    .transform((value) => (value === "" ? null : normalizePhone(value))),
});
export type MemberUpdateInput = z.input<typeof memberUpdateSchema>;

export const suspendSchema = z.object({
  userId: id,
  reason: z.string().trim().max(300, "Pas plus de 300 caractères."),
});

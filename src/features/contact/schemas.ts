import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";

export const contactSchema = z.object({
  name: z
    .string({ error: "Indiquez votre nom." })
    .trim()
    .min(2, "Indiquez votre nom.")
    .max(80, "Pas plus de 80 caractères."),
  email: emailSchema,
  subject: z
    .string({ error: "Indiquez l’objet de votre message." })
    .trim()
    .min(3, "Indiquez l’objet de votre message.")
    .max(120, "Pas plus de 120 caractères.")
    // L'objet devient l'en-tête « Subject » de l'e-mail : une seule ligne, sans retour chariot.
    .regex(/^[^\r\n]*$/, "L’objet tient sur une seule ligne."),
  message: z
    .string({ error: "Écrivez votre message." })
    .trim()
    .min(20, "Dites-nous-en un peu plus : au moins 20 caractères.")
    .max(3000, "Pas plus de 3 000 caractères."),
  /** Champ piège, invisible : un humain le laisse vide. */
  website: z.string().max(200).optional(),
});
export type ContactInput = z.input<typeof contactSchema>;

export const contactStatuses = ["NEW", "READ", "HANDLED"] as const;
export type ContactStatus = (typeof contactStatuses)[number];

export const contactStatusLabels: Record<ContactStatus, string> = {
  NEW: "Nouveau",
  READ: "Lu",
  HANDLED: "Traité",
};

export const contactStatusSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(contactStatuses),
});
export type ContactStatusInput = z.input<typeof contactStatusSchema>;

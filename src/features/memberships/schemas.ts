import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { interestLabels } from "@/config/activities";
import { normalizePhone } from "@/lib/phone";

/** Demande d'adhésion : même schéma dans le formulaire et dans la Server Action. */
export const ageRangeLabels = {
  UNDER_15: "Moins de 15 ans",
  FROM_15_TO_17: "15 à 17 ans",
  FROM_18_TO_25: "18 à 25 ans",
  FROM_26_TO_35: "26 à 35 ans",
  OVER_35: "Plus de 35 ans",
} as const;
export const occupationLabels = {
  PUPIL: "Élève",
  STUDENT: "Étudiant·e",
  WORKER: "En activité",
  OTHER: "Autre",
} as const;
/** Un centre d'intérêt par activité du club (libellés : src/config/activities.ts). */
export { interestLabels };

export type AgeRangeCode = keyof typeof ageRangeLabels;
const ageRanges = Object.keys(ageRangeLabels) as [AgeRangeCode, ...AgeRangeCode[]];
const occupations = Object.keys(occupationLabels) as [
  keyof typeof occupationLabels,
  ...(keyof typeof occupationLabels)[],
];
const interests = Object.keys(interestLabels) as [
  keyof typeof interestLabels,
  ...(keyof typeof interestLabels)[],
];

/** Moins de 18 ans : le nom et le téléphone d'un parent ou tuteur sont obligatoires. */
export const isMinor = (ageRange: string | undefined) =>
  ageRange === "UNDER_15" || ageRange === "FROM_15_TO_17";

const name = (missing: string) =>
  z.string({ error: missing }).trim().min(2, missing).max(60, "Pas plus de 60 caractères.");

const phoneMessage = "Indiquez un numéro valide, par exemple 77 123 45 67.";
/** Téléphone facultatif : vide → null, sinon normalisé en +221… */
const optionalPhone = z
  .string()
  .trim()
  .max(30, phoneMessage)
  .refine((value) => value === "" || normalizePhone(value) !== null, { message: phoneMessage })
  .transform((value) => (value === "" ? null : normalizePhone(value)));

export const membershipRequestSchema = z
  .object({
    firstName: name("Indiquez votre prénom."),
    lastName: name("Indiquez votre nom."),
    email: emailSchema,
    phone: optionalPhone,
    ageRange: z.enum(ageRanges, { error: "Choisissez votre tranche d’âge." }),
    occupation: z.enum(occupations, { error: "Choisissez votre situation." }),
    interests: z
      .array(z.enum(interests))
      .min(1, "Cochez au moins une activité qui vous attire.")
      .max(interests.length),
    motivation: z.string().trim().max(1000, "Pas plus de 1 000 caractères."),
    guardianName: z.string().trim().max(120, "Pas plus de 120 caractères."),
    guardianPhone: optionalPhone,
    consent: z.boolean().refine((value) => value === true, {
      message: "Votre accord est nécessaire pour traiter la demande.",
    }),
    /** Facultatif : publication de photos, vidéos ou témoignage identifiables. */
    mediaConsent: z.boolean({ error: "Cochez ou décochez la case." }),
    charter: z.boolean().refine((value) => value === true, {
      message: "L’adhésion suppose d’accepter la charte du club.",
    }),
  })
  .superRefine((value, ctx) => {
    if (!isMinor(value.ageRange)) return;
    if (value.guardianName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["guardianName"],
        message: "Indiquez le nom d’un parent ou tuteur.",
      });
    }
    if (!value.guardianPhone) {
      ctx.addIssue({
        code: "custom",
        path: ["guardianPhone"],
        message: "Indiquez le téléphone d’un parent ou tuteur.",
      });
    }
  });

export type MembershipRequestInput = z.input<typeof membershipRequestSchema>;
export type MembershipRequestData = z.output<typeof membershipRequestSchema>;

const id = z.string().min(1).max(40);
export const requestIdsSchema = z.object({ ids: z.array(id).min(1).max(100) });
export const rejectRequestSchema = z.object({
  id,
  reason: z.string().trim().max(500, "Pas plus de 500 caractères."),
});

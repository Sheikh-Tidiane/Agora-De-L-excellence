import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { normalizeActivities } from "@/config/activities";
import { eventTypeCodes } from "@/features/events/rules";
import { parseLocalDateTime } from "@/lib/dates";

const id = z.string().min(1).max(40);

export const eventIdSchema = z.object({ eventId: id });
export const registrationIdSchema = z.object({ registrationId: id });
/** Promotion manuelle depuis la liste d'attente ; `force` : au-delà de la capacité, confirmé. */
export const promoteSchema = z.object({ registrationId: id, force: z.boolean() });
export const registrationTokenSchema = z.object({ token: z.string().min(16).max(200) });

export const guestRegistrationSchema = z.object({
  eventId: id,
  name: z
    .string({ error: "Indiquez votre nom." })
    .trim()
    .min(2, "Indiquez votre prénom et votre nom.")
    .max(80, "Pas plus de 80 caractères."),
  email: emailSchema,
});
export type GuestRegistrationInput = z.input<typeof guestRegistrationSchema>;

/** Nombre entier facultatif saisi dans un champ texte : « » → null. */
const optionalInt = (min: number, max: number, message: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((value, ctx) => {
      if (value === "" || value === null || value === undefined) return null;
      const number = Number(value);
      if (!Number.isInteger(number) || number < min || number > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return number;
    });

const dateTime = (message: string) =>
  z
    .string({ error: message })
    .transform((value) => parseLocalDateTime(value))
    .refine((value): value is Date => value !== null, { message });

/** Fiche d'un événement dans l'administration. */
export const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Donnez un titre à la rencontre.").max(120),
    /** Activité principale : affichage, tri ; doit faire partie de `activities`. */
    type: z.enum(eventTypeCodes, { error: "Choisissez l’activité principale." }),
    /** Toutes les activités de la rencontre (au moins une). Doublons retirés. */
    activities: z
      .array(z.enum(eventTypeCodes, { error: "Activité inconnue." }), {
        error: "Choisissez au moins une activité.",
      })
      .min(1, "Choisissez au moins une activité.")
      .max(eventTypeCodes.length, `Pas plus de ${eventTypeCodes.length} activités.`)
      .transform((list) => [...new Set(list)]),
    summary: z.string().trim().max(240, "Pas plus de 240 caractères."),
    description: z.string().trim().min(10, "Décrivez la rencontre en quelques phrases.").max(5000),
    /** Vide : « Lieu à confirmer ». */
    location: z.string().trim().max(160, "Pas plus de 160 caractères."),
    isTentative: z.boolean(),
    program: z.string().trim().max(3000, "Pas plus de 3 000 caractères."),
    speakerName: z.string().trim().max(120, "Pas plus de 120 caractères."),
    speakerTitle: z.string().trim().max(160, "Pas plus de 160 caractères."),
    speakerMode: z.enum(["", "ON_SITE", "REMOTE"]),
    videoLink: z
      .string()
      .trim()
      .max(300, "Cette adresse est trop longue.")
      .refine((value) => value === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(value), {
        message: "Indiquez une adresse complète, qui commence par https://",
      }),
    startsAt: dateTime("Indiquez la date et l’heure de début."),
    /** Vide : pas d'heure de fin. Une valeur illisible est refusée, pas ignorée. */
    endsAt: z
      .string()
      .optional()
      .transform((value, ctx) => {
        if (!value) return null;
        const date = parseLocalDateTime(value);
        if (!date) {
          ctx.addIssue({
            code: "custom",
            message: "Indiquez une date et une heure de fin valides.",
          });
          return z.NEVER;
        }
        return date;
      }),
    capacity: optionalInt(1, 5000, "Un nombre de places entre 1 et 5 000, ou rien."),
    isPublic: z.boolean(),
    cancellationDeadlineHours: optionalInt(0, 720, "Entre 0 et 720 heures, ou rien."),
  })
  .refine((value) => value.activities.includes(value.type), {
    path: ["type"],
    message: "L’activité principale doit faire partie des activités cochées.",
  })
  .refine((value) => !value.endsAt || value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "La fin doit être après le début.",
  })
  .refine((value) => !value.speakerName || value.speakerMode !== "", {
    path: ["speakerMode"],
    message: "Précisez si l’invité vient sur place ou intervient à distance.",
  })
  // En dernier : une transformation arrête les vérifications qui la suivent quand une précédente
  // échoue ; placée ici, toutes les erreurs remontent en une seule fois.
  .transform((value) => ({
    ...value,
    activities: normalizeActivities(value.type, value.activities),
  }));
export type EventInput = z.input<typeof eventSchema>;
export type EventData = z.output<typeof eventSchema>;

/** Compte rendu d'une rencontre passée (Markdown). `publish` le rend visible du public. */
export const eventReportSchema = z.object({
  eventId: id,
  content: z.string().trim().max(20_000, "Pas plus de 20 000 caractères."),
  publish: z.boolean(),
});
export type EventReportInput = z.input<typeof eventReportSchema>;

export const eventStatusSchema = z.object({
  eventId: id,
  status: z.enum(["DRAFT", "PUBLISHED", "CLOSED", "CANCELLED"]),
});

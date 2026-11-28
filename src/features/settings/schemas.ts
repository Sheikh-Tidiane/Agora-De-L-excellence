import { z } from "zod";
import { rules } from "@/config/rules";
import { site } from "@/config/site";

/** Réglages du club modifiables depuis l'administration (table `Setting`, une ligne par clé). */
const text = (max: number) => z.string().trim().max(max, `Pas plus de ${max} caractères.`);

const optionalUrl = z
  .string()
  .trim()
  .max(300, "Cette adresse est trop longue.")
  .refine((value) => value === "" || /^https:\/\/[^\s]+\.[^\s]+$/.test(value), {
    message: "Indiquez une adresse complète, qui commence par https://",
  });

/**
 * Entier saisi dans un champ texte : un nombre, ou une chaîne de chiffres.
 * Pas de `z.coerce` : il transforme « », `null`, `false` et `[]` en 0, et un montant
 * effacé par erreur (ou forgé) serait enregistré comme « gratuit ».
 */
const wholeNumber = (min: number, max: number, message: string) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value,
    z.number({ error: message }).int(message).min(min, message).max(max, message),
  );

/** Numéro Wave ou Orange Money : chiffres, espaces, « + » en tête ; vide si le club n'en a pas. */
const mobileMoneyNumber = text(30).refine(
  (value) => value === "" || /^\+?[0-9 ]{7,20}$/.test(value),
  { message: "Indiquez un numéro, par exemple 77 123 45 67." },
);

export const clubSettingsSchema = z.object({
  name: text(80).min(2, "Indiquez le nom du club."),
  shortName: text(30).min(2, "Indiquez la forme courte du nom."),
  slogan: text(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .refine((value) => value === "" || z.email().safeParse(value).success, {
      message: "Cette adresse e-mail n’est pas valide.",
    }),
  phone: text(30).refine((value) => value === "" || /^\+?[0-9 ]{7,20}$/.test(value), {
    message: "Indiquez un numéro, par exemple +221 77 123 45 67.",
  }),
  address: text(200),
  facebook: optionalUrl,
  instagram: optionalUrl,
  whatsapp: optionalUrl,
  youtube: optionalUrl,
  tiktok: optionalUrl,
  /** Numéros du club pour régler à distance (Wave, Orange Money). Vides : non affichés. */
  waveNumber: mobileMoneyNumber,
  orangeMoneyNumber: mobileMoneyNumber,
  cardGraceDays: wholeNumber(1, 365, "Entre 1 et 365 jours."),
  hideVideoWhenCardUnpaid: z.boolean({ error: "Cochez ou décochez la case." }),
  eventRemindersEnabled: z.boolean({ error: "Cochez ou décochez la case." }),
  eventReminderHour: wholeNumber(0, 23, "Une heure entre 0 et 23."),
  waitlistCutoffHours: wholeNumber(0, 72, "Entre 0 et 72 heures."),
  cancellationDeadlineHours: wholeNumber(0, 720, "Entre 0 et 720 heures."),
  membershipDurationMonths: wholeNumber(1, 60, "Entre 1 et 60 mois."),
  membershipCardFee: wholeNumber(0, 1_000_000, "Un montant entier en F CFA."),
  sessionFee: wholeNumber(0, 1_000_000, "Un montant entier en F CFA."),
});

export type ClubSettings = z.output<typeof clubSettingsSchema>;
export type ClubSettingsInput = z.input<typeof clubSettingsSchema>;

/** Valeurs de départ : `config/site.ts` et `config/rules.ts`. Coordonnées vides tant que le club ne les a pas saisies. */
export const defaultClubSettings: ClubSettings = {
  name: site.name,
  shortName: site.shortName,
  slogan: site.slogan,
  email: "",
  phone: "",
  address: "",
  facebook: "",
  instagram: "",
  whatsapp: "",
  youtube: "",
  tiktok: "",
  waveNumber: "",
  orangeMoneyNumber: "",
  cardGraceDays: rules["membership.cardGraceDays"],
  hideVideoWhenCardUnpaid: rules["events.hideVideoWhenCardUnpaid"],
  eventRemindersEnabled: rules["events.remindersEnabled"],
  eventReminderHour: rules["events.reminderHour"],
  waitlistCutoffHours: rules["events.waitlistCutoffHours"],
  cancellationDeadlineHours: rules["events.cancellationDeadlineHours"],
  membershipDurationMonths: rules["membership.durationMonths"],
  membershipCardFee: rules["fees.membershipCard"],
  sessionFee: rules["fees.session"],
};

/** Clé de la table `Setting` pour chaque champ. */
export const settingKeys: Record<keyof ClubSettings, string> = {
  name: "club.name",
  shortName: "club.shortName",
  slogan: "club.slogan",
  email: "club.email",
  phone: "club.phone",
  address: "club.address",
  facebook: "social.facebook",
  instagram: "social.instagram",
  whatsapp: "social.whatsapp",
  youtube: "social.youtube",
  tiktok: "social.tiktok",
  waveNumber: "payments.waveNumber",
  orangeMoneyNumber: "payments.orangeMoneyNumber",
  cardGraceDays: "membership.cardGraceDays",
  hideVideoWhenCardUnpaid: "events.hideVideoWhenCardUnpaid",
  eventRemindersEnabled: "events.remindersEnabled",
  eventReminderHour: "events.reminderHour",
  waitlistCutoffHours: "events.waitlistCutoffHours",
  cancellationDeadlineHours: "events.cancellationDeadlineHours",
  membershipDurationMonths: "membership.durationMonths",
  membershipCardFee: "fees.membershipCard",
  sessionFee: "fees.session",
};

export const socialLabels = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  youtube: "YouTube",
  tiktok: "TikTok",
} as const satisfies Partial<Record<keyof ClubSettings, string>>;

/** Fusionne les lignes de la table avec les valeurs par défaut ; une valeur invalide est ignorée. */
export function mergeSettings(rows: { key: string; value: unknown }[]): ClubSettings {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const merged: Record<string, unknown> = { ...defaultClubSettings };
  for (const [field, key] of Object.entries(settingKeys)) {
    const value = byKey.get(key);
    if (value === undefined || value === null) continue;
    const parsed = clubSettingsSchema.shape[field as keyof ClubSettings].safeParse(value);
    if (parsed.success) merged[field] = parsed.data;
  }
  return merged as ClubSettings;
}

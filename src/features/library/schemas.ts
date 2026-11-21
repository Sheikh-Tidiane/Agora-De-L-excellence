import { z } from "zod";
import { isStoredImage } from "@/lib/storage-names";

const id = z.string().min(1).max(40);
const optionalId = z.string().max(40);

const text = (max: number) => z.string().trim().max(max, `Pas plus de ${max} caractères.`);

/** Entier facultatif saisi dans un champ texte : « » → null. */
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

/** « Mariama Bâ, Aminata Sow Fall » → ["Mariama Bâ", "Aminata Sow Fall"] (sans doublon). */
export function splitAuthors(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[,;\n]/)
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter((name) => {
      const key = name.toLowerCase();
      if (!name || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export const bookSchema = z.object({
  id: optionalId,
  title: text(160).min(1, "Indiquez le titre."),
  subtitle: text(200),
  authors: z
    .string({ error: "Indiquez au moins un auteur." })
    .max(400)
    .refine((value) => splitAuthors(value).length > 0, { message: "Indiquez au moins un auteur." })
    .refine((value) => splitAuthors(value).every((name) => name.length <= 80), {
      message: "Un nom d’auteur est trop long.",
    }),
  categoryId: z
    .string({ error: "Choisissez une catégorie." })
    .min(1, "Choisissez une catégorie.")
    .max(40),
  summary: text(4000).min(20, "Rédigez un résumé d’au moins 20 caractères, avec les mots du club."),
  clubNote: text(300),
  isClubFavorite: z.boolean(),
  isPublished: z.boolean(),
  publisher: text(120),
  publishedYear: optionalInt(1000, 2100, "Une année entre 1000 et 2100, ou rien."),
  pageCount: optionalInt(1, 10000, "Un nombre de pages entre 1 et 10 000, ou rien."),
  isbn: text(20).refine((value) => value === "" || /^[0-9Xx -]{10,17}$/.test(value), {
    message: "Un ISBN de 10 ou 13 chiffres, ou rien.",
  }),
  language: z.enum(["fr", "en", "wo"], { error: "Choisissez une langue." }),
  /** Nom renvoyé par le téléversement (`covers/…`), ou vide pour la couverture générée. */
  coverImage: z
    .string()
    .max(80)
    .refine((value) => value === "" || isStoredImage(value), { message: "Image inconnue." }),
});
export type BookInput = z.input<typeof bookSchema>;
export type BookData = z.output<typeof bookSchema>;

export const bookIdSchema = z.object({ id, archived: z.boolean() });

export const categorySchema = z.object({
  id: optionalId,
  name: text(60).min(2, "Donnez un nom à la catégorie."),
  description: text(300),
});
export type CategoryInput = z.input<typeof categorySchema>;

export const authorSchema = z.object({
  id: optionalId,
  name: text(80).min(2, "Indiquez le nom de l’auteur."),
  bio: text(1200),
});
export type AuthorInput = z.input<typeof authorSchema>;

export const deleteSchema = z.object({ id });

export const selectionSchema = z.object({
  /** Mois au format AAAA-MM (champ `month`). */
  month: z
    .string({ error: "Choisissez un mois." })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choisissez un mois."),
  bookId: z.string({ error: "Choisissez un livre." }).min(1, "Choisissez un livre.").max(40),
  eventId: optionalId,
  note: text(600),
});
export type SelectionInput = z.input<typeof selectionSchema>;

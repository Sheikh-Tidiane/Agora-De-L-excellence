import { z } from "zod";
import { parseLocalDateTime } from "@/lib/dates";

const text = (max: number) => z.string().trim().max(max, `Pas plus de ${max} caractères.`);

export const articleSchema = z.object({
  title: text(140).min(3, "Donnez un titre à l’article."),
  category: text(40).min(2, "Indiquez une rubrique : Compte rendu, Mot de la semaine…"),
  excerpt: text(320).min(20, "Rédigez un chapô d’au moins 20 caractères."),
  content: text(40000).min(40, "Le texte de l’article est trop court."),
  /** Date de publication (heure de Dakar). Vide : à l'instant de la publication. */
  publishedAt: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return null;
      const date = parseLocalDateTime(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: "Date invalide." });
        return z.NEVER;
      }
      return date;
    }),
});
export type ArticleInput = z.input<typeof articleSchema>;
export type ArticleData = z.output<typeof articleSchema>;

export const articleStatusSchema = z.object({
  id: z.string().min(1).max(40),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export const articleStatusLabels = {
  DRAFT: "Brouillon",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
} as const;
export type ArticleStatusCode = keyof typeof articleStatusLabels;

/** État affiché : un article publié dont la date est à venir est « programmé ». */
export function articleDisplayState(
  article: { status: ArticleStatusCode; publishedAt: Date | null },
  now: Date,
): "draft" | "scheduled" | "published" | "archived" {
  if (article.status === "ARCHIVED") return "archived";
  if (article.status === "DRAFT") return "draft";
  return article.publishedAt && article.publishedAt.getTime() > now.getTime()
    ? "scheduled"
    : "published";
}

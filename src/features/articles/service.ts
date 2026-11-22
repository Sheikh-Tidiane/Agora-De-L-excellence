import type { ArticleData, ArticleStatusCode } from "@/features/articles/schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";

/** Rédaction des actualités : brouillon, publication (immédiate ou programmée), archivage. */

/** Crée un article en brouillon, ou enregistre les modifications d'un article existant. */
export async function saveArticle(
  id: string | null,
  data: ArticleData,
  authorId: string,
): Promise<{ id: string }> {
  const values = {
    title: data.title,
    category: data.category,
    excerpt: data.excerpt,
    content: data.content,
  };
  if (id) {
    const article = await prisma.article.findUnique({ where: { id }, select: { status: true } });
    if (!article) throw new AppError("NOT_FOUND", "Article introuvable.");
    await prisma.article.update({
      where: { id },
      // La date saisie programme (ou reprogramme) la publication ; vide, la date existante reste.
      data: { ...values, ...(data.publishedAt ? { publishedAt: data.publishedAt } : {}) },
    });
    return { id };
  }
  const slug = await uniqueSlug(
    data.title,
    async (candidate) => (await prisma.article.count({ where: { slug: candidate } })) > 0,
    "article",
  );
  return prisma.article.create({
    data: { ...values, slug, status: "DRAFT", publishedAt: data.publishedAt, authorId },
    select: { id: true },
  });
}

/**
 * Change le statut. Publier sans date fixe la publication à maintenant ; avec une date future,
 * l'article n'apparaît qu'à cette date (filtre à la lecture, sans tâche planifiée).
 */
export async function setArticleStatus(
  id: string,
  status: ArticleStatusCode,
  now = new Date(),
): Promise<{ publishedAt: Date | null }> {
  const article = await prisma.article.findUnique({
    where: { id },
    select: { status: true, publishedAt: true },
  });
  if (!article) throw new AppError("NOT_FOUND", "Article introuvable.");
  const publishedAt = status === "PUBLISHED" ? (article.publishedAt ?? now) : article.publishedAt;
  await prisma.article.update({
    where: { id },
    data: { status, publishedAt, archivedAt: status === "ARCHIVED" ? now : null },
  });
  return { publishedAt };
}

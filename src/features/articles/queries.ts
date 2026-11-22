import { cacheLife, cacheTag } from "next/cache";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { readingMinutes } from "@/lib/markdown";
import { prisma } from "@/lib/prisma";

export type PublicArticle = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: Date;
  readingMinutes: number;
};

/** Visible du public : publié, non archivé, et dont la date de publication est passée (n° 20). */
const published = (now: Date) => ({
  status: "PUBLISHED" as const,
  archivedAt: null,
  publishedAt: { lte: now },
});

const toPublic = (row: {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  content: string;
  publishedAt: Date | null;
}): PublicArticle => ({
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  category: row.category,
  publishedAt: row.publishedAt!,
  readingMinutes: readingMinutes(row.content),
});

const listSelect = {
  slug: true,
  title: true,
  excerpt: true,
  category: true,
  content: true,
  publishedAt: true,
};

/** Articles publiés, du plus récent au plus ancien. */
export async function getPublishedArticles(take = 60): Promise<PublicArticle[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.articles);
  const rows = await prisma.article.findMany({
    where: published(new Date()),
    orderBy: { publishedAt: "desc" },
    take,
    select: listSelect,
  });
  return rows.map(toPublic);
}

export async function getArticleBySlug(slug: string) {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.articles);
  const row = await prisma.article.findFirst({
    where: { slug, ...published(new Date()) },
    select: {
      ...listSelect,
      updatedAt: true,
      author: { select: { firstName: true, lastName: true } },
    },
  });
  if (!row) return null;
  return {
    ...toPublic(row),
    content: row.content,
    updatedAt: row.updatedAt,
    authorName: row.author ? `${row.author.firstName} ${row.author.lastName}`.trim() : null,
  };
}

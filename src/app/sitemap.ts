import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

/** Pages fixes du site public, de la plus importante à la moins importante. */
const staticPages: {
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
}[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/events", priority: 0.9, changeFrequency: "daily" },
  { path: "/membership", priority: 0.9, changeFrequency: "monthly" },
  { path: "/activities", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.8, changeFrequency: "monthly" },
  { path: "/library", priority: 0.8, changeFrequency: "weekly" },
  { path: "/news", priority: 0.7, changeFrequency: "weekly" },
  { path: "/archives", priority: 0.6, changeFrequency: "weekly" },
  { path: "/charte", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

/** Fiches publiques (livres, rencontres, articles), lues en base et mises en cache comme les pages. */
async function contentEntries() {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books, cacheTags.events, cacheTags.articles);
  try {
    const [books, events, articles] = await Promise.all([
      prisma.book.findMany({
        where: { isPublished: true, archivedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      prisma.event.findMany({
        where: { status: { in: ["PUBLISHED", "CLOSED"] }, archivedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      prisma.article.findMany({
        where: { status: "PUBLISHED", archivedAt: null, publishedAt: { lte: new Date() } },
        select: { slug: true, updatedAt: true },
      }),
    ]);
    return [
      ...books.map((row) => ({ path: `/library/${row.slug}`, updatedAt: row.updatedAt })),
      ...events.map((row) => ({ path: `/events/${row.slug}`, updatedAt: row.updatedAt })),
      ...articles.map((row) => ({ path: `/news/${row.slug}`, updatedAt: row.updatedAt })),
    ];
  } catch (error) {
    // Base injoignable : le plan du site garde au moins les pages fixes.
    logger.error("Plan du site : fiches illisibles", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries = await contentEntries();
  return [
    ...staticPages.map((page) => ({
      url: `${env.APP_URL}${page.path === "/" ? "" : page.path}`,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...entries.map((entry) => ({
      url: `${env.APP_URL}${entry.path}`,
      lastModified: entry.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}

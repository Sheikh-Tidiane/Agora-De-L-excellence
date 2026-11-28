import { PUBLIC_STATUSES } from "@/features/scrabble/rules";
import { prisma } from "@/lib/prisma";

/**
 * Fiches publiques à adresse libre (livre, article, rencontre, tournoi) : existent-elles et sont-
 * elles visibles ? Vérifié par le proxy AVANT le rendu : avec le prérendu partiel, une page envoie
 * son code 200 dès le début ; seul un refus en amont donne un vrai « 404 Not Found ».
 * Mêmes conditions que les lectures publiques (library, articles, events, scrabble/public-read).
 */
const SLUG = /^[a-z0-9-]{1,160}$/;

export type PublicSection = "library" | "news" | "events" | "scrabble";

export async function publicPageExists(
  section: PublicSection,
  slug: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!SLUG.test(slug)) return false;
  switch (section) {
    case "library":
      return (
        (await prisma.book.count({ where: { slug, isPublished: true, archivedAt: null } })) > 0
      );
    case "news":
      return (
        (await prisma.article.count({
          where: { slug, status: "PUBLISHED", archivedAt: null, publishedAt: { lte: now } },
        })) > 0
      );
    case "events":
      return (
        (await prisma.event.count({
          where: { slug, status: { not: "DRAFT" }, archivedAt: null },
        })) > 0
      );
    case "scrabble":
      return (
        (await prisma.tournament.count({
          where: { slug, status: { in: [...PUBLIC_STATUSES] }, archivedAt: null },
        })) > 0
      );
  }
}

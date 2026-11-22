import { cacheLife, cacheTag } from "next/cache";
import { joinAuthors, type PublicBook } from "@/features/library/catalog";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { monthStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

/** Lectures publiques du catalogue. Toutes en cache, invalidées par l'étiquette `books`. */
const bookSelect = {
  id: true,
  slug: true,
  title: true,
  subtitle: true,
  summary: true,
  clubNote: true,
  isClubFavorite: true,
  coverImage: true,
  publisher: true,
  publishedYear: true,
  pageCount: true,
  language: true,
  isbn: true,
  category: { select: { slug: true, name: true } },
  authors: { select: { slug: true, name: true, bio: true }, orderBy: { name: "asc" as const } },
};

type BookRow = Omit<PublicBook, "authorNames">;

const toPublicBook = (row: BookRow): PublicBook => ({
  ...row,
  authorNames: joinAuthors(row.authors.map((author) => author.name)),
});

const visible = { isPublished: true, archivedAt: null };

/** Tout le catalogue publié : coups de cœur d'abord, puis par titre. */
export async function getCatalog(): Promise<PublicBook[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books);
  const rows = await prisma.book.findMany({
    where: visible,
    select: bookSelect,
    orderBy: [{ isClubFavorite: "desc" }, { title: "asc" }],
  });
  return rows.map(toPublicBook);
}

export async function getBookBySlug(slug: string): Promise<PublicBook | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books);
  const row = await prisma.book.findFirst({ where: { slug, ...visible }, select: bookSelect });
  return row ? toPublicBook(row) : null;
}

export type CurrentSelection = {
  /** Premier jour du mois de la sélection. */
  month: Date;
  note: string | null;
  book: PublicBook;
  event: { slug: string; title: string; startsAt: Date } | null;
};

/** Livre du mois : la sélection du mois en cours, sinon la plus récente déjà commencée. */
export async function getCurrentSelection(): Promise<CurrentSelection | null> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books, cacheTags.events);
  const selection = await prisma.monthlySelection.findFirst({
    where: { month: { lte: monthStart(new Date()) }, book: visible },
    orderBy: { month: "desc" },
    select: {
      month: true,
      note: true,
      book: { select: bookSelect },
      event: {
        select: { slug: true, title: true, startsAt: true, status: true, archivedAt: true },
      },
    },
  });
  if (!selection) return null;
  const event =
    selection.event && selection.event.status === "PUBLISHED" && !selection.event.archivedAt
      ? {
          slug: selection.event.slug,
          title: selection.event.title,
          startsAt: selection.event.startsAt,
        }
      : null;
  return {
    month: selection.month,
    note: selection.note,
    book: toPublicBook(selection.book),
    event,
  };
}

/** Avis publics d'un livre : critique validée ET accord du membre (REGLES-METIER n° 9). */
export async function getPublicReviews(bookId: string) {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books);
  const reviews = await prisma.review.findMany({
    where: { bookId, status: "APPROVED", publishWithFirstName: true },
    orderBy: { moderatedAt: "desc" },
    take: 12,
    select: { id: true, rating: true, content: true, user: { select: { firstName: true } } },
  });
  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    content: review.content,
    firstName: review.user.firstName,
  }));
}

export type ArchivedReview = {
  id: string;
  rating: number;
  excerpt: string;
  firstName: string;
  approvedAt: Date | null;
  book: { slug: string; title: string; authors: string };
};

/**
 * Fiches de lecture des archives : critiques approuvées ET publiées sous le prénom du membre
 * (mêmes conditions que les avis d'une fiche livre), sur un livre visible du catalogue.
 */
export async function getArchivedReviews(limit = 24): Promise<ArchivedReview[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.books);
  const reviews = await prisma.review.findMany({
    where: {
      status: "APPROVED",
      publishWithFirstName: true,
      book: { isPublished: true, archivedAt: null },
    },
    orderBy: { moderatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      rating: true,
      content: true,
      moderatedAt: true,
      user: { select: { firstName: true } },
      book: { select: { slug: true, title: true, authors: { select: { name: true } } } },
    },
  });
  return reviews.map((review) => ({
    id: review.id,
    rating: review.rating,
    excerpt:
      review.content.length > 220 ? `${review.content.slice(0, 217).trimEnd()}…` : review.content,
    firstName: review.user.firstName,
    approvedAt: review.moderatedAt,
    book: {
      slug: review.book.slug,
      title: review.book.title,
      authors: review.book.authors.map((author) => author.name).join(", "),
    },
  }));
}

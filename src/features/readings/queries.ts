import { prisma } from "@/lib/prisma";

/** Lectures. Les requêtes côté membre sont toutes bornées à `userId`, tenu de la session. */

const bookFields = {
  id: true,
  slug: true,
  title: true,
  coverImage: true,
  category: { select: { name: true } },
  authors: { select: { name: true } },
} as const;

export async function getMyReadings(userId: string) {
  return prisma.reading.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      status: true,
      progress: true,
      isFavorite: true,
      completionStatus: true,
      finishedAt: true,
      updatedAt: true,
      book: { select: bookFields },
    },
  });
}

export async function getMyReading(userId: string, readingId: string) {
  const reading = await prisma.reading.findFirst({
    where: { id: readingId, userId },
    select: {
      id: true,
      status: true,
      progress: true,
      personalNote: true,
      isFavorite: true,
      completionStatus: true,
      validationNote: true,
      startedAt: true,
      finishedAt: true,
      submittedAt: true,
      validatedAt: true,
      book: { select: bookFields },
    },
  });
  if (!reading) return null;
  const review = await prisma.review.findUnique({
    where: { userId_bookId: { userId, bookId: reading.book.id } },
    select: {
      rating: true,
      content: true,
      status: true,
      publishWithFirstName: true,
      moderationNote: true,
    },
  });
  return { ...reading, review };
}

/** Pour la fiche publique d'un livre : la lecture du membre connecté, s'il l'a déjà ajoutée. */
export async function findMyReadingOfBook(userId: string, bookId: string) {
  return prisma.reading.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: { id: true, status: true },
  });
}

/** File des responsables : « livres terminés » en attente, puis critiques à modérer. */
export async function getValidationQueues() {
  const member = { select: { firstName: true, lastName: true, memberNumber: true } } as const;
  const [readings, reviews] = await Promise.all([
    prisma.reading.findMany({
      where: { completionStatus: "PENDING" },
      orderBy: { submittedAt: "asc" },
      take: 200,
      select: {
        id: true,
        submittedAt: true,
        finishedAt: true,
        user: member,
        book: { select: { slug: true, title: true, authors: { select: { name: true } } } },
      },
    }),
    prisma.review.findMany({
      where: { status: "PENDING" },
      orderBy: { updatedAt: "asc" },
      take: 200,
      select: {
        id: true,
        rating: true,
        content: true,
        publishWithFirstName: true,
        updatedAt: true,
        user: member,
        book: { select: { slug: true, title: true } },
      },
    }),
  ]);
  return { readings, reviews };
}

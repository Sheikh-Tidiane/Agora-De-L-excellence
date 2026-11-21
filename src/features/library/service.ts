import { splitAuthors, type BookData } from "@/features/library/schemas";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { slugify, uniqueSlug } from "@/lib/slug";
import { storage } from "@/lib/storage";

/** Gestion du catalogue par le responsable bibliothèque : livres, catégories, auteurs, livre du mois. */

/** Retrouve chaque auteur par son nom (à la casse et aux accents près), ou le crée. */
async function resolveAuthors(tx: Db, names: string[]): Promise<{ id: string }[]> {
  const ids: { id: string }[] = [];
  for (const name of names) {
    const slug = slugify(name) || "auteur";
    const known = await tx.author.findUnique({ where: { slug }, select: { id: true } });
    if (known) {
      ids.push(known);
      continue;
    }
    const created = await tx.author.create({ data: { slug, name }, select: { id: true } });
    ids.push(created);
  }
  return ids;
}

export async function saveBook(data: BookData): Promise<{ id: string; slug: string }> {
  const { id, authors, coverImage, ...fields } = data;
  const values = {
    title: fields.title,
    subtitle: fields.subtitle || null,
    summary: fields.summary,
    clubNote: fields.clubNote || null,
    isClubFavorite: fields.isClubFavorite,
    isPublished: fields.isPublished,
    publisher: fields.publisher || null,
    publishedYear: fields.publishedYear,
    pageCount: fields.pageCount,
    isbn: fields.isbn || null,
    language: fields.language,
    categoryId: fields.categoryId,
    coverImage: coverImage || null,
  };
  const category = await prisma.category.findUnique({ where: { id: fields.categoryId } });
  if (!category) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { categoryId: "Cette catégorie n’existe plus." },
    });
  }

  let replacedCover: string | null = null;
  const saved = await prisma.$transaction(async (tx) => {
    const authorIds = await resolveAuthors(tx, splitAuthors(authors));
    if (id) {
      const current = await tx.book.findUnique({ where: { id }, select: { coverImage: true } });
      if (!current) throw new AppError("NOT_FOUND", "Livre introuvable.");
      if (current.coverImage && current.coverImage !== values.coverImage) {
        replacedCover = current.coverImage;
      }
      return tx.book.update({
        where: { id },
        data: { ...values, authors: { set: authorIds } },
        select: { id: true, slug: true },
      });
    }
    const slug = await uniqueSlug(
      fields.title,
      async (candidate) => (await tx.book.count({ where: { slug: candidate } })) > 0,
      "livre",
    );
    return tx.book.create({
      data: { ...values, slug, authors: { connect: authorIds } },
      select: { id: true, slug: true },
    });
  });
  // L'ancienne image n'est plus référencée : on libère le disque, sans bloquer si elle manque.
  if (replacedCover) await storage.remove(replacedCover);
  return saved;
}

/** Archive (ou restaure) un livre : il quitte le site public, son historique de lectures reste. */
export async function setBookArchived(id: string, archived: boolean): Promise<void> {
  const book = await prisma.book.findUnique({ where: { id }, select: { id: true } });
  if (!book) throw new AppError("NOT_FOUND", "Livre introuvable.");
  await prisma.book.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}

export async function saveCategory(data: { id: string; name: string; description: string }) {
  const clash = await prisma.category.findFirst({
    where: {
      name: { equals: data.name, mode: "insensitive" },
      id: data.id ? { not: data.id } : undefined,
    },
  });
  if (clash) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { name: "Une catégorie porte déjà ce nom." },
    });
  }
  if (data.id) {
    await prisma.category.update({
      where: { id: data.id },
      data: { name: data.name, description: data.description || null },
    });
    return;
  }
  const slug = await uniqueSlug(
    data.name,
    async (candidate) => (await prisma.category.count({ where: { slug: candidate } })) > 0,
    "categorie",
  );
  const position = await prisma.category.count();
  await prisma.category.create({
    data: { slug, name: data.name, description: data.description || null, position },
  });
}

export async function deleteCategory(id: string): Promise<void> {
  const books = await prisma.book.count({ where: { categoryId: id } });
  if (books > 0) {
    throw new AppError(
      "CONFLICT",
      `Cette catégorie contient ${books} livre${books > 1 ? "s" : ""} : déplacez-les avant de la supprimer.`,
    );
  }
  await prisma.category.delete({ where: { id } });
}

export async function saveAuthor(data: { id: string; name: string; bio: string }) {
  if (data.id) {
    await prisma.author.update({
      where: { id: data.id },
      data: { name: data.name, bio: data.bio || null },
    });
    return;
  }
  const slug = slugify(data.name) || "auteur";
  if (await prisma.author.findUnique({ where: { slug } })) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { name: "Cet auteur existe déjà." },
    });
  }
  await prisma.author.create({ data: { slug, name: data.name, bio: data.bio || null } });
}

export async function deleteAuthor(id: string): Promise<void> {
  const books = await prisma.book.count({ where: { authors: { some: { id } } } });
  if (books > 0) {
    throw new AppError(
      "CONFLICT",
      `Cet auteur est rattaché à ${books} livre${books > 1 ? "s" : ""} : il ne peut pas être supprimé.`,
    );
  }
  await prisma.author.delete({ where: { id } });
}

/** « 2026-11 » → 1er novembre 2026 (UTC), clé de `MonthlySelection.month`. */
export function monthFromInput(value: string): Date {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, 1));
}

/** Une seule sélection par mois : enregistrer un mois déjà pris le remplace. */
export async function saveSelection(data: {
  month: string;
  bookId: string;
  eventId: string;
  note: string;
}): Promise<void> {
  const month = monthFromInput(data.month);
  const book = await prisma.book.findFirst({ where: { id: data.bookId, archivedAt: null } });
  if (!book) {
    throw new AppError("VALIDATION", undefined, { fieldErrors: { bookId: "Livre introuvable." } });
  }
  const eventId = data.eventId || null;
  if (eventId) {
    const taken = await prisma.monthlySelection.findFirst({
      where: { eventId, month: { not: month } },
    });
    if (taken) {
      throw new AppError("VALIDATION", undefined, {
        fieldErrors: { eventId: "Cette rencontre est déjà liée à un autre livre du mois." },
      });
    }
  }
  const values = { bookId: data.bookId, eventId, note: data.note || null };
  await prisma.monthlySelection.upsert({
    where: { month },
    update: values,
    create: { month, ...values },
  });
}

export async function deleteSelection(id: string): Promise<void> {
  await prisma.monthlySelection.delete({ where: { id } });
}

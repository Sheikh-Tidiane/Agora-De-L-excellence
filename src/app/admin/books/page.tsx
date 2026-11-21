import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { joinAuthors } from "@/features/library/catalog";
import { BooksTable, type BookRow } from "@/features/library/components/books-table";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Livres" };

async function Books({ searchParams }: Pick<PageProps<"/admin/books">, "searchParams">) {
  await requirePageAccess("books.manage", "/admin/books");
  const { open } = await searchParams;
  const [books, categories, authors] = await Promise.all([
    prisma.book.findMany({
      orderBy: { title: "asc" },
      take: 3000,
      include: {
        category: { select: { name: true } },
        authors: { select: { name: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.category.findMany({ orderBy: { position: "asc" }, select: { id: true, name: true } }),
    prisma.author.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);

  const rows: BookRow[] = books.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    // Forme saisissable : « A, B » (et non « A et B »), reprise telle quelle par le formulaire.
    authors: book.authors.map((author) => author.name).join(", ") || joinAuthors([]),
    categoryId: book.categoryId,
    categoryName: book.category.name,
    summary: book.summary,
    clubNote: book.clubNote,
    isClubFavorite: book.isClubFavorite,
    isPublished: book.isPublished,
    archived: book.archivedAt !== null,
    publisher: book.publisher,
    publishedYear: book.publishedYear,
    pageCount: book.pageCount,
    isbn: book.isbn,
    language: book.language,
    coverImage: book.coverImage,
  }));

  return (
    <>
      <AdminPageHeader title="Livres">
        Le catalogue du club. Sans image téléversée, le site affiche une couverture typographique
        générée à partir du titre.
      </AdminPageHeader>
      <BooksTable
        rows={rows}
        categories={categories.map((category) => ({ value: category.id, label: category.name }))}
        authorNames={authors.map((author) => author.name)}
        initialOpenId={typeof open === "string" ? open : undefined}
      />
    </>
  );
}

export default function BooksPage({ searchParams }: PageProps<"/admin/books">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Books searchParams={searchParams} />
    </Suspense>
  );
}

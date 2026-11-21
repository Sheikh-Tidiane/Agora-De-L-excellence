import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { TaxonomyManager } from "@/features/library/components/taxonomy-manager";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Catégories et auteurs" };

async function Taxonomy() {
  await requirePageAccess("books.manage", "/admin/books/categories");
  const [categories, authors] = await Promise.all([
    prisma.category.findMany({
      orderBy: { position: "asc" },
      select: { id: true, name: true, description: true, _count: { select: { books: true } } },
    }),
    prisma.author.findMany({
      orderBy: { name: "asc" },
      take: 3000,
      select: { id: true, name: true, bio: true, _count: { select: { books: true } } },
    }),
  ]);
  return (
    <>
      <AdminPageHeader title="Catégories et auteurs">
        Les rayons du catalogue et les auteurs qui y figurent. Un élément rattaché à des livres ne
        peut pas être supprimé.
      </AdminPageHeader>
      <TaxonomyManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          text: c.description,
          books: c._count.books,
        }))}
        authors={authors.map((a) => ({
          id: a.id,
          name: a.name,
          text: a.bio,
          books: a._count.books,
        }))}
      />
    </>
  );
}

export default function TaxonomyPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Taxonomy />
    </Suspense>
  );
}

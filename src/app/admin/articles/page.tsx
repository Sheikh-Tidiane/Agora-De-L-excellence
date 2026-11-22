import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { ArticlesTable, type ArticleRow } from "@/features/articles/components/articles-table";
import { articleDisplayState } from "@/features/articles/schemas";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Articles" };

async function Articles() {
  await requirePageAccess("articles.manage", "/admin/articles");
  const now = new Date();
  const articles = await prisma.article.findMany({
    orderBy: { updatedAt: "desc" },
    take: 2000,
    select: {
      id: true,
      title: true,
      category: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      author: { select: { name: true } },
    },
  });
  const rows: ArticleRow[] = articles.map((article) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    state: articleDisplayState(article, now),
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
    authorName: article.author?.name ?? null,
  }));

  return (
    <>
      <AdminPageHeader title="Articles">
        Actualités, comptes rendus et rendez-vous éditoriaux. Un article publié à une date future
        paraît de lui-même ce jour-là.
      </AdminPageHeader>
      <ArticlesTable rows={rows} />
    </>
  );
}

export default function ArticlesAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Articles />
    </Suspense>
  );
}

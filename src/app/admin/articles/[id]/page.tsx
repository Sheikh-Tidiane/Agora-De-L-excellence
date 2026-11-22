import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { ArticleEditor } from "@/features/articles/components/article-editor";
import { articleDisplayState } from "@/features/articles/schemas";
import { toLocalDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Article" };

/** Rubriques déjà utilisées, proposées à la saisie. */
async function knownCategories() {
  const rows = await prisma.article.findMany({
    distinct: ["category"],
    select: { category: true },
    orderBy: { category: "asc" },
    take: 50,
  });
  return rows.map((row) => row.category);
}

async function Editor({ params }: Pick<PageProps<"/admin/articles/[id]">, "params">) {
  const { id } = await params;
  await requirePageAccess("articles.manage", `/admin/articles/${id}`);
  const isNew = id === "new";
  const [article, categories] = await Promise.all([
    isNew ? null : prisma.article.findUnique({ where: { id } }),
    knownCategories(),
  ]);
  if (!isNew && !article) notFound();

  return (
    <>
      <AdminPageHeader title={article ? article.title : "Nouvel article"}>
        {article
          ? "Écrivez à gauche, relisez à droite : l’aperçu reprend la mise en page du site."
          : "Il est créé en brouillon : vous le relisez, puis vous le publiez."}
      </AdminPageHeader>
      <ArticleEditor
        // La clé ne dépend pas du statut : l'éditeur reste monté après « Publier »,
        // sinon son message de confirmation disparaît avec lui.
        key={article?.id ?? "new"}
        categories={categories}
        article={
          article
            ? {
                id: article.id,
                slug: article.slug,
                status: article.status,
                state: articleDisplayState(article, new Date()),
                publishedAt: article.publishedAt,
              }
            : undefined
        }
        initial={{
          title: article?.title ?? "",
          category: article?.category ?? "",
          excerpt: article?.excerpt ?? "",
          content: article?.content ?? "",
          publishedAt: toLocalDateTime(article?.publishedAt),
        }}
      />
    </>
  );
}

export default function ArticleEditorPage({ params }: PageProps<"/admin/articles/[id]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Editor params={params} />
    </Suspense>
  );
}

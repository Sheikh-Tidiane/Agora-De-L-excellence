import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { site } from "@/config/site";
import { ArticleMeta } from "@/features/articles/components/article-meta";
import { getArticleBySlug, getPublishedArticles } from "@/features/articles/queries";
import { Markdown } from "@/lib/markdown";

type Props = PageProps<"/news/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article introuvable", robots: { index: false } };
  return {
    title: article.title,
    description: article.excerpt.slice(0, 200),
    alternates: { canonical: `/news/${article.slug}` },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      section: article.category,
    },
  };
}

async function Article({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  const others = (await getPublishedArticles(4)).filter((a) => a.slug !== article.slug).slice(0, 2);

  return (
    <>
      <article className="page pt-6 pb-16 lg:pt-10 lg:pb-28">
        <Link
          href="/news"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Actualités
        </Link>

        <header className="mt-6 lg:mt-12 lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-9 lg:col-start-3">
            <p className="surtitre">{article.category}</p>
            <h1 className="mt-4 font-serif text-[2.5rem] leading-[1.04] tracking-[-0.015em] lg:text-[4.75rem]">
              {article.title}
            </h1>
          </div>
        </header>

        <div className="mt-8 lg:mt-14 lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Marge : la date et l'auteur, comme dans une revue. */}
          <aside className="border-t border-indigo pt-3 lg:col-span-2 lg:self-start">
            <ArticleMeta
              publishedAt={article.publishedAt}
              readingMinutes={article.readingMinutes}
              className="petit font-semibold"
            />
            <p className="petit mt-1 text-gris">{article.authorName ?? site.name}</p>
          </aside>

          <div className="mt-8 lg:col-span-7 lg:col-start-3 lg:mt-0">
            <p className="max-w-(--container-lecture) font-serif text-[1.375rem] leading-[1.4] lg:text-[1.625rem]">
              {article.excerpt}
            </p>
            <div className="mt-8 max-w-(--container-lecture)">
              <Markdown source={article.content} lettrine />
            </div>
          </div>
        </div>
      </article>

      {others.length > 0 ? (
        <section aria-labelledby="suite-titre" className="bg-sable py-16 lg:py-24">
          <div className="page">
            <h2 id="suite-titre" className="surtitre">
              À lire aussi
            </h2>
            <ul className="mt-4 grid gap-x-8 lg:grid-cols-2">
              {others.map((other) => (
                <li key={other.slug}>
                  <article className="group relative border-t border-indigo/20 py-6">
                    <p className="surtitre">{other.category}</p>
                    <h3 className="titre-2 mt-2">
                      <Link
                        href={`/news/${other.slug}`}
                        className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
                      >
                        {other.title}
                      </Link>
                    </h3>
                    <p className="mt-2 max-w-[34rem] text-gris">{other.excerpt}</p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: article.title,
            description: article.excerpt,
            datePublished: article.publishedAt.toISOString(),
            dateModified: article.updatedAt.toISOString(),
            articleSection: article.category,
            author: { "@type": "Organization", name: site.name },
          }),
        }}
      />
    </>
  );
}

function ArticleSkeleton() {
  return (
    <div aria-hidden="true" className="page pt-20 pb-16">
      <div className="skeleton h-3 w-32" />
      <div className="skeleton mt-5 h-14 w-4/5" />
      <div className="skeleton mt-10 h-5 w-full max-w-2xl" />
      <div className="skeleton mt-3 h-5 w-full max-w-2xl" />
      <div className="skeleton mt-3 h-5 w-3/5 max-w-xl" />
    </div>
  );
}

export default function ArticlePage({ params }: Props) {
  return (
    <Suspense fallback={<ArticleSkeleton />}>
      <Article params={params} />
    </Suspense>
  );
}

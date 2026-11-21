import type { Metadata } from "next";
import { BackToTop } from "@/components/layout/back-to-top";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { Reveal } from "@/components/shared/motion";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { ArticleMeta } from "@/features/articles/components/article-meta";
import { getPublishedArticles } from "@/features/articles/queries";

export const metadata: Metadata = {
  title: "Actualités",
  description:
    "Comptes rendus de rencontres, mots de la semaine, conseils de lecture et nouvelles du Scrabble : ce qui s’écrit au club.",
  alternates: { canonical: "/news" },
};

export default async function NewsPage() {
  const articles = await getPublishedArticles();
  const [lead, ...rest] = articles;

  return (
    <>
      <PageIntro
        surtitre="Actualités"
        letter="A"
        tone="blanc"
        arc="a"
        title="À lire entre deux rencontres."
      >
        Comptes rendus, mots de la semaine, conseils de lecture. De courts textes, écrits par le
        club.
      </PageIntro>

      <div className="page py-12 lg:py-24">
        {!lead ? (
          <EmptyState
            title="Rien de publié pour l’instant"
            action={
              <Link href="/events" className={buttonVariants({ variant: "contour" })}>
                Voir l’agenda
              </Link>
            }
          >
            Les premiers articles du club arrivent. En attendant, l’agenda est à jour.
          </EmptyState>
        ) : (
          <>
            {/* À la une : ouverture de magazine. */}
            <article className="group relative border-t-2 border-indigo pt-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:pt-10">
              <div className="lg:col-span-8">
                <p className="surtitre">{lead.category}</p>
                <h2 className="mt-3 font-serif text-[2.25rem] leading-[1.05] tracking-[-0.015em] lg:text-[4.5rem]">
                  <Link
                    href={`/news/${lead.slug}`}
                    className="decoration-terracotta decoration-2 underline-offset-[8px] group-hover:underline after:absolute after:inset-0"
                  >
                    {lead.title}
                  </Link>
                </h2>
              </div>
              <div className="mt-5 lg:col-span-4 lg:mt-0 lg:self-end lg:pb-3">
                <p className="chapo text-gris">{lead.excerpt}</p>
                <div className="mt-4">
                  <ArticleMeta
                    publishedAt={lead.publishedAt}
                    readingMinutes={lead.readingMinutes}
                  />
                </div>
              </div>
            </article>

            {rest.length > 0 ? (
              <ul className="mt-14 grid gap-x-8 md:grid-cols-2 lg:mt-24 lg:grid-cols-3">
                {rest.map((article, i) => (
                  <li key={article.slug}>
                    <Reveal delay={Math.min(i, 5) * 0.05}>
                      <article className="group relative h-full border-t border-indigo/20 py-7">
                        <p className="surtitre">{article.category}</p>
                        <h2 className="titre-3 mt-2 lg:text-[1.625rem]">
                          <Link
                            href={`/news/${article.slug}`}
                            className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
                          >
                            {article.title}
                          </Link>
                        </h2>
                        <p className="mt-2 text-gris">{article.excerpt}</p>
                        <div className="mt-4">
                          <ArticleMeta
                            publishedAt={article.publishedAt}
                            readingMinutes={article.readingMinutes}
                          />
                        </div>
                      </article>
                    </Reveal>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </div>
      <BackToTop />
    </>
  );
}

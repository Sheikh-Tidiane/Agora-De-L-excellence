import Link from "next/link";
import { Reveal } from "@/components/shared/motion";
import { ArticleMeta } from "@/features/articles/components/article-meta";
import { getPublishedArticles } from "@/features/articles/queries";

export async function NewsSection() {
  const articles = await getPublishedArticles(3);
  // Pas d'actualité publiée : la section n'apparaît pas, plutôt qu'un cadre vide.
  const [lead, ...rest] = articles;
  if (!lead) return null;

  return (
    <section aria-labelledby="actualites-titre" className="page py-18 lg:py-36">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="surtitre">Actualités</p>
          <h2 id="actualites-titre" className="titre-1 mt-3">
            À lire entre deux rencontres
          </h2>
        </div>
        <Link href="/news" className="lien hidden min-h-11 shrink-0 items-center sm:inline-flex">
          Toutes les actualités
        </Link>
      </div>

      <div className="mt-10 grid gap-10 lg:mt-16 lg:grid-cols-12 lg:gap-8">
        {/* À la une : traité comme une ouverture de magazine, sans image d'emprunt. */}
        <Reveal className={rest.length > 0 ? "lg:col-span-7" : "lg:col-span-8"}>
          <article className="group relative border-t-2 border-indigo pt-6">
            <p className="surtitre">{lead.category}</p>
            <h3 className="mt-3 font-serif text-[2rem] leading-[1.08] tracking-[-0.01em] lg:text-[3.25rem]">
              <Link
                href={`/news/${lead.slug}`}
                className="decoration-terracotta decoration-2 underline-offset-[6px] group-hover:underline after:absolute after:inset-0"
              >
                {lead.title}
              </Link>
            </h3>
            <p className="chapo mt-4 text-gris first-letter:float-left first-letter:mr-2 first-letter:font-serif first-letter:text-[3.4em] first-letter:leading-[0.82] first-letter:text-indigo lg:mt-6">
              {lead.excerpt}
            </p>
            <div className="mt-5">
              <ArticleMeta publishedAt={lead.publishedAt} readingMinutes={lead.readingMinutes} />
            </div>
          </article>
        </Reveal>

        {rest.length > 0 ? (
          <ul className="lg:col-span-4 lg:col-start-9">
            {rest.map((article, i) => (
              <li key={article.slug}>
                <Reveal delay={0.08 + i * 0.06}>
                  <article className="group relative border-t border-indigo/20 py-6 first:pt-6 lg:py-7">
                    <p className="surtitre">{article.category}</p>
                    <h3 className="titre-3 mt-2">
                      <Link
                        href={`/news/${article.slug}`}
                        className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
                      >
                        {article.title}
                      </Link>
                    </h3>
                    <p className="mt-2 text-gris">{article.excerpt}</p>
                    <div className="mt-3">
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
      </div>
      <Link href="/news" className="lien mt-4 inline-flex min-h-11 items-center sm:hidden">
        Toutes les actualités
      </Link>
    </section>
  );
}

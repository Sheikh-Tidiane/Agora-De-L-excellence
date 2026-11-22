import { Suspense } from "react";
import { serializeJsonLd } from "@/lib/json-ld";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookCard } from "@/components/shared/book-card";
import { BookCover } from "@/components/shared/book-cover";
import { Tag } from "@/components/shared/event-row";
import {
  getBookBySlug,
  getCatalog,
  getCurrentSelection,
  getPublicReviews,
} from "@/features/library/queries";
import { BookReadingControl } from "@/features/readings/components/book-reading-control";
import { formatFullDate, formatMonth } from "@/lib/dates";

type Props = PageProps<"/library/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) return { title: "Livre introuvable", robots: { index: false } };
  const description = (book.clubNote ?? book.summary).slice(0, 180);
  return {
    title: `${book.title}, ${book.authorNames}`,
    description,
    alternates: { canonical: `/library/${book.slug}` },
    openGraph: { type: "book", title: `${book.title} · ${book.authorNames}`, description },
  };
}

const languages: Record<string, string> = { fr: "Français", en: "Anglais", wo: "Wolof" };

async function BookSheet({ params }: Pick<Props, "params">) {
  const { slug } = await params;
  const book = await getBookBySlug(slug);
  if (!book) notFound();
  const [selection, catalog, reviews] = await Promise.all([
    getCurrentSelection(),
    getCatalog(),
    getPublicReviews(book.id),
  ]);
  const isMonthly = selection?.book.slug === book.slug;
  const related = catalog
    .filter((other) => other.slug !== book.slug && other.category.slug === book.category.slug)
    .slice(0, 4);
  const facts = [
    ["Première parution", book.publishedYear ? String(book.publishedYear) : null],
    ["Éditeur", book.publisher],
    ["Pages", book.pageCount ? String(book.pageCount) : null],
    ["Langue", languages[book.language] ?? book.language],
    ["ISBN", book.isbn],
  ].filter((fact): fact is [string, string] => Boolean(fact[1]));
  const bios = book.authors.filter((author) => author.bio);

  return (
    <>
      <article className="page pt-6 pb-16 lg:pt-10 lg:pb-28">
        <Link
          href="/library"
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Bibliothèque
        </Link>

        <div className="mt-4 lg:mt-8 lg:grid lg:grid-cols-12 lg:gap-8">
          {/* La couverture reste en vue pendant la lecture de la fiche. */}
          <div className="lg:col-span-4">
            <div className="w-[56%] max-w-[260px] lg:sticky lg:top-32 lg:w-full lg:max-w-[360px]">
              <BookCover
                title={book.title}
                author={book.authorNames}
                category={book.category.name}
                image={book.coverImage}
                priority
                sizes="(min-width: 1024px) 360px, 56vw"
              />
            </div>
          </div>

          <div className="mt-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/library?category=${book.category.slug}`} className="surtitre py-2">
                {book.category.name}
              </Link>
              {isMonthly ? <Tag tone="accent">Livre du mois</Tag> : null}
              {book.isClubFavorite ? <Tag>Coup de cœur du club</Tag> : null}
            </div>
            <h1 className="titre-1 mt-2 lg:text-[4rem]">{book.title}</h1>
            {book.subtitle ? (
              <p className="mt-2 font-serif text-xl text-gris">{book.subtitle}</p>
            ) : null}
            <p className="mt-3 font-serif text-[1.375rem] lg:text-[1.625rem]">
              {book.authors.map((author, i) => (
                <span key={author.slug}>
                  {i > 0 ? (i === book.authors.length - 1 ? " et " : ", ") : null}
                  <Link
                    href={`/library?author=${author.slug}`}
                    className="decoration-terracotta underline-offset-4 hover:underline"
                  >
                    {author.name}
                  </Link>
                </span>
              ))}
            </p>

            <BookReadingControl bookId={book.id} />

            {book.clubNote && book.clubNote.trim() !== book.summary.trim() ? (
              <blockquote className="mt-8 border-l-2 border-terracotta pl-5">
                <p className="surtitre">Le mot du club</p>
                <p className="mt-2 font-serif text-[1.375rem] leading-snug lg:text-[1.75rem]">
                  {book.clubNote}
                </p>
              </blockquote>
            ) : null}

            <h2 className="surtitre mt-10">De quoi ça parle</h2>
            <div className="mt-3 max-w-(--container-lecture) space-y-4 text-[1.0625rem] leading-[1.7]">
              {book.summary.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>

            {isMonthly && selection?.event ? (
              <p className="mt-8 rounded-champ bg-sable px-5 py-4">
                <span className="font-semibold">
                  Livre du mois · {formatMonth(selection.month)}.
                </span>{" "}
                Nous en parlons le{" "}
                <Link href={`/events/${selection.event.slug}`} className="lien">
                  {formatFullDate(selection.event.startsAt)}
                </Link>
                .
              </p>
            ) : null}

            {facts.length > 0 ? (
              <dl className="mt-10 grid grid-cols-2 gap-x-6 border-t border-indigo/20 sm:grid-cols-3">
                {facts.map(([label, value]) => (
                  <div key={label} className="border-b border-indigo/20 py-4">
                    <dt className="petit text-gris">{label}</dt>
                    <dd className="mt-0.5 font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {bios.map((author) => (
              <section key={author.slug} className="mt-10">
                <h2 className="surtitre">À propos de {author.name}</h2>
                <p className="mt-3 max-w-(--container-lecture) text-gris">{author.bio}</p>
              </section>
            ))}

            {reviews.length > 0 ? (
              <section aria-labelledby="avis-titre" className="mt-12">
                <h2 id="avis-titre" className="titre-3">
                  Ce qu’en disent les membres
                </h2>
                <ul className="mt-4">
                  {reviews.map((review) => (
                    <li key={review.id} className="border-t border-indigo/20 py-5">
                      <p className="petit font-semibold">
                        {review.firstName} · {review.rating}/5
                      </p>
                      <p className="mt-2 max-w-(--container-lecture)">{review.content}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </article>

      {related.length > 0 ? (
        <section aria-labelledby="voisins-titre" className="bg-sable py-16 lg:py-24">
          <div className="page">
            <p className="surtitre">{book.category.name}</p>
            <h2 id="voisins-titre" className="titre-2 mt-2">
              Sur la même étagère
            </h2>
            <ul className="mt-8 grid grid-cols-2 items-start gap-x-5 gap-y-10 sm:grid-cols-4 md:gap-x-7 lg:max-w-[60rem]">
              {related.map((other) => (
                <li key={other.slug}>
                  <BookCard
                    href={`/library/${other.slug}`}
                    title={other.title}
                    author={other.authorNames}
                    category={other.category.name}
                    image={other.coverImage}
                    sizes="(min-width: 1024px) 220px, 46vw"
                  />
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
            "@type": "Book",
            name: book.title,
            author: book.authors.map((author) => ({ "@type": "Person", name: author.name })),
            inLanguage: book.language,
            ...(book.isbn ? { isbn: book.isbn } : {}),
            ...(book.publisher ? { publisher: book.publisher } : {}),
          }),
        }}
      />
    </>
  );
}

function BookSkeleton() {
  return (
    <div aria-hidden="true" className="page pt-20 pb-16 lg:grid lg:grid-cols-12 lg:gap-8">
      <div className="skeleton aspect-[2/3] w-[56%] max-w-[260px] rounded-couverture! lg:col-span-4 lg:w-full lg:max-w-[360px]" />
      <div className="mt-8 lg:col-span-7 lg:col-start-6 lg:mt-0">
        <div className="skeleton h-3 w-32" />
        <div className="skeleton mt-4 h-12 w-4/5" />
        <div className="skeleton mt-4 h-6 w-2/5" />
        <div className="skeleton mt-10 h-40 w-full" />
      </div>
    </div>
  );
}

export default function BookPage({ params }: Props) {
  return (
    <Suspense fallback={<BookSkeleton />}>
      <BookSheet params={params} />
    </Suspense>
  );
}

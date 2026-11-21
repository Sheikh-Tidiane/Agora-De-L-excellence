import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/layout/page-intro";
import { BookCard } from "@/components/shared/book-card";
import { BookCover } from "@/components/shared/book-cover";
import { BookCardSkeleton, EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { catalogFacets, filterBooks, type BookFilter } from "@/features/library/catalog";
import { CatalogFilters } from "@/features/library/components/catalog-filters";
import { getCatalog } from "@/features/library/queries";

export const metadata: Metadata = {
  title: "Bibliothèque",
  description:
    "Le catalogue du club : romans, essais, poésie, théâtre. Littérature sénégalaise et africaine d’abord, avec le mot du club sur chaque livre.",
  alternates: { canonical: "/library" },
};

// Fiches alignées par le haut : les couvertures d'une rangée commencent à la même hauteur,
// quelle que soit la longueur du titre en légende.
const grid =
  "grid grid-cols-2 items-start gap-x-5 gap-y-12 sm:grid-cols-3 md:gap-x-7 lg:grid-cols-5";

const one = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.slice(0, 80).trim() || undefined;

async function Catalog({ searchParams }: Pick<PageProps<"/library">, "searchParams">) {
  const params = await searchParams;
  const filter: BookFilter = {
    q: one(params.q),
    category: one(params.category),
    author: one(params.author),
  };
  const catalog = await getCatalog();
  const facets = catalogFacets(catalog);
  const filtered = Boolean(filter.q || filter.category || filter.author);
  const books = filterBooks(catalog, filter);
  const favorites = filtered ? [] : books.filter((book) => book.isClubFavorite).slice(0, 2);
  const rest = books.filter((book) => !favorites.includes(book));

  if (catalog.length === 0) {
    return (
      <EmptyState title="Le catalogue se prépare">
        Les premiers livres du club seront bientôt en rayon. Revenez dans quelques jours.
      </EmptyState>
    );
  }

  return (
    <>
      <CatalogFilters filter={filter} categories={facets.categories} authors={facets.authors} />

      <p role="status" className="petit mt-8 font-semibold text-gris">
        {books.length === 0
          ? "Aucun livre ne correspond."
          : filtered
            ? `${books.length} livre${books.length > 1 ? "s" : ""} sur ${catalog.length}`
            : `${catalog.length} livre${catalog.length > 1 ? "s" : ""} au catalogue`}
      </p>

      {books.length === 0 ? (
        <EmptyState
          title="Rien sur cette étagère"
          action={
            <Link href="/library" className={buttonVariants({ variant: "contour" })}>
              Voir tout le catalogue
            </Link>
          }
        >
          Essayez un autre mot, ou retirez un filtre. Le catalogue s’enrichit chaque mois.
        </EmptyState>
      ) : null}

      {/* Coups de cœur : traités comme une ouverture, pas comme deux cartes de plus. */}
      {favorites.length > 0 ? (
        <section aria-labelledby="coups-titre" className="mt-10 border-t-2 border-indigo pt-8">
          <h2 id="coups-titre" className="surtitre">
            Coups de cœur du club
          </h2>
          <ul className="mt-6 grid gap-10 lg:grid-cols-2 lg:gap-8">
            {favorites.map((book) => (
              <li key={book.slug}>
                <article className="group relative grid grid-cols-[38%_1fr] items-end gap-5 lg:gap-8">
                  <BookCover
                    title={book.title}
                    author={book.authorNames}
                    category={book.category.name}
                    image={book.coverImage}
                    sizes="(min-width: 1024px) 230px, 38vw"
                    className="transition-transform duration-200 ease-agora group-hover:-translate-y-1"
                  />
                  <div className="pb-1">
                    <p className="surtitre text-[0.6875rem]!">{book.category.name}</p>
                    <h3 className="titre-2 mt-2">
                      <Link href={`/library/${book.slug}`} className="after:absolute after:inset-0">
                        {book.title}
                      </Link>
                    </h3>
                    <p className="mt-1 text-gris">{book.authorNames}</p>
                    {book.clubNote ? (
                      <p className="mt-3 font-serif text-[1.125rem] leading-snug lg:text-[1.25rem]">
                        «&nbsp;{book.clubNote}&nbsp;»
                      </p>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <section
          aria-labelledby="etagere-titre"
          className={favorites.length > 0 ? "mt-16 border-t border-indigo/20 pt-8" : "mt-8"}
        >
          <h2 id="etagere-titre" className={favorites.length > 0 ? "surtitre" : "sr-only"}>
            {filtered ? "Résultats" : "Toute l’étagère"}
          </h2>
          <ul className={`${grid} ${favorites.length > 0 ? "mt-8" : ""}`}>
            {rest.map((book) => (
              <li key={book.slug}>
                <BookCard
                  href={`/library/${book.slug}`}
                  title={book.title}
                  author={book.authorNames}
                  category={book.category.name}
                  note={book.clubNote}
                  image={book.coverImage}
                  sizes="(min-width: 1024px) 230px, (min-width: 640px) 30vw, 46vw"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-12 w-full max-w-3xl" />
      <div className={`${grid} mt-12`}>
        {Array.from({ length: 5 }, (_, i) => (
          <BookCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <>
      <PageIntro surtitre="Bibliothèque" letter="B" arc="b" title="Sur l’étagère du club.">
        Les livres que nous avons lus, ceux que nous lirons, et ce que nous en disons. Un mot du
        club accompagne chaque titre.
      </PageIntro>
      <div className="page py-12 lg:py-20">
        <Suspense fallback={<CatalogSkeleton />}>
          <Catalog searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

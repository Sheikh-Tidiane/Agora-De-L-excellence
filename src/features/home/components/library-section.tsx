import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BookCard } from "@/components/shared/book-card";
import { BookCover } from "@/components/shared/book-cover";
import { Carousel } from "@/components/shared/carousel";
import { Reveal } from "@/components/shared/motion";
import { buttonVariants } from "@/components/ui/button";
import { getCatalog, getCurrentSelection } from "@/features/library/queries";
import { formatFullDate, formatMonth } from "@/lib/dates";

export async function LibrarySection() {
  const [selection, catalog] = await Promise.all([getCurrentSelection(), getCatalog()]);
  const shelf = catalog.filter((book) => book.slug !== selection?.book.slug).slice(0, 10);
  // Un club sans livre en ligne ne montre pas une étagère vide : la section attend le catalogue.
  if (!selection && shelf.length === 0) return null;
  const book = selection?.book;

  return (
    <section aria-labelledby="livres-titre" className="overflow-hidden bg-sable py-18 lg:py-36">
      <div className="page">
        {/* Le livre du mois : la couverture d'abord, comme posée sur la section. */}
        {selection && book ? (
          <Reveal>
            <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-8">
              <div className="w-[58%] max-w-[280px] lg:col-span-4 lg:col-start-2 lg:w-full lg:max-w-none">
                <BookCover
                  title={book.title}
                  author={book.authorNames}
                  category={book.category.name}
                  image={book.coverImage}
                  variant="cadre"
                  palette={0}
                  sizes="(min-width: 1024px) 400px, 58vw"
                />
              </div>
              <div className="lg:col-span-6 lg:col-start-7 lg:pb-6">
                <p className="surtitre">Le livre du mois · {formatMonth(selection.month)}</p>
                <h2 id="livres-titre" className="titre-1 mt-3">
                  {book.title}
                </h2>
                <p className="mt-2 font-serif text-xl lg:text-2xl">{book.authorNames}</p>
                <p className="chapo mt-5">{selection.note ?? book.summary}</p>
                <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
                  <Link
                    href={`/library/${book.slug}`}
                    className={buttonVariants({ variant: "principal" })}
                  >
                    Découvrir le livre
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  {selection.event ? (
                    <Link
                      href={`/events/${selection.event.slug}`}
                      className="lien inline-flex min-h-11 items-center max-sm:mt-1"
                    >
                      Rencontre le {formatFullDate(selection.event.startsAt)}
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </Reveal>
        ) : null}

        {shelf.length > 0 ? (
          <div
            className={
              selection
                ? "mt-16 flex items-end justify-between gap-6 border-t border-indigo/20 pt-8 lg:mt-28 lg:pt-10"
                : "flex items-end justify-between gap-6"
            }
          >
            <div>
              <p className="surtitre">Bibliothèque</p>
              {selection ? (
                <h3 className="titre-2 mt-2">Sur l’étagère du club</h3>
              ) : (
                <h2 id="livres-titre" className="titre-1 mt-3">
                  Sur l’étagère du club
                </h2>
              )}
            </div>
            <Link href="/library" className="lien hidden min-h-11 items-center sm:inline-flex">
              Tout le catalogue
            </Link>
          </div>
        ) : null}
      </div>

      {/* La piste déborde jusqu'au bord de l'écran : on voit qu'il y a une suite. */}
      {shelf.length > 0 ? (
        <div className="page mt-8 lg:mt-10">
          <Carousel
            label="Sélection de livres"
            trackClassName="-mx-5 gap-5 px-5 pt-2 pb-4 md:-mx-10 md:gap-7 md:px-10 xl:-mx-12 xl:px-12 scroll-px-5 md:scroll-px-10 xl:scroll-px-12"
          >
            {shelf.map((b) => (
              <li
                key={b.slug}
                className="w-[46%] shrink-0 snap-start sm:w-[30%] md:w-[23%] lg:w-[17.5%]"
              >
                <BookCard
                  href={`/library/${b.slug}`}
                  title={b.title}
                  author={b.authorNames}
                  category={b.category.name}
                  note={b.clubNote}
                  image={b.coverImage}
                />
              </li>
            ))}
          </Carousel>
          <Link href="/library" className="lien -mt-11 inline-flex min-h-11 items-center sm:hidden">
            Tout le catalogue
          </Link>
        </div>
      ) : null}
    </section>
  );
}

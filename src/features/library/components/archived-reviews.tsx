import Link from "next/link";
import type { ArchivedReview } from "@/features/library/queries";
import { formatMonthYear } from "@/lib/dates";

/**
 * Archives : fiches de lecture des membres (critiques approuvées, publiées sous leur prénom).
 * Mise en page de citations sur deux colonnes en grand écran, filet en tête de chaque fiche.
 */
export function ArchivedReviews({ reviews }: { reviews: ArchivedReview[] }) {
  return (
    <section
      aria-labelledby="fiches-titre"
      className="mt-12 lg:mt-20 lg:grid lg:grid-cols-12 lg:gap-8"
    >
      <div className="lg:sticky lg:top-32 lg:col-span-3 lg:self-start">
        <h2 id="fiches-titre" className="titre-2">
          Fiches de lecture
        </h2>
        <p className="petit mt-2 max-w-[18rem] text-gris">
          Les critiques des membres, relues par le club et publiées avec leur accord.
        </p>
      </div>
      <ul className="mt-6 grid gap-x-10 border-b border-indigo/20 sm:grid-cols-2 lg:col-span-9 lg:mt-0">
        {reviews.map((review) => (
          <li key={review.id} className="group relative border-t border-indigo/20 py-6 lg:py-8">
            <p className="surtitre">
              {review.firstName}
              <span aria-hidden="true"> · </span>
              <span className="sr-only">, note&nbsp;: </span>
              {review.rating}/5
              {review.approvedAt ? (
                <>
                  <span aria-hidden="true"> · </span>
                  <span className="sr-only">, </span>
                  {formatMonthYear(review.approvedAt)}
                </>
              ) : null}
            </p>
            <h3 className="titre-3 mt-3">
              <Link
                href={`/library/${review.book.slug}`}
                className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
              >
                {review.book.title}
              </Link>
            </h3>
            {review.book.authors ? (
              <p className="petit mt-1 text-gris">{review.book.authors}</p>
            ) : null}
            <blockquote className="relative mt-4 pl-5 text-[1.0625rem] leading-relaxed">
              <span
                aria-hidden="true"
                className="absolute top-[-0.35rem] left-0 font-serif text-[2rem] leading-none text-terracotta"
              >
                «
              </span>
              {review.excerpt}
            </blockquote>
          </li>
        ))}
      </ul>
    </section>
  );
}

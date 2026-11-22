import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookCover } from "@/components/shared/book-cover";
import { Tag } from "@/components/shared/event-row";
import { authRoutes } from "@/config/auth";
import {
  ReadingEditor,
  RemoveReading,
  SubmitForValidation,
} from "@/features/readings/components/reading-editor";
import { CompletionTag } from "@/features/readings/components/reading-pills";
import { ReviewForm } from "@/features/readings/components/review-form";
import { getMyReading } from "@/features/readings/queries";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Ma lecture" };

const reviewTags = {
  PENDING: <Tag tone="alerte">En relecture</Tag>,
  APPROVED: <Tag tone="succes">Approuvée</Tag>,
  REJECTED: <Tag tone="erreur">Refusée</Tag>,
} as const;

async function Reading({ params }: { params: PageProps<"/member/readings/[id]">["params"] }) {
  const { id } = await params;
  const user = await requirePageAccess("member.access", `${authRoutes.member}/readings/${id}`);
  const reading = await getMyReading(user.id, id);
  if (!reading) notFound();
  const author = reading.book.authors.map((a) => a.name).join(", ");
  const finished = reading.status === "FINISHED";
  const canSubmit =
    finished && (reading.completionStatus === "NONE" || reading.completionStatus === "REJECTED");

  return (
    <article>
      <Link
        href="/member/readings"
        className="-ml-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold hover:text-terracotta-fonce"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mes lectures
      </Link>

      <header className="mt-4 grid grid-cols-[96px_1fr] gap-5 sm:grid-cols-[140px_1fr] sm:gap-8">
        <BookCover
          title={reading.book.title}
          author={author}
          category={reading.book.category.name}
          image={reading.book.coverImage}
          sizes="140px"
        />
        <div className="min-w-0 self-end">
          <p className="surtitre">{reading.book.category.name}</p>
          <h1 className="mt-2 font-serif text-[1.75rem] leading-tight sm:text-[2.5rem]">
            {reading.book.title}
          </h1>
          <p className="mt-1 font-serif text-lg text-gris">{author}</p>
          <Link
            href={`/library/${reading.book.slug}`}
            className="lien petit mt-2 inline-flex min-h-11 items-center"
          >
            Fiche du livre
          </Link>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
        <section aria-labelledby="suivi-titre" className="lg:col-span-5">
          <h2 id="suivi-titre" className="titre-3">
            Mon suivi
          </h2>
          <div className="mt-5">
            <ReadingEditor
              defaults={{
                readingId: reading.id,
                status: reading.status,
                progress: reading.progress,
                personalNote: reading.personalNote ?? "",
                isFavorite: reading.isFavorite,
              }}
              completion={reading.completionStatus}
            />
          </div>
          {reading.completionStatus !== "PENDING" && reading.completionStatus !== "APPROVED" ? (
            <div className="mt-8 border-t border-indigo/15 pt-5">
              <RemoveReading readingId={reading.id} />
            </div>
          ) : null}
        </section>

        <div className="space-y-10 lg:col-span-4">
          {finished ? (
            <section
              aria-labelledby="validation-titre"
              className="rounded-[14px] bg-blanc p-5 sm:p-6"
            >
              <h2 id="validation-titre" className="surtitre">
                Livre terminé
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <CompletionTag status={reading.completionStatus} />
              </div>
              {reading.completionStatus === "NONE" ? (
                <p className="petit mt-2 text-gris">
                  Un responsable de la bibliothèque valide votre lecture, souvent après en avoir
                  parlé avec vous : elle rapporte alors des points.
                </p>
              ) : null}
              {reading.completionStatus === "PENDING" && reading.submittedAt ? (
                <p className="petit mt-2 text-gris">
                  Demande envoyée le {formatDate(reading.submittedAt)}.
                </p>
              ) : null}
              {reading.completionStatus === "APPROVED" && reading.validatedAt ? (
                <p className="petit mt-2 text-gris">
                  Validée le {formatDate(reading.validatedAt)}.
                </p>
              ) : null}
              {reading.completionStatus === "REJECTED" && reading.validationNote ? (
                <blockquote className="petit mt-3 border-l-2 border-erreur pl-3">
                  {reading.validationNote}
                </blockquote>
              ) : null}
              {canSubmit ? (
                <div className="mt-4">
                  <SubmitForValidation readingId={reading.id} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="critique-titre">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="critique-titre" className="titre-3">
                Ma critique
              </h2>
              {reading.review ? reviewTags[reading.review.status] : null}
            </div>
            {reading.review?.status === "REJECTED" && reading.review.moderationNote ? (
              <blockquote className="petit mt-3 border-l-2 border-erreur pl-3">
                {reading.review.moderationNote}
              </blockquote>
            ) : null}
            {finished ? (
              <div className="mt-5">
                <ReviewForm
                  isEdit={Boolean(reading.review)}
                  defaults={{
                    bookId: reading.book.id,
                    rating: reading.review?.rating ?? 0,
                    content: reading.review?.content ?? "",
                    publishWithFirstName: reading.review?.publishWithFirstName ?? false,
                  }}
                />
              </div>
            ) : (
              <p className="mt-3 text-gris">
                Vous pourrez écrire votre critique une fois le livre terminé.
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

export default function ReadingPage({ params }: PageProps<"/member/readings/[id]">) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="mt-14 grid grid-cols-[96px_1fr] gap-5">
          <div className="skeleton aspect-[2/3] w-full" />
          <div className="skeleton h-16 w-3/4 self-end" />
        </div>
      }
    >
      <Reading params={params} />
    </Suspense>
  );
}

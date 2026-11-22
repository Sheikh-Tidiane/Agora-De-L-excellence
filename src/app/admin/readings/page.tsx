import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { DecisionButtons } from "@/features/readings/components/decision-buttons";
import { getValidationQueues } from "@/features/readings/queries";
import { formatDate } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Lectures à valider" };

const who = (user: { firstName: string; lastName: string; memberNumber: string | null }) =>
  `${user.firstName} ${user.lastName}${user.memberNumber ? ` · ${user.memberNumber}` : ""}`;

async function Queues() {
  const user = await requirePageAccess("readings.validate", "/admin/readings");
  const { readings, reviews } = await getValidationQueues();
  const moderates = can(user, "reviews.moderate");

  return (
    <>
      <AdminPageHeader title="Lectures à valider">
        Un « livre terminé » validé rapporte des points au membre ; une critique approuvée aussi, et
        elle paraît sur la fiche du livre si le membre l’a accepté. Un refus est toujours expliqué.
      </AdminPageHeader>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="terminés-titre">
          <div className="flex items-baseline justify-between gap-4 border-b border-indigo/30 pb-2">
            <h2 id="terminés-titre" className="titre-3">
              Livres terminés
            </h2>
            <span className="petit font-semibold text-gris tabular-nums">{readings.length}</span>
          </div>
          {readings.length === 0 ? (
            <EmptyState title="Rien à valider" className="py-8">
              Les demandes des membres apparaîtront ici, de la plus ancienne à la plus récente.
            </EmptyState>
          ) : (
            <ul>
              {readings.map((reading) => (
                <li key={reading.id} className="border-b border-indigo/15 py-5">
                  <p className="petit text-gris">
                    {who(reading.user)}
                    {reading.submittedAt
                      ? ` · demandé le ${formatDate(reading.submittedAt)}`
                      : null}
                  </p>
                  <p className="mt-1 font-serif text-xl leading-snug">
                    <Link href={`/library/${reading.book.slug}`} className="hover:underline">
                      {reading.book.title}
                    </Link>
                  </p>
                  <p className="petit text-gris">
                    {reading.book.authors.map((a) => a.name).join(", ")}
                  </p>
                  {reading.finishedAt ? (
                    <p className="petit mt-1">Terminé le {formatDate(reading.finishedAt)}</p>
                  ) : null}
                  <div className="mt-4">
                    <DecisionButtons
                      id={reading.id}
                      kind="reading"
                      label={`la lecture de ${reading.user.firstName} ${reading.user.lastName}, ${reading.book.title}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {moderates ? (
          <section aria-labelledby="critiques-titre">
            <div className="flex items-baseline justify-between gap-4 border-b border-indigo/30 pb-2">
              <h2 id="critiques-titre" className="titre-3">
                Critiques à relire
              </h2>
              <span className="petit font-semibold text-gris tabular-nums">{reviews.length}</span>
            </div>
            {reviews.length === 0 ? (
              <EmptyState title="Aucune critique en attente" className="py-8">
                Chaque critique envoyée ou modifiée par un membre passe ici avant toute publication.
              </EmptyState>
            ) : (
              <ul>
                {reviews.map((review) => (
                  <li key={review.id} className="border-b border-indigo/15 py-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="petit text-gris">
                        {who(review.user)} · {formatDate(review.updatedAt)}
                      </p>
                      {review.publishWithFirstName ? (
                        <StatusPill tone="accent">Publication demandée</StatusPill>
                      ) : (
                        <StatusPill tone="neutre">Non publique</StatusPill>
                      )}
                    </div>
                    <p className="mt-1 font-serif text-xl leading-snug">
                      {review.book.title} · {review.rating}/5
                    </p>
                    <p className="mt-2 max-w-(--container-lecture) whitespace-pre-line">
                      {review.content}
                    </p>
                    <div className="mt-4">
                      <DecisionButtons
                        id={review.id}
                        kind="review"
                        version={review.updatedAt.toISOString()}
                        label={`la critique de ${review.user.firstName} ${review.user.lastName}`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function AdminReadingsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Queues />
    </Suspense>
  );
}

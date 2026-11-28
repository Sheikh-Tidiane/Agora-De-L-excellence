import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { FeedbackModeration } from "@/features/feedback/components/feedback-moderation";
import { getEventFeedback } from "@/features/feedback/queries";
import { formatDateTime, formatFullDate } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Avis d’une rencontre" };

async function EventFeedback({ params }: Pick<PageProps<"/admin/feedback/[eventId]">, "params">) {
  const { eventId } = await params;
  const user = await requirePageAccess("feedback.read", `/admin/feedback/${eventId}`);
  const data = await getEventFeedback(eventId);
  if (!data) notFound();
  const { event, feedbacks, average } = data;
  const canModerate = can(user, "feedback.moderate");
  return (
    <>
      <AdminPageHeader title={event.title}>
        {formatFullDate(event.startsAt)} · {feedbacks.length} avis sur {event._count.registrations}{" "}
        présent{event._count.registrations > 1 ? "s" : ""} · moyenne{" "}
        {average === null ? "—" : `${average.toLocaleString("fr-FR")} sur 5`}
      </AdminPageHeader>
      <Link href="/admin/feedback" className="lien mb-6 inline-flex min-h-11 items-center">
        Tous les avis
      </Link>
      {feedbacks.length === 0 ? (
        <p className="text-gris">Aucun avis pour cette rencontre.</p>
      ) : (
        <ul className="divide-y divide-trait border-y border-trait" aria-label="Avis">
          {feedbacks.map((feedback) => {
            const author = feedback.anonymizedAt
              ? "Anonymisé (durée de conservation ou compte archivé)"
              : !feedback.registration
                ? "Auteur inconnu"
                : feedback.registration?.user
                  ? `${feedback.registration.user.name}${feedback.registration.user.memberNumber ? ` · ${feedback.registration.user.memberNumber}` : ""}`
                  : `Invité : ${feedback.registration?.guestName ?? "—"}`;
            return (
              <li key={feedback.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="font-semibold">{author}</p>
                  <p className="font-serif text-[1.5rem] leading-none tabular-nums">
                    {feedback.rating}
                    <span className="text-[1rem] text-gris"> / 5</span>
                  </p>
                </div>
                <p className="petit mt-1 text-gris">
                  Déposé le {formatDateTime(feedback.createdAt)}
                  {feedback.updatedAt.getTime() - feedback.createdAt.getTime() > 1000
                    ? ` · modifié le ${formatDateTime(feedback.updatedAt)}`
                    : ""}
                </p>
                {feedback.comment ? (
                  feedback.hiddenAt ? (
                    <div className="mt-3 rounded-champ bg-alerte-fond px-4 py-3">
                      <p className="petit font-semibold text-alerte">
                        Commentaire masqué : {feedback.hiddenReason}
                      </p>
                      <p className="mt-2 whitespace-pre-line text-gris line-through">
                        {feedback.comment}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 max-w-[46rem] whitespace-pre-line">{feedback.comment}</p>
                  )
                ) : null}
                {canModerate && feedback.comment && !feedback.anonymizedAt ? (
                  <FeedbackModeration
                    id={feedback.id}
                    version={feedback.updatedAt.toISOString()}
                    hidden={feedback.hiddenAt !== null}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function EventFeedbackPage({ params }: PageProps<"/admin/feedback/[eventId]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <EventFeedback params={params} />
    </Suspense>
  );
}

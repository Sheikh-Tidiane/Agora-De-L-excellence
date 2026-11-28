import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { authRoutes } from "@/config/auth";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { getMyFeedbackPage } from "@/features/feedback/queries";
import { canSubmit } from "@/features/feedback/rules";
import { placeLabel } from "@/features/events/rules";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Mon avis", robots: { index: false } };

async function MyFeedback({ params }: Pick<PageProps<"/member/events/[slug]/avis">, "params">) {
  const { slug } = await params;
  const user = await requirePageAccess("member.access", `${authRoutes.member}/events/${slug}/avis`);
  const settings = await loadClubSettings();
  const page = await getMyFeedbackPage(user.id, slug, settings.feedbackRequestHour);
  if (!page) notFound();
  const { event, present, feedback, window } = page;
  const now = new Date();
  const open = canSubmit(window, now);
  const closesAt = `${formatFullDate(window.closesAt)} à ${formatTime(window.closesAt)}`;

  return (
    <div className="max-w-[40rem]">
      <Link
        href={`${authRoutes.member}/events`}
        className="lien inline-flex min-h-11 items-center gap-1.5"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Mes rencontres
      </Link>
      <p className="surtitre mt-6">Votre avis</p>
      <h1 className="titre-1 mt-3">Qu’avez-vous pensé de cette rencontre ?</h1>
      <div className="mt-6 border-l-2 border-indigo pl-5">
        <p className="font-serif text-[1.375rem] leading-snug">{event.title}</p>
        <p className="mt-1 text-gris">
          {formatFullDate(event.startsAt)}, {formatTime(event.startsAt)} ·{" "}
          {placeLabel(event.location)}
        </p>
      </div>

      <div className="mt-8">
        {!present ? (
          <p className="rounded-champ bg-sable px-4 py-3">
            Seuls les participants pointés présents peuvent donner leur avis sur cette rencontre.
          </p>
        ) : now < window.endedAt ? (
          <p className="rounded-champ bg-sable px-4 py-3">
            Vous pourrez donner votre avis à la fin de la rencontre.
          </p>
        ) : !open ? (
          <p className="rounded-champ bg-sable px-4 py-3">
            Les avis sur cette rencontre sont clos
            {feedback ? ` : vous lui aviez donné ${feedback.rating} sur 5.` : "."}
          </p>
        ) : (
          <>
            <p className="mb-6 text-gris">
              Une note de 1 à 5 et, si vous le voulez, un commentaire. Votre avis n’est jamais
              publié : seuls les responsables du club le lisent, avec votre nom. Modifiable jusqu’au{" "}
              {closesAt}.
            </p>
            <FeedbackForm
              target={{ eventId: event.id }}
              initial={
                feedback ? { rating: feedback.rating, comment: feedback.comment ?? "" } : null
              }
              commentLocked={feedback?.hiddenAt != null}
              closesAt={closesAt}
            />
          </>
        )}
      </div>
    </div>
  );
}

export default function MyFeedbackPage({ params }: PageProps<"/member/events/[slug]/avis">) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="skeleton h-96 w-full max-w-[40rem]" />}>
      <MyFeedback params={params} />
    </Suspense>
  );
}

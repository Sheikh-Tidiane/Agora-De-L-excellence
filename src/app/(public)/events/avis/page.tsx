import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TileLoader } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { FeedbackForm } from "@/features/feedback/components/feedback-form";
import { getGuestFeedbackPage } from "@/features/feedback/queries";
import { canSubmit } from "@/features/feedback/rules";
import { placeLabel } from "@/features/events/rules";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Mon avis",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Page du lien reçu par e-mail par un invité présent : donner ou modifier son avis. */
async function GuestFeedback({ searchParams }: Pick<PageProps<"/events/avis">, "searchParams">) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw : "";
  const settings = await loadClubSettings();
  const page = await getGuestFeedbackPage(token, settings.feedbackRequestHour);

  if (!page) {
    return (
      <>
        <p className="surtitre">Votre avis</p>
        <h1 className="titre-1 mt-3">Ce lien n’est plus valable.</h1>
        <p className="chapo mt-6 text-gris">
          Il est incomplet, ou la rencontre n’existe plus. Pour toute remarque, écrivez au club.
        </p>
        <Link href="/contact" className={`${buttonVariants({ variant: "principal" })} mt-6`}>
          Écrire au club
        </Link>
      </>
    );
  }

  const { event, present, feedback, window } = page;
  const now = new Date();
  const open = canSubmit(window, now);
  const closesAt = `${formatFullDate(window.closesAt)} à ${formatTime(window.closesAt)}`;

  return (
    <>
      <p className="surtitre">Votre avis</p>
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
              target={{ token }}
              initial={
                feedback ? { rating: feedback.rating, comment: feedback.comment ?? "" } : null
              }
              commentLocked={feedback?.hiddenAt != null}
              closesAt={closesAt}
            />
          </>
        )}
      </div>
    </>
  );
}

export default function GuestFeedbackPage({ searchParams }: PageProps<"/events/avis">) {
  return (
    <div className="page py-12 lg:py-24">
      <div className="max-w-[40rem]">
        <Suspense fallback={<TileLoader label="Recherche de votre rencontre" />}>
          <GuestFeedback searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

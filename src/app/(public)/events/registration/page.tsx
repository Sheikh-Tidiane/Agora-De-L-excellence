import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TileLoader } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { FormNotice } from "@/features/auth/components/form-parts";
import {
  GuestCancelButton,
  GuestConfirmButton,
} from "@/features/events/components/registration-forms";
import { getGuestRegistration } from "@/features/events/registration";
import {
  canCancel,
  cancellationDeadline,
  holdsSeat,
  ordinal,
  placeLabel,
} from "@/features/events/rules";
import { waitlistPosition } from "@/features/events/waitlist";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";

export const metadata: Metadata = {
  title: "Mon inscription",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Shell({
  surtitre,
  title,
  children,
}: {
  surtitre: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <p className="surtitre">{surtitre}</p>
      <h1 className="titre-1 mt-3">{title}</h1>
      <div className="mt-6">{children}</div>
    </>
  );
}

/** Page du lien reçu par e-mail : confirmer, retrouver ou annuler une inscription invitée. */
async function Registration({
  searchParams,
}: Pick<PageProps<"/events/registration">, "searchParams">) {
  const { token: raw } = await searchParams;
  const token = typeof raw === "string" ? raw : "";
  const registration = await getGuestRegistration(token);

  if (!registration) {
    return (
      <Shell surtitre="Inscription" title="Ce lien n’est plus valable.">
        <p className="chapo text-gris">
          Il est incomplet, ou l’inscription n’existe plus. Vous pouvez vous inscrire à nouveau
          depuis l’agenda.
        </p>
        <Link href="/events" className={`${buttonVariants({ variant: "principal" })} mt-6`}>
          Voir l’agenda
        </Link>
      </Shell>
    );
  }

  const now = new Date();
  const { event } = registration;
  const settings = await loadClubSettings();
  const deadline = cancellationDeadline(event, settings.cancellationDeadlineHours);
  const when = `${formatFullDate(event.startsAt)}, ${formatTime(event.startsAt)}`;
  const summary = (
    <div className="border-l-2 border-indigo pl-5">
      <p className="font-serif text-[1.375rem] leading-snug">{event.title}</p>
      <p className="mt-1 text-gris">
        {when} · {placeLabel(event.location)}
      </p>
    </div>
  );
  const eventLink = (
    <Link href={`/events/${event.slug}`} className="lien mt-6 inline-flex min-h-11 items-center">
      Voir la rencontre
    </Link>
  );

  if (registration.status === "CANCELLED") {
    return (
      <Shell surtitre="Inscription annulée" title="Votre place a été libérée.">
        {summary}
        <p className="mt-5 text-gris">
          Changement de programme&nbsp;? Vous pouvez vous réinscrire depuis la page de la rencontre.
        </p>
        {eventLink}
      </Shell>
    );
  }

  if (registration.status === "WAITLISTED" && !registration.waitlistedAt) {
    return (
      <Shell
        surtitre="Liste d’attente"
        title={`${registration.guestName?.split(" ")[0] ?? "Bonjour"}, confirmez votre place sur la liste.`}
      >
        {summary}
        <p className="mt-5 text-gris">
          La rencontre est complète. Confirmez votre adresse pour prendre votre rang : si une place
          se libère, vous êtes inscrit d’office et prévenu par e-mail.
        </p>
        <div className="mt-6">
          <GuestConfirmButton token={token} waitlist />
        </div>
      </Shell>
    );
  }

  if (registration.status === "WAITLISTED" && registration.waitlistedAt) {
    const position = await waitlistPosition({
      id: registration.id,
      eventId: registration.eventId,
      waitlistedAt: registration.waitlistedAt,
    });
    return (
      <Shell
        surtitre="Liste d’attente"
        title={`Vous êtes ${ordinal(position)} sur la liste d’attente.`}
      >
        {summary}
        <p className="mt-5 text-gris">
          Si une place se libère jusqu’à {settings.waitlistCutoffHours}&nbsp;h avant le début, vous
          êtes inscrit d’office et prévenu par e-mail. Vous pouvez quitter la liste à tout moment.
        </p>
        <div className="mt-6">
          <GuestCancelButton token={token} waitlist />
        </div>
        {eventLink}
      </Shell>
    );
  }

  if (registration.status === "PENDING") {
    const expired = !holdsSeat({ status: "PENDING", updatedAt: registration.updatedAt }, now);
    return (
      <Shell
        surtitre="Inscription"
        title={`${registration.guestName?.split(" ")[0] ?? "Bonjour"}, confirmez votre place.`}
      >
        {summary}
        {expired ? (
          <p className="mt-5 text-gris">
            Le délai de confirmation est passé&nbsp;: la place n’est plus retenue, mais vous pouvez
            encore confirmer s’il en reste.
          </p>
        ) : null}
        <div className="mt-6">
          <GuestConfirmButton token={token} />
        </div>
      </Shell>
    );
  }

  return (
    <Shell surtitre="Inscription confirmée" title="Votre place est réservée.">
      <FormNotice className="mb-6">Nous vous attendons.</FormNotice>
      {summary}
      {canCancel(event, now, settings.cancellationDeadlineHours) ? (
        <div className="mt-8 border-t border-indigo/20 pt-6">
          <p className="mb-4 text-gris">
            Un empêchement&nbsp;? Vous pouvez annuler jusqu’au {formatFullDate(deadline)} à{" "}
            {formatTime(deadline)}.
          </p>
          <GuestCancelButton token={token} />
        </div>
      ) : (
        <p className="mt-6 text-gris">
          Le délai d’annulation est passé. Un empêchement&nbsp;? Prévenez le club.
        </p>
      )}
      {eventLink}
    </Shell>
  );
}

export default function RegistrationPage({ searchParams }: PageProps<"/events/registration">) {
  return (
    <div className="page py-12 lg:py-24">
      <div className="max-w-[40rem]">
        <Suspense fallback={<TileLoader label="Recherche de votre inscription" />}>
          <Registration searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

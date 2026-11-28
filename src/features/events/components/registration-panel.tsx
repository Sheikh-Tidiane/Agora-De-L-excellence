import Link from "next/link";
import { connection } from "next/server";
import { loginHref, membershipHref } from "@/config/navigation";
import { FormNotice } from "@/features/auth/components/form-parts";
import {
  GuestRegistrationForm,
  GuestWaitlistForm,
  MemberCancelButton,
  MemberJoinWaitlistButton,
  MemberLeaveWaitlistButton,
  MemberRegisterButton,
} from "@/features/events/components/registration-forms";
import { StickyCta } from "@/features/events/components/sticky-cta";
import {
  countSeatsTaken,
  getEventVideoLink,
  getMemberRegistration,
  type PublicEvent,
} from "@/features/events/queries";
import {
  canCancel,
  cancellationDeadline,
  ordinal,
  registrationWindow,
  seatsLeft,
  waitlistOpen,
} from "@/features/events/rules";
import { countWaitlisted, waitlistPosition } from "@/features/events/waitlist";
import { hideVideoLink } from "@/features/members/card-dues";
import { getCardDue } from "@/features/members/card-dues-queries";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate, formatTime } from "@/lib/dates";
import { getCurrentUser } from "@/lib/permissions";

const closedMessages = {
  past: "Cette rencontre a eu lieu. Les inscriptions sont closes.",
  closed: "Les inscriptions à cette rencontre sont closes.",
  cancelled: "Cette rencontre est annulée.",
  unpublished: "Cette rencontre n’est pas encore ouverte aux inscriptions.",
} as const;

/**
 * Inscription à une rencontre, selon qui regarde : membre connecté, visiteur (si la rencontre
 * est ouverte au public), ou personne (complet, passé, annulé). Rendu à la requête : jamais en cache.
 */
export async function RegistrationPanel({ event }: { event: PublicEvent }) {
  await connection();
  const now = new Date();
  const [user, taken, settings, waiting] = await Promise.all([
    getCurrentUser(),
    countSeatsTaken(event.id, now),
    loadClubSettings(),
    countWaitlisted(event.id),
  ]);
  const window = registrationWindow(event, now);
  const left = seatsLeft(event.capacity, taken);
  const registration = user ? await getMemberRegistration(event.id, user.id) : null;
  const registered = registration?.status === "CONFIRMED";
  // Sur la liste d'attente : son rang (1 = la prochaine place libérée est pour lui).
  const position =
    registration?.status === "WAITLISTED" && registration.waitlistedAt
      ? await waitlistPosition({ ...registration, waitlistedAt: registration.waitlistedAt })
      : null;
  const listOpen = waitlistOpen(event, now, settings.waitlistCutoffHours);
  // Complet : plus de place, ou des personnes attendent encore (les places leur reviennent).
  const full = left === 0 || (waiting > 0 && listOpen);
  // Le lien pour suivre à distance n'est lu que pour un membre inscrit, et pas du tout si le club
  // le masque aux membres dont la carte n'est pas réglée après le délai de grâce (réglage).
  const videoHidden =
    registered && user && settings.hideVideoWhenCardUnpaid
      ? hideVideoLink(await getCardDue(user.id, settings.cardGraceDays, now), true)
      : false;
  const videoLink = registered && !videoHidden ? await getEventVideoLink(event.id) : null;
  const deadline = cancellationDeadline(event, settings.cancellationDeadlineHours);
  const cancellable = canCancel(event, now, settings.cancellationDeadlineHours);
  const canRegister = window === "open" && !registered && position === null && !full;
  const canJoinList = window === "open" && !registered && position === null && full && listOpen;
  const cutoffLabel = `${settings.waitlistCutoffHours} h`;
  // Après connexion, retour sur cette rencontre pour s'inscrire en un geste.
  const returnLogin = `${loginHref}?next=${encodeURIComponent(`/events/${event.slug}`)}`;

  const seats =
    left === null ? (
      "Sans limite de places."
    ) : full ? (
      <>
        Complet
        {waiting > 0
          ? ` · ${waiting} personne${waiting > 1 ? "s" : ""} sur la liste d’attente`
          : ""}
        .
      </>
    ) : (
      <>
        <span className="font-serif text-[2rem] leading-none text-indigo">{left}</span> place
        {left > 1 ? "s" : ""} restante{left > 1 ? "s" : ""} sur {event.capacity}
      </>
    );

  return (
    <div id="inscription" className="scroll-mt-24">
      <h2 className="titre-3">Inscription</h2>
      {window === "open" ? <p className="mt-2 text-gris">{seats}</p> : null}

      <div className="mt-5">
        {registered && registration ? (
          <>
            <FormNotice>Vous êtes inscrit. Nous vous attendons.</FormNotice>
            {videoHidden && window !== "cancelled" ? (
              <p className="mt-4 rounded-champ bg-alerte-fond px-4 py-3 text-alerte">
                <span className="font-semibold">Suivre à distance&nbsp;:</span> le lien de visio est
                réservé aux membres dont la carte est réglée.{" "}
                <Link href="/member/card" className="lien">
                  Régler ma carte
                </Link>
              </p>
            ) : null}
            {videoLink && window !== "cancelled" ? (
              <p className="mt-4 rounded-champ bg-sable px-4 py-3">
                <span className="font-semibold">Vous ne pouvez pas venir&nbsp;?</span>{" "}
                <a href={videoLink} rel="noopener noreferrer" className="lien">
                  Suivre la rencontre à distance
                </a>
              </p>
            ) : null}
            {cancellable ? (
              <div className="mt-4">
                <MemberCancelButton registrationId={registration.id} />
                <p className="petit mt-3 text-gris">
                  Annulation possible jusqu’au {formatFullDate(deadline)} à {formatTime(deadline)}.
                </p>
              </div>
            ) : window === "open" ? (
              <p className="petit mt-3 text-gris">
                Le délai d’annulation est passé. Un empêchement ? Prévenez le club.
              </p>
            ) : null}
          </>
        ) : position !== null && registration ? (
          <>
            <FormNotice>
              Vous êtes sur la liste d’attente : {ordinal(position)}
              {position === 1 ? ", la prochaine place libérée est pour vous." : "."}
            </FormNotice>
            <p className="petit mt-3 text-gris">
              Si une place se libère jusqu’à {cutoffLabel} avant le début, vous êtes inscrit
              d’office et prévenu par e-mail.
            </p>
            <div className="mt-4">
              <MemberLeaveWaitlistButton registrationId={registration.id} />
            </div>
          </>
        ) : window !== "open" ? (
          <p className="rounded-champ bg-sable px-4 py-3 font-semibold">{closedMessages[window]}</p>
        ) : full && !listOpen ? (
          <p className="rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
            Toutes les places sont prises et la liste d’attente est close.
          </p>
        ) : full && user ? (
          <>
            <p className="rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
              Toutes les places sont prises.
            </p>
            <div className="mt-4">
              <MemberJoinWaitlistButton eventId={event.id} />
            </div>
            <p className="petit mt-3 text-gris">
              Si une place se libère jusqu’à {cutoffLabel} avant le début, la première personne de
              la liste est inscrite d’office et prévenue par e-mail. Vous pouvez quitter la liste à
              tout moment.
            </p>
          </>
        ) : full && event.isPublic ? (
          <>
            <p className="mb-4 rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
              Toutes les places sont prises : inscrivez-vous sur la liste d’attente.
            </p>
            <GuestWaitlistForm eventId={event.id} />
            <p className="petit mt-4 text-gris">
              Déjà membre&nbsp;?{" "}
              <Link href={returnLogin} className="lien">
                Connectez-vous
              </Link>{" "}
              pour rejoindre la liste en un geste.
            </p>
          </>
        ) : full ? (
          <p className="rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
            Toutes les places sont prises. Les membres connectés peuvent rejoindre la liste
            d’attente.
          </p>
        ) : user ? (
          <>
            <MemberRegisterButton eventId={event.id} />
            <p className="petit mt-3 text-gris">
              Inscrit en tant que {user.name}. Annulation possible jusqu’au{" "}
              {formatFullDate(deadline)}.
            </p>
          </>
        ) : event.isPublic ? (
          <>
            <GuestRegistrationForm eventId={event.id} />
            <p className="petit mt-4 text-gris">
              Déjà membre&nbsp;?{" "}
              <Link href={returnLogin} className="lien">
                Connectez-vous
              </Link>{" "}
              pour vous inscrire en un geste.
            </p>
          </>
        ) : (
          <>
            <p className="rounded-champ bg-sable px-4 py-3">
              <span className="font-semibold">Cette rencontre est réservée aux membres.</span>{" "}
              Connectez-vous pour vous inscrire.
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href={returnLogin}
                className="inline-flex h-12 items-center justify-center rounded-champ bg-indigo px-5 font-semibold text-ivoire transition-colors hover:bg-indigo-profond"
              >
                Se connecter
              </Link>
              <Link href={membershipHref} className="lien inline-flex min-h-11 items-center">
                Pas encore membre&nbsp;? Demander mon adhésion
              </Link>
            </div>
          </>
        )}
      </div>

      {/* Mobile : l'action principale reste sous le pouce tant qu'on n'a pas atteint le formulaire. */}
      {canRegister ? (
        <StickyCta targetId="inscription">
          {user
            ? "Je m’inscris"
            : event.isPublic
              ? "Réserver ma place"
              : "Se connecter pour s’inscrire"}
        </StickyCta>
      ) : canJoinList && (user || event.isPublic) ? (
        <StickyCta targetId="inscription">Rejoindre la liste d’attente</StickyCta>
      ) : null}
    </div>
  );
}

export function RegistrationPanelSkeleton() {
  return (
    // Hauteur réservée : celle du formulaire d'un visiteur, pour que le pied de page ne bouge pas
    // sur téléphone quand le panneau remplace son squelette.
    <div aria-hidden="true" className="min-h-[26.5rem] lg:min-h-0">
      <div className="skeleton h-6 w-32" />
      <div className="skeleton mt-4 h-5 w-48" />
      <div className="skeleton mt-5 h-14 w-full" />
    </div>
  );
}

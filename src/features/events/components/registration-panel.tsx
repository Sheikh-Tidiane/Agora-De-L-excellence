import Link from "next/link";
import { connection } from "next/server";
import { loginHref, membershipHref } from "@/config/navigation";
import { FormNotice } from "@/features/auth/components/form-parts";
import {
  GuestRegistrationForm,
  MemberCancelButton,
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
  registrationWindow,
  seatsLeft,
} from "@/features/events/rules";
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
  const [user, taken, settings] = await Promise.all([
    getCurrentUser(),
    countSeatsTaken(event.id, now),
    loadClubSettings(),
  ]);
  const window = registrationWindow(event, now);
  const left = seatsLeft(event.capacity, taken);
  const registration = user ? await getMemberRegistration(event.id, user.id) : null;
  const registered = registration?.status === "CONFIRMED";
  // Le lien pour suivre à distance n'est lu que pour un membre inscrit.
  const videoLink = registered ? await getEventVideoLink(event.id) : null;
  const deadline = cancellationDeadline(event, settings.cancellationDeadlineHours);
  const cancellable = canCancel(event, now, settings.cancellationDeadlineHours);
  const canRegister = window === "open" && !registered && left !== 0;
  // Après connexion, retour sur cette rencontre pour s'inscrire en un geste.
  const returnLogin = `${loginHref}?next=${encodeURIComponent(`/events/${event.slug}`)}`;

  const seats =
    left === null ? (
      "Sans limite de places."
    ) : left === 0 ? (
      "Complet."
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
        ) : window !== "open" ? (
          <p className="rounded-champ bg-sable px-4 py-3 font-semibold">{closedMessages[window]}</p>
        ) : left === 0 ? (
          <p className="rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
            Toutes les places sont prises. Une place peut se libérer : repassez plus tard.
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

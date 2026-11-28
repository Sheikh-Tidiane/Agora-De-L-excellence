/**
 * Avis après une rencontre (docs/REGLES-METIER.md, « Avis après la rencontre ») : règles pures.
 * Dakar est à UTC+0 sans heure d'été : les calculs se font en UTC.
 *
 * - Fin de la rencontre : `endsAt`, sinon début + 3 h.
 * - Invitation : le lendemain de la fin, à l'heure réglée (10 h) ; rattrapage pendant 72 h si le
 *   serveur était arrêté, jamais au-delà.
 * - Dépôt dès la fin de la rencontre, modifiable jusqu'à 7 jours après l'ouverture des
 *   invitations : la même échéance pour tous, annoncée dans l'e-mail.
 */
const HOUR = 3_600_000;

export const FEEDBACK_EDIT_DAYS = 7;
export const CATCH_UP_HOURS = 72;
export const COMMENT_MAX = 1000;
export const REASON_MIN = 3;
export const REASON_MAX = 300;
/** En dessous, la moyenne n'est pas affichée (trop peu d'avis pour dire quelque chose). */
export const MIN_RATINGS_FOR_AVERAGE = 3;

export type FeedbackWindow = {
  endedAt: Date;
  opensAt: Date;
  catchUpUntil: Date;
  closesAt: Date;
};

export function feedbackWindow(
  event: { startsAt: Date; endsAt: Date | null },
  hour: number,
): FeedbackWindow {
  const endedAt =
    event.endsAt && event.endsAt > event.startsAt
      ? event.endsAt
      : new Date(event.startsAt.getTime() + 3 * HOUR);
  const opensAt = new Date(
    Date.UTC(endedAt.getUTCFullYear(), endedAt.getUTCMonth(), endedAt.getUTCDate() + 1, hour),
  );
  return {
    endedAt,
    opensAt,
    catchUpUntil: new Date(opensAt.getTime() + CATCH_UP_HOURS * HOUR),
    closesAt: new Date(opensAt.getTime() + FEEDBACK_EDIT_DAYS * 24 * HOUR),
  };
}

/** Dépôt ou modification possible. */
export const canSubmit = (window: FeedbackWindow, now: Date) =>
  now >= window.endedAt && now < window.closesAt;

/** Moment d'envoyer l'invitation (avec rattrapage). */
export const requestDue = (window: FeedbackWindow, now: Date) =>
  now >= window.opensAt && now < window.catchUpUntil;

/** Moyenne à une décimale, ou `null` s'il y a trop peu d'avis. */
export function displayAverage(sum: number, count: number): number | null {
  if (count < MIN_RATINGS_FOR_AVERAGE) return null;
  return Math.round((sum / count) * 10) / 10;
}

/**
 * Rappel la veille d'une rencontre (docs/REGLES-METIER.md, « Rappels la veille ») : règles pures.
 *
 * Fenêtre d'envoi : de la veille (jour de Dakar) à l'heure réglée, jusqu'à 2 h avant le début.
 * Dakar est à UTC+0 sans heure d'été : les calculs se font en UTC.
 * Une inscription confirmée après l'ouverture de la fenêtre n'a pas de rappel (la confirmation
 * vient de partir). Si le serveur était éteint à l'heure du rappel, il part au passage suivant.
 */
const HOUR = 3_600_000;

/** Plus de rappel moins de 2 h avant le début. */
export const REMINDER_CLOSE_HOURS = 2;
/** Fenêtre d'envoi minimale : plus que l'écart entre deux passages de la tâche (1 h). */
export const MIN_WINDOW_HOURS = 2;
/** Une réservation non suivie d'envoi est reprise après ce délai (processus tombé). */
export const CLAIM_LEASE_MINUTES = 30;
/** Tentatives d'envoi au plus, pour un même rappel. */
export const MAX_ATTEMPTS = 3;
/** Rencontre déplacée de moins de 15 min : pas de nouveau rappel. */
export const RESCHEDULE_TOLERANCE_MINUTES = 15;

export function reminderWindow(startsAt: Date, hour: number): { opensAt: Date; closesAt: Date } {
  const opensAt = new Date(
    Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate() - 1, hour),
  );
  const closesAt = new Date(startsAt.getTime() - REMINDER_CLOSE_HOURS * HOUR);
  // Heure tardive et rencontre très matinale (rappel à 23 h, rencontre à 0 h 30) : la fenêtre
  // serait vide ou plus courte que l'écart entre deux passages. Elle s'ouvre alors 12 h avant sa fin.
  if (closesAt.getTime() - opensAt.getTime() < MIN_WINDOW_HOURS * HOUR) {
    return { opensAt: new Date(closesAt.getTime() - 12 * HOUR), closesAt };
  }
  return { opensAt, closesAt };
}

export function reminderDue(
  registration: { startsAt: Date; confirmedAt: Date | null; createdAt: Date },
  hour: number,
  now: Date,
): boolean {
  const window = reminderWindow(registration.startsAt, hour);
  if (now < window.opensAt || now >= window.closesAt) return false;
  return (registration.confirmedAt ?? registration.createdAt) < window.opensAt;
}

/** Déjà prévenu de cet horaire (à la tolérance près) ? */
export function alreadyReminded(sentStartsAt: Date[], startsAt: Date): boolean {
  return sentStartsAt.some(
    (sent) => Math.abs(sent.getTime() - startsAt.getTime()) < RESCHEDULE_TOLERANCE_MINUTES * 60_000,
  );
}

/** « demain » ou « aujourd'hui » (rattrapage le jour même), vu de Dakar. */
export function dayWord(startsAt: Date, now: Date): "demain" | "aujourd’hui" {
  return startsAt.toISOString().slice(0, 10) === now.toISOString().slice(0, 10)
    ? "aujourd’hui"
    : "demain";
}

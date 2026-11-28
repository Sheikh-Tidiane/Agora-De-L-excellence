/**
 * Carte de membre à régler : délai de grâce et rappels (docs/REGLES-METIER.md, « Cotisations »).
 * Fonctions pures, testées sans base (`card-dues.test.ts`).
 *
 * - L'adhésion est acceptée au début de la première adhésion du membre (`Membership.startsAt`).
 * - Le délai de grâce court à partir de là (réglage `membership.cardGraceDays`, 30 jours par défaut).
 * - Rappels, une seule fois chacun, tant que la carte n'est pas réglée : 7 jours après
 *   l'acceptation, puis 3 jours avant la fin du délai.
 */
const DAY = 24 * 60 * 60 * 1000;

export const REMINDER_AFTER_ACCEPTANCE_DAYS = 7;
export const REMINDER_BEFORE_DEADLINE_DAYS = 3;

/** Date d'acceptation : début de la première adhésion ; `null` sans adhésion (compte de responsable). */
export function acceptedAt(memberships: readonly { startsAt: Date }[]): Date | null {
  if (memberships.length === 0) return null;
  return memberships.reduce(
    (first, m) => (m.startsAt < first ? m.startsAt : first),
    memberships[0]!.startsAt,
  );
}

/** Fin du délai de grâce : la carte devrait être réglée avant cet instant. */
export const cardDeadline = (accepted: Date, graceDays: number) =>
  new Date(accepted.getTime() + graceDays * DAY);

/** Jours entiers écoulés depuis l'acceptation (0 le jour même). */
export const daysSince = (accepted: Date, now: Date) =>
  Math.max(0, Math.floor((now.getTime() - accepted.getTime()) / DAY));

export type CardDue = {
  paid: boolean;
  accepted: Date | null;
  deadline: Date | null;
  /** Non réglée et délai de grâce passé. */
  overdue: boolean;
};

export function cardDue(
  input: { paid: boolean; memberships: readonly { startsAt: Date }[] },
  graceDays: number,
  now: Date,
): CardDue {
  const accepted = acceptedAt(input.memberships);
  const deadline = accepted ? cardDeadline(accepted, graceDays) : null;
  return {
    paid: input.paid,
    accepted,
    deadline,
    overdue: !input.paid && deadline !== null && now.getTime() >= deadline.getTime(),
  };
}

export type ReminderKind = "AFTER_ACCEPTANCE" | "BEFORE_DEADLINE";

/**
 * Rappels à envoyer maintenant, d'après ceux déjà envoyés. Aucun si la carte est réglée, sans
 * acceptation, ou une fois le délai passé. Seul le rappel le plus proche part : « 3 jours avant »
 * dès sa date venue ; avant elle, « 7 jours après » (sauté si les deux dates se chevauchent, délai
 * de moins de 10 jours, ou si la tâche a manqué sa date). Une tâche en retard (serveur éteint)
 * rattrape ainsi un rappel encore utile, sans en envoyer deux d'un coup.
 */
export function remindersDue(
  input: { paid: boolean; memberships: readonly { startsAt: Date }[] },
  sent: readonly ReminderKind[],
  graceDays: number,
  now: Date,
): ReminderKind[] {
  const due = cardDue(input, graceDays, now);
  if (due.paid || !due.accepted || !due.deadline) return [];
  const t = now.getTime();
  const end = due.deadline.getTime();
  if (t >= end) return [];
  const out: ReminderKind[] = [];
  const afterAt = due.accepted.getTime() + REMINDER_AFTER_ACCEPTANCE_DAYS * DAY;
  const beforeAt = end - REMINDER_BEFORE_DEADLINE_DAYS * DAY;
  if (t >= beforeAt) {
    if (!sent.includes("BEFORE_DEADLINE")) out.push("BEFORE_DEADLINE");
  } else if (t >= afterAt && !sent.includes("AFTER_ACCEPTANCE")) {
    out.push("AFTER_ACCEPTANCE");
  }
  return out;
}

/**
 * Lien de visio : masqué si l'option est activée et que la carte n'est pas réglée après le délai
 * de grâce. Un compte sans adhésion (responsable) n'est jamais concerné.
 */
export const hideVideoLink = (due: CardDue, option: boolean) => option && due.overdue;

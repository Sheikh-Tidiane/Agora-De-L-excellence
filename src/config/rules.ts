/**
 * Règles métier par défaut, documentées dans docs/REGLES-METIER.md.
 * Ce sont des valeurs de départ : celles qui doivent être modifiables depuis l'admin
 * seront lues dans la table `Setting` (même clé), avec ces valeurs comme repli.
 */
export const rules = {
  /** Durée d'une adhésion, en mois. */
  "membership.durationMonths": 12,
  /** Carte de membre, en F CFA, versée une fois à l'adhésion (CONTENUS-CLUB.md, section 7). */
  "fees.membershipCard": 1000,
  /** Participation par séance, en F CFA. */
  "fees.session": 100,
  /** Une demande d'adhésion refusée est supprimée après ce délai, en mois. */
  "membership.rejectedRetentionMonths": 12,
  /** Un message de contact traité est supprimé après ce délai, en mois. */
  "contact.handledRetentionMonths": 12,
  /**
   * Délai de grâce pour régler la carte de membre, en jours après l'acceptation de l'adhésion.
   * Rappels : 7 jours après l'acceptation, puis 3 jours avant la fin du délai.
   */
  "membership.cardGraceDays": 30,
  /** Masquer le lien de visio d'un membre dont la carte n'est pas réglée après le délai de grâce. */
  "events.hideVideoWhenCardUnpaid": false,
  /** Rappel par e-mail la veille des rencontres, aux inscrits confirmés. */
  "events.remindersEnabled": true,
  /** Heure d'envoi du rappel la veille (heure de Dakar, 0 à 23). */
  "events.reminderHour": 10,
  /** Délai d'annulation d'une inscription avant le début de l'événement, en heures. */
  "events.cancellationDeadlineHours": 24,
  /** Avis publics sur le catalogue (critique validée + accord du membre). */
  "reviews.publicEnabled": true,
  /** Classements de points visibles des membres (top 10 + sa propre position). */
  "rankings.enabled": true,
  "rankings.topSize": 10,
} as const;

export type RuleKey = keyof typeof rules;

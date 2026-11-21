/**
 * Moteur de points et badges : règles pures, sans base ni React (testées dans `rules.test.ts`).
 * Voir docs/REGLES-METIER.md, « Points et badges », et docs/DECISIONS.md, section 11.
 */
import type { BadgeCriterion, PointSourceType } from "@/generated/prisma/client";

/** Codes des règles du barème qui ne dépendent pas d'un type d'événement (voir prisma/seed.ts). */
export const RULE_CODES = {
  bookFinished: "book_finished",
  reviewApproved: "review_approved",
  tournamentWin: "tournament_win",
  quizCompleted: "quiz_completed",
} as const;

/** Raisons pour lesquelles une attribution automatique ne rapporte rien. */
export type SkipReason =
  | "guest" // participant extérieur : ni compte ni points
  | "not_member" // compte sans numéro de membre (responsable seul) ou archivé
  | "not_eligible" // présence non pointée, lecture non validée, critique non approuvée…
  | "no_rule" // aucun barème pour cette source (type d'événement sans règle)
  | "inactive_rule"
  | "zero_points"
  | "self_award"; // le responsable est le bénéficiaire : on ne s'attribue jamais de points

/** Bornes d'un ajustement manuel et d'une valeur du barème. */
export const MAX_RULE_POINTS = 1000;
export const MAX_MANUAL_POINTS = 1000;

/** Ligne du grand livre réduite à ce qui compte pour décider d'une attribution. */
export type LedgerLine = {
  id: string;
  points: number;
  ruleId: string | null;
  /** Vrai si une ligne inverse la corrige déjà. */
  reversed: boolean;
};

export type AwardDecision =
  | { kind: "create_original" }
  | { kind: "already_awarded"; transactionId: string }
  /** L'attribution d'origine a été corrigée : on attribue à nouveau (présence recochée…). */
  | { kind: "create_regrant" };

/**
 * Décide d'une attribution pour une source, à partir des lignes déjà écrites pour cette source
 * (hors lignes de correction). Une source est « payée » tant qu'une de ses lignes positives
 * n'est pas corrigée : une seule ligne active à la fois, quel que soit le nombre d'appels.
 */
export function decideAward(lines: readonly LedgerLine[], ruleId: string): AwardDecision {
  const active = lines.find((line) => !line.reversed && line.points > 0);
  if (active) return { kind: "already_awarded", transactionId: active.id };
  const original = lines.find((line) => line.ruleId === ruleId);
  return original ? { kind: "create_regrant" } : { kind: "create_original" };
}

/** Ligne qui peut être corrigée : jamais une correction, jamais deux fois. */
export type ReversalCheck =
  { ok: true } | { ok: false; reason: "is_reversal" | "already_reversed" | "zero" };

export function canReverse(line: {
  reversesId: string | null;
  reversed: boolean;
  points: number;
}): ReversalCheck {
  if (line.reversesId !== null) return { ok: false, reason: "is_reversal" };
  if (line.reversed) return { ok: false, reason: "already_reversed" };
  if (line.points === 0) return { ok: false, reason: "zero" };
  return { ok: true };
}

export const reversalMessages: Record<Exclude<ReversalCheck, { ok: true }>["reason"], string> = {
  is_reversal: "Une correction ne se corrige pas : ajoutez un ajustement manuel motivé.",
  already_reversed: "Cette ligne a déjà été corrigée.",
  zero: "Cette ligne ne porte aucun point.",
};

/** Critères mesurés automatiquement. `MANUAL` n'en fait jamais partie. */
export const AUTOMATIC_CRITERIA = [
  "BOOKS_FINISHED",
  "REVIEWS_APPROVED",
  "EVENTS_ATTENDED",
  "DEBATES_ATTENDED",
  "TOURNAMENTS_PLAYED",
  "TOURNAMENTS_WON",
  "TOTAL_POINTS",
  "QUIZZES_COMPLETED",
] as const satisfies readonly BadgeCriterion[];

export type AutomaticCriterion = (typeof AUTOMATIC_CRITERIA)[number];
export type CriterionCounts = Record<AutomaticCriterion, number>;

export const isAutomaticCriterion = (criterion: BadgeCriterion): criterion is AutomaticCriterion =>
  (AUTOMATIC_CRITERIA as readonly string[]).includes(criterion);

export type BadgeDefinition = {
  code: string;
  criterion: BadgeCriterion;
  threshold: number | null;
  isActive: boolean;
};

/**
 * Badges automatiques dus et pas encore obtenus. Un seuil absent ou inférieur à 1 ne déclenche
 * rien (badge mal configuré : mieux vaut ne rien attribuer que tout attribuer).
 */
export function badgesDue(
  badges: readonly BadgeDefinition[],
  counts: CriterionCounts,
  heldCodes: ReadonlySet<string>,
): string[] {
  return badges
    .filter(
      (badge) =>
        badge.isActive &&
        !heldCodes.has(badge.code) &&
        isAutomaticCriterion(badge.criterion) &&
        badge.threshold !== null &&
        badge.threshold >= 1 &&
        counts[badge.criterion] >= badge.threshold,
    )
    .map((badge) => badge.code);
}

/** Avancée vers un badge : `null` si elle n'est pas mesurable (badge manuel, seuil absent). */
export function badgeProgress(
  badge: Pick<BadgeDefinition, "criterion" | "threshold">,
  counts: CriterionCounts,
): { current: number; threshold: number; ratio: number } | null {
  if (!isAutomaticCriterion(badge.criterion) || badge.threshold === null || badge.threshold < 1) {
    return null;
  }
  const current = Math.max(0, counts[badge.criterion]);
  return {
    current: Math.min(current, badge.threshold),
    threshold: badge.threshold,
    ratio: Math.min(1, current / badge.threshold),
  };
}

/** Mois calendaire à l'heure de Dakar (UTC+0, sans heure d'été) : [début, début du suivant[. */
export function monthBounds(now: Date): { from: Date; to: Date } {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

export type StandingInput = {
  userId: string;
  firstName: string;
  lastName: string;
  points: number;
};

export type RankedRow = {
  rank: number;
  userId: string;
  firstName: string;
  lastNameInitial: string;
  points: number;
};

/** Initiale du nom, sans le reste (vie privée) : « Diop » → « D. ». */
export function lastNameInitial(lastName: string): string {
  const letter = [...lastName.trim()][0];
  return letter ? `${letter.toLocaleUpperCase("fr-FR")}.` : "";
}

const collator = new Intl.Collator("fr", { sensitivity: "base" });

/**
 * Classement « 1, 1, 3 » : même total, même rang ; le rang suivant saute les ex æquo.
 * Seuls les totaux strictement positifs sont classés. À égalité, l'ordre d'affichage est stable :
 * prénom, puis initiale, puis identifiant (jamais l'ordre de la base).
 */
export function rankStandings(rows: readonly StandingInput[]): RankedRow[] {
  const sorted = rows
    .filter((row) => row.points > 0)
    .map((row) => ({ ...row, initial: lastNameInitial(row.lastName) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        collator.compare(a.firstName, b.firstName) ||
        collator.compare(a.initial, b.initial) ||
        (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0),
    );
  const ranked: RankedRow[] = [];
  for (const [index, row] of sorted.entries()) {
    const previous = ranked[index - 1];
    const rank = previous && previous.points === row.points ? previous.rank : index + 1;
    ranked.push({
      rank,
      userId: row.userId,
      firstName: row.firstName,
      lastNameInitial: row.initial,
      points: row.points,
    });
  }
  return ranked;
}

/** Libellé d'une ligne du grand livre, lisible par le membre. */
export function transactionLabel(line: {
  sourceType: PointSourceType;
  ruleLabel: string | null;
  sourceTitle: string | null;
  reason: string | null;
}): string {
  const title = line.sourceTitle ? ` · ${line.sourceTitle}` : "";
  switch (line.sourceType) {
    case "CORRECTION":
      return line.reason ? `Correction : ${line.reason}` : "Correction";
    case "MANUAL":
      return line.reason ? `Ajustement : ${line.reason}` : "Ajustement";
    default: {
      const fallback: Record<string, string> = {
        EVENT_ATTENDANCE: "Présence à une rencontre",
        READING: "Livre terminé",
        REVIEW: "Critique publiée",
        TOURNAMENT: "Tournoi de Scrabble",
        QUIZ: "Quiz terminé",
      };
      return `${line.ruleLabel ?? fallback[line.sourceType] ?? "Points"}${title}`;
    }
  }
}

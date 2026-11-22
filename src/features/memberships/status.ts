/** État d'adhésion d'un membre, déduit de sa période la plus récente. Fonction pure. */
export type MembershipState =
  | { kind: "active"; endsAt: Date; expiresSoon: boolean }
  | { kind: "expired"; endsAt: Date }
  | { kind: "suspended" }
  | { kind: "ended" }
  | { kind: "none" };

const DAY = 24 * 60 * 60 * 1000;

export function membershipState(
  membership: { status: "ACTIVE" | "EXPIRED" | "SUSPENDED" | "ENDED"; endsAt: Date } | null,
  now: Date,
): MembershipState {
  if (!membership) return { kind: "none" };
  if (membership.status === "SUSPENDED") return { kind: "suspended" };
  if (membership.status === "ENDED") return { kind: "ended" };
  // La date fait foi : une adhésion « ACTIVE » dont l'échéance est passée est expirée.
  if (membership.status === "EXPIRED" || membership.endsAt.getTime() < now.getTime()) {
    return { kind: "expired", endsAt: membership.endsAt };
  }
  return {
    kind: "active",
    endsAt: membership.endsAt,
    expiresSoon: membership.endsAt.getTime() - now.getTime() < 30 * DAY,
  };
}

export const membershipStateLabels: Record<MembershipState["kind"], string> = {
  active: "À jour",
  expired: "Expirée",
  suspended: "Suspendue",
  ended: "Terminée",
  none: "Aucune adhésion",
};

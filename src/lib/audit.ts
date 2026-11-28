import type { Prisma } from "@/generated/prisma/client";
import { redact } from "@/lib/logger";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Journal des actions sensibles : rôles, points, scores,
 * validation d'adhésion, suspension, activation et sécurité des comptes.
 */
export type AuditAction =
  | "auth.account_created"
  | "auth.account_activated"
  | "auth.activation_link_sent"
  | "auth.password_reset_requested"
  | "auth.password_reset"
  | "auth.sign_in_blocked"
  | "roles.assigned"
  | "roles.revoked"
  | "membership.approved"
  | "membership.rejected"
  | "membership.renewed"
  | "payment.recorded"
  | "payment.cancelled"
  | "attendance.recorded"
  | "attendance.scanned"
  | "points.awarded"
  | "points.granted"
  | "points.reversed"
  | "points.rule_updated"
  | "points.attendance_mode_updated"
  | "badge.awarded"
  | "charter.updated"
  | "contents.imported"
  | "committee.updated"
  | "event.report_saved"
  | "member.updated"
  | "member.suspended"
  | "member.reactivated"
  | "member.archived"
  | "member.card_revoked"
  | "reading.validated"
  | "reading.rejected"
  | "review.approved"
  | "review.rejected"
  | "event.status_changed"
  | "event.registration_removed"
  | "event.waitlist_joined"
  | "event.waitlist_left"
  | "event.waitlist_promoted"
  | "feedback.comment_hidden"
  | "feedback.comment_restored"
  | "feedback.purged"
  | "data.exported"
  | "settings.updated"
  | "quiz.published"
  | "quiz.unpublished"
  | "quiz.closed"
  | "quiz.archived"
  | "scrabble.status_changed"
  | "scrabble.scores_saved"
  | "scrabble.results_validated"
  | "scrabble.results_invalidated"
  | "scrabble.results_published"
  | "scrabble.record_saved"
  | "scrabble.record_deleted"
  | "contact.status_changed"
  | "demo.cleared";

export type AuditEntry = {
  /** Auteur. `null` : système, script CLI ou visiteur non connecté. */
  actorId: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  /** Détails. Les secrets et les e-mails sont masqués avant l'écriture. */
  metadata?: Record<string, unknown>;
};

/**
 * Écrit une entrée d'audit. Passer la transaction en cours (`db`) quand l'action
 * et sa trace doivent être enregistrées ensemble ou pas du tout.
 */
export async function audit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ? (redact(entry.metadata) as Prisma.InputJsonValue) : undefined,
    },
  });
}

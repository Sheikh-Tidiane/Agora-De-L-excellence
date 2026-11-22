import type { AuditAction } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

/**
 * Libellés lisibles des actions du journal d'audit. Typé sur `AuditAction` : une action ajoutée
 * sans libellé ne compile pas (le journal n'affiche jamais de code technique brut).
 */
const actionLabels: Record<AuditAction, string> = {
  "auth.account_created": "Compte créé",
  "auth.account_activated": "Compte activé",
  "auth.activation_link_sent": "Lien d’activation envoyé",
  "auth.password_reset_requested": "Réinitialisation demandée",
  "auth.password_reset": "Mot de passe changé",
  "auth.sign_in_blocked": "Connexion refusée (compte inactif)",
  "roles.assigned": "Rôle attribué",
  "roles.revoked": "Rôle retiré",
  "membership.approved": "Adhésion validée",
  "membership.rejected": "Adhésion refusée",
  "membership.renewed": "Adhésion renouvelée",
  "payment.recorded": "Encaissement enregistré",
  "payment.cancelled": "Encaissement annulé",
  "attendance.recorded": "Présence pointée",
  "attendance.scanned": "Présence scannée",
  "points.awarded": "Points attribués",
  "points.granted": "Points ajustés",
  "points.reversed": "Points corrigés",
  "points.rule_updated": "Barème des points modifié",
  "badge.awarded": "Badge décerné",
  "member.card_revoked": "Carte de membre remplacée",
  "reading.validated": "Lecture validée",
  "reading.rejected": "Lecture refusée",
  "review.approved": "Critique approuvée",
  "review.rejected": "Critique refusée",
  "quiz.published": "Quiz publié",
  "quiz.unpublished": "Quiz repassé en brouillon",
  "quiz.closed": "Quiz clos",
  "quiz.archived": "Quiz archivé",
  "scrabble.status_changed": "Statut d’un tournoi modifié",
  "scrabble.scores_saved": "Scores saisis",
  "scrabble.results_validated": "Résultats validés",
  "scrabble.results_invalidated": "Résultats dévalidés",
  "scrabble.results_published": "Résultats publiés",
  "scrabble.record_saved": "Record enregistré",
  "scrabble.record_deleted": "Record supprimé",
  "charter.updated": "Charte modifiée",
  "contents.imported": "Contenus importés",
  "committee.updated": "Comité de pilotage modifié",
  "event.report_saved": "Compte rendu enregistré",
  "member.updated": "Fiche de membre modifiée",
  "member.suspended": "Compte suspendu",
  "member.reactivated": "Compte réactivé",
  "member.archived": "Membre archivé",
  "event.status_changed": "Statut d’événement modifié",
  "event.registration_removed": "Inscription retirée",
  "data.exported": "Liste exportée (CSV)",
  "settings.updated": "Paramètres modifiés",
  "contact.status_changed": "Statut d’un message de contact modifié",
  // Action d’une ancienne commande de nettoyage, encore présente dans les journaux.
  "demo.cleared": "Données d’exemple supprimées (ancienne commande)",
};

export const auditActionLabels: Record<string, string> = {
  ...actionLabels,
  // Action d'une ancienne version, encore présente dans les journaux existants.
  "membership.fee_recorded": "Cotisation saisie",
};

const entityLabels: Record<string, string> = {
  Demo: "Données d’exemple (ancienne commande)",
  MembershipRequest: "Demande d’adhésion",
  Membership: "Adhésion",
  Event: "Événement",
  EventRegistration: "Inscription",
  Setting: "Paramètres du club",
  Payment: "Encaissement",
  CommitteeMember: "Comité de pilotage",
  Charter: "Charte du club",
  PointRule: "Barème des points",
  PointTransaction: "Points",
  Quiz: "Quiz",
  Reading: "Lecture",
  Review: "Critique",
  Round: "Manche",
  ScrabbleRecord: "Record du club",
  Tournament: "Tournoi",
};

export type AuditRow = {
  id: string;
  action: string;
  label: string;
  actor: string;
  target: string;
  createdAt: Date;
};

/**
 * Dernières entrées du journal d'audit. Réservé à la permission `audit.read` :
 * l'appelant doit l'avoir vérifiée (voir app/admin/page.tsx).
 */
export async function getRecentAuditLogs(take = 20): Promise<AuditRow[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });
  const userIds = logs.filter((l) => l.entityType === "User" && l.entityId).map((l) => l.entityId!);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(users.map((u) => [u.id, u.name]));
  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    label: auditActionLabels[log.action] ?? log.action,
    actor: log.actor?.name ?? "Système",
    target:
      (log.entityId && names.get(log.entityId)) ||
      (log.entityType === "User"
        ? "Compte supprimé"
        : (entityLabels[log.entityType] ?? log.entityType)),
    createdAt: log.createdAt,
  }));
}

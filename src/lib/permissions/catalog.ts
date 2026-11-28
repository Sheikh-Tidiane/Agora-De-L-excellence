/**
 * Catalogue des permissions et des rôles du club.
 * Source du seed : la base (tables Role, Permission, RolePermission) est alimentée à partir d'ici,
 * et c'est la base qui fait foi à l'exécution. Principe du moindre privilège (cahier des charges §7) ;
 * les rôles sont cumulables. Voir docs/REGLES-METIER.md.
 */
export const PERMISSIONS = {
  "member.access": "Accéder à l’espace membre",
  "admin.access": "Accéder à l’administration",
  "articles.manage": "Créer, modifier, publier et archiver les articles",
  "books.manage": "Gérer les livres, auteurs, catégories et le livre du mois",
  "readings.validate": "Valider les livres déclarés terminés",
  "reviews.moderate": "Modérer les critiques des membres",
  "tournaments.manage": "Gérer les tournois, participants, équipes et manches",
  "scores.enter": "Saisir et corriger les scores",
  "results.publish": "Valider et publier les résultats d’un tournoi",
  "memberships.review": "Valider ou refuser les demandes d’adhésion",
  "members.read": "Consulter la liste et les fiches des membres",
  "members.manage": "Modifier, suspendre, renouveler et archiver les membres",
  "events.manage": "Créer, modifier, publier et clôturer les événements",
  "attendance.record": "Enregistrer les présences",
  "payments.record": "Enregistrer les encaissements (carte de membre, participation aux séances)",
  "payments.read": "Consulter le tableau des encaissements",
  "points.grant": "Attribuer et corriger des points",
  "points.rules.manage": "Modifier le barème de points",
  "badges.award": "Attribuer un badge manuel",
  "quizzes.manage": "Créer, publier et clore les quiz, et consulter leurs résultats",
  "contact.manage": "Lire et traiter les messages reçus par le formulaire de contact",
  "data.export": "Exporter des listes (CSV)",
  "settings.manage": "Modifier les paramètres du club",
  "audit.read": "Consulter le journal des actions sensibles",
  "feedback.read": "Consulter les avis des participants sur les rencontres (notes, commentaires, auteurs)",
  "feedback.moderate": "Masquer ou rétablir le commentaire d’un avis",
  "roles.manage": "Gérer les comptes administratifs et les rôles",
} as const;

export type PermissionCode = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionCode[];

type RoleDefinition = {
  name: string;
  description: string;
  permissions: readonly PermissionCode[];
};

export const ROLES = {
  member: {
    name: "Membre",
    description: "Gère son profil, ses lectures, ses inscriptions ; consulte ses points et badges.",
    permissions: ["member.access"],
  },
  communication: {
    name: "Responsable communication",
    description:
      "Crée et gère les publications, annonces et contenus éditoriaux, dont les quiz des Génies du soir ; traite les messages de contact.",
    permissions: ["admin.access", "articles.manage", "quizzes.manage", "contact.manage"],
  },
  library: {
    name: "Responsable bibliothèque",
    description: "Gère les fiches de livres et les sélections de lecture.",
    permissions: ["admin.access", "books.manage", "readings.validate", "reviews.moderate"],
  },
  scrabble: {
    name: "Responsable Scrabble",
    description: "Gère les tournois, participants, scores et résultats.",
    permissions: ["admin.access", "tournaments.manage", "scores.enter", "results.publish"],
  },
  admin: {
    name: "Administrateur",
    description: "Gère les membres, les événements, les contenus et les paramètres.",
    permissions: [
      "admin.access",
      "articles.manage",
      "books.manage",
      "readings.validate",
      "reviews.moderate",
      "memberships.review",
      "members.read",
      "members.manage",
      "events.manage",
      "attendance.record",
      "payments.record",
      "payments.read",
      "points.grant",
      "points.rules.manage",
      "badges.award",
      "quizzes.manage",
      "contact.manage",
      "data.export",
      "settings.manage",
      "audit.read",
      "feedback.read",
      "feedback.moderate",
    ],
  },
  super_admin: {
    name: "Super administrateur",
    description: "Gère les comptes administratifs, les rôles et la configuration générale.",
    permissions: ALL_PERMISSIONS,
  },
} as const satisfies Record<string, RoleDefinition>;

export type RoleCode = keyof typeof ROLES;

export const ALL_ROLES = Object.keys(ROLES) as RoleCode[];

export function isRoleCode(value: string): value is RoleCode {
  return value in ROLES;
}

/** Union des permissions d'un ensemble de rôles (les rôles sont cumulables). */
export function permissionsForRoles(roles: readonly string[]): Set<PermissionCode> {
  const set = new Set<PermissionCode>();
  for (const role of roles) {
    if (isRoleCode(role)) for (const permission of ROLES[role].permissions) set.add(permission);
  }
  return set;
}

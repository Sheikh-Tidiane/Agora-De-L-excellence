import type { PermissionCode } from "@/lib/permissions/catalog";

export type AdminNavItem = {
  label: string;
  href: string;
  permission: PermissionCode;
  /** Deuxième touche du raccourci « g puis … ». */
  key?: string;
  /** Affiche le nombre de demandes en attente. */
  badge?: "pendingRequests" | "pendingReadings" | "newMessages";
};

export type AdminNavGroup = { title: string | null; items: AdminNavItem[] };

/** Rubriques de l'administration. Chacune n'apparaît qu'avec la permission correspondante. */
export const adminNav: AdminNavGroup[] = [
  {
    title: null,
    items: [{ label: "Tableau de bord", href: "/admin", permission: "admin.access", key: "t" }],
  },
  {
    title: "Communauté",
    items: [
      {
        label: "Demandes d’adhésion",
        href: "/admin/memberships",
        permission: "memberships.review",
        key: "d",
        badge: "pendingRequests",
      },
      {
        label: "Messages",
        href: "/admin/messages",
        permission: "contact.manage",
        key: "i",
        badge: "newMessages",
      },
      { label: "Membres", href: "/admin/members", permission: "members.read", key: "m" },
      { label: "Encaissements", href: "/admin/payments", permission: "payments.read", key: "c" },
      { label: "Points et badges", href: "/admin/points", permission: "points.grant", key: "x" },
      {
        label: "Scan des présences",
        href: "/admin/scan",
        permission: "attendance.record",
        key: "s",
      },
    ],
  },
  {
    title: "Bibliothèque",
    items: [
      { label: "Livres", href: "/admin/books", permission: "books.manage", key: "l" },
      {
        label: "Catégories et auteurs",
        href: "/admin/books/categories",
        permission: "books.manage",
      },
      { label: "Livre du mois", href: "/admin/books/monthly", permission: "books.manage" },
      {
        label: "Lectures à valider",
        href: "/admin/readings",
        permission: "readings.validate",
        key: "v",
        badge: "pendingReadings",
      },
    ],
  },
  {
    title: "Scrabble",
    items: [
      { label: "Tournois", href: "/admin/scrabble", permission: "tournaments.manage", key: "r" },
      {
        label: "Records du club",
        href: "/admin/scrabble/records",
        permission: "tournaments.manage",
      },
    ],
  },
  {
    title: "Vie du club",
    items: [
      { label: "Événements", href: "/admin/events", permission: "events.manage", key: "e" },
      { label: "Articles", href: "/admin/articles", permission: "articles.manage", key: "a" },
      { label: "Quiz", href: "/admin/quizzes", permission: "quizzes.manage", key: "q" },
      { label: "Avis des rencontres", href: "/admin/feedback", permission: "feedback.read" },
      { label: "Statistiques", href: "/admin/stats", permission: "stats.read" },
      { label: "Comité de pilotage", href: "/admin/committee", permission: "settings.manage" },
      { label: "Charte du club", href: "/admin/charter", permission: "settings.manage" },
      { label: "QR d’adhésion", href: "/admin/qr", permission: "memberships.review" },
    ],
  },
  {
    title: "Réglages",
    items: [
      {
        label: "Paramètres du club",
        href: "/admin/settings",
        permission: "settings.manage",
        key: "p",
      },
      { label: "Équipe et rôles", href: "/admin/team", permission: "roles.manage" },
      { label: "Journal", href: "/admin/audit", permission: "audit.read", key: "j" },
    ],
  },
];

/** Libellés du fil d'Ariane, par segment d'adresse. */
export const adminBreadcrumbLabels: Record<string, string> = {
  admin: "Administration",
  memberships: "Demandes d’adhésion",
  messages: "Messages",
  members: "Membres",
  books: "Livres",
  categories: "Catégories et auteurs",
  monthly: "Livre du mois",
  readings: "Lectures à valider",
  events: "Événements",
  articles: "Articles",
  payments: "Encaissements",
  scan: "Scan des présences",
  points: "Points et badges",
  committee: "Comité de pilotage",
  charter: "Charte du club",
  qr: "QR d’adhésion",
  settings: "Paramètres du club",
  team: "Équipe et rôles",
  audit: "Journal",
  new: "Nouveau",
  quizzes: "Quiz",
  feedback: "Avis des rencontres",
  stats: "Statistiques",
  partenaires: "Version partenaires",
  preview: "Aperçu",
  results: "Résultats",
  scrabble: "Tournois",
  records: "Records du club",
  scores: "Saisie des scores",
};

export function visibleAdminNav(permissions: readonly string[]): AdminNavGroup[] {
  return adminNav
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.includes(item.permission)),
    }))
    .filter((group) => group.items.length > 0);
}

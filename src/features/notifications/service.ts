import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { build } from "@/lib/mail/templates";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Notifications du club (phase 4, partie C).
 * - In-app : une ligne `Notification` par destinataire, lue ou non lue.
 * - E-mail : seulement pour les plus importantes (`email: true`), envoyé **après** l'écriture,
 *   hors de toute transaction. Un échec d'envoi est journalisé et n'annule rien.
 * Les types connus sont listés dans `NOTIFICATION_TYPES` : ils servent au libellé de l'e-mail.
 */
export const NOTIFICATION_TYPES = {
  "membership.welcome": "Bienvenue",
  "event.registered": "Inscription",
  "event.waitlist_promoted": "Place obtenue",
  "reading.validated": "Lecture validée",
  "reading.rejected": "Lecture",
  "review.approved": "Critique publiée",
  "review.rejected": "Critique",
  "badge.awarded": "Nouveau badge",
  "tournament.results": "Résultats du tournoi",
  "quiz.published": "Nouveau quiz",
  "card.reminder": "Carte de membre",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

export type NotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  /** Lien interne (commence par « / »). */
  href?: string | null;
};

const TITLE_MAX = 160;
const BODY_MAX = 600;

function clean(input: NotificationInput) {
  if (input.href && !input.href.startsWith("/")) {
    throw new AppError("VALIDATION", "Lien de notification invalide.");
  }
  return {
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, TITLE_MAX),
    body: input.body.slice(0, BODY_MAX),
    href: input.href ?? null,
  };
}

/**
 * Écrit des notifications in-app (dans la transaction de l'appelant si `db` en est une).
 * Renvoie les identifiants créés, à passer à `sendNotificationEmails` après la transaction.
 */
export async function createNotifications(
  inputs: readonly NotificationInput[],
  db: Db = prisma,
): Promise<string[]> {
  const ids: string[] = [];
  for (const input of inputs) {
    const row = await db.notification.create({ data: clean(input), select: { id: true } });
    ids.push(row.id);
  }
  return ids;
}

/**
 * Notifications in-app en nombre (une par membre, sans e-mail) : une seule requête `createMany`.
 * Renvoie le nombre de lignes écrites.
 */
export async function createBulkNotifications(
  inputs: readonly NotificationInput[],
  db: Db = prisma,
): Promise<number> {
  if (inputs.length === 0) return 0;
  const { count } = await db.notification.createMany({ data: inputs.map(clean) });
  return count;
}

/**
 * Envoie l'e-mail des notifications importantes, hors transaction. Un compte inactif,
 * suspendu ou archivé ne reçoit rien. Ne lève jamais : renvoie le nombre d'e-mails partis.
 */
export async function sendNotificationEmails(ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await prisma.notification.findMany({
    where: { id: { in: [...ids] }, emailSentAt: null },
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      user: { select: { email: true, firstName: true, status: true, archivedAt: true } },
    },
  });
  let sent = 0;
  for (const row of rows) {
    if (row.user.status !== "ACTIVE" || row.user.archivedAt) continue;
    try {
      await sendMail(
        notificationEmail({
          to: row.user.email,
          firstName: row.user.firstName,
          type: row.type,
          title: row.title,
          body: row.body,
          href: row.href,
        }),
      );
      await prisma.notification.update({
        where: { id: row.id },
        data: { emailSentAt: new Date(), channel: "EMAIL" },
      });
      sent += 1;
    } catch (error) {
      logger.error("E-mail de notification non envoyé", error, { notificationId: row.id });
    }
  }
  return sent;
}

/** Raccourci hors transaction : écrit, puis envoie l'e-mail si demandé. Ne lève pas sur l'envoi. */
export async function notify(
  inputs: NotificationInput | readonly NotificationInput[],
  options: { email?: boolean } = {},
): Promise<void> {
  const list = Array.isArray(inputs) ? inputs : [inputs as NotificationInput];
  try {
    const ids = await createNotifications(list);
    if (options.email) await sendNotificationEmails(ids);
  } catch (error) {
    // Une notification manquée ne doit jamais faire échouer le geste qui l'a déclenchée.
    logger.error("Notification non créée", error, { count: list.length });
  }
}

export function notificationEmail(input: {
  to: string;
  firstName: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
}) {
  const surtitre = NOTIFICATION_TYPES[input.type as NotificationType] ?? "Notification";
  return build(input.to, input.title, {
    preheader: input.body.slice(0, 120),
    surtitre,
    title: input.title,
    paragraphs: [`Bonjour ${input.firstName},`, input.body],
    action: input.href
      ? { label: "Ouvrir dans mon espace", url: `${env.APP_URL}${input.href}` }
      : undefined,
    notes: ["Vous retrouvez toutes vos notifications dans votre espace membre."],
  });
}

// --- Lecture et état « lu » (le membre ne touche qu'à ses propres notifications) ---

export const NOTIFICATIONS_PAGE_SIZE = 50;

export async function listNotifications(userId: string, db: Db = prisma) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: NOTIFICATIONS_PAGE_SIZE,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });
}

export async function countUnread(userId: string, db: Db = prisma): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Marque une notification comme lue. Celle d'un autre membre est introuvable (pas de fuite). */
export async function markRead(userId: string, id: string, db: Db = prisma) {
  const { count } = await db.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (count === 0) {
    const exists = await db.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) throw new AppError("NOT_FOUND", "Notification introuvable.");
  }
}

export async function markAllRead(userId: string, db: Db = prisma): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return count;
}

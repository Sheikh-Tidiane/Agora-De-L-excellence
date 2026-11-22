import { Suspense } from "react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/states";
import { authRoutes } from "@/config/auth";
import {
  NotificationList,
  type NotificationItem,
} from "@/features/notifications/components/notification-list";
import {
  listNotifications,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/features/notifications/service";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Notifications" };

async function Notifications() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/notifications`);
  const rows = await listNotifications(user.id);
  if (rows.length === 0) {
    return (
      <EmptyState title="Aucune notification" className="mt-8">
        Le club vous écrit ici quand une lecture est validée, une critique modérée, une inscription
        confirmée ou des résultats publiés.
      </EmptyState>
    );
  }
  const items: NotificationItem[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    href: row.href,
    read: row.readAt !== null,
    when: formatDateTime(row.createdAt),
    label: NOTIFICATION_TYPES[row.type as NotificationType] ?? "Notification",
  }));
  return (
    <div className="mt-8 max-w-[44rem]">
      <NotificationList items={items} />
    </div>
  );
}

export default function MemberNotificationsPage() {
  return (
    <>
      <p className="surtitre">Espace membre</p>
      <h1 className="titre-1 mt-3">Notifications</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 max-w-[44rem] space-y-4">
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-20 w-full" />
          </div>
        }
      >
        <Notifications />
      </Suspense>
    </>
  );
}

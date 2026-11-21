import Link from "next/link";
import { Bell } from "lucide-react";
import { HideOnPath } from "@/features/notifications/components/hide-on-path";
import { countUnread } from "@/features/notifications/service";
import { getCurrentUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const label = (n: number) =>
  n === 0 ? "Notifications" : `${n} notification${n > 1 ? "s" : ""} non ${n > 1 ? "lues" : "lue"}`;

/** Colonne latérale (desktop) : lien permanent, pastille terracotta s'il reste du non lu. */
export async function SideNotificationsLink() {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await countUnread(user.id);
  return (
    <Link
      href="/member/notifications"
      className="lien inline-flex min-h-11 items-center gap-2"
      aria-label={label(unread)}
    >
      Notifications
      {unread > 0 ? (
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-terracotta px-1.5 text-[0.75rem] font-bold text-blanc tabular-nums no-underline">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Mobile : bandeau discret en tête de page, seulement s'il reste du non lu (sinon la page reste
 * accessible depuis le tableau de bord et le profil). Masqué sur la page des notifications.
 */
export async function MobileUnreadBanner({ className }: { className?: string }) {
  const user = await getCurrentUser();
  if (!user) return null;
  const unread = await countUnread(user.id);
  if (unread === 0) return null;
  return (
    <HideOnPath path="/member/notifications">
      <Link
        href="/member/notifications"
        className={cn(
          "mb-6 flex min-h-11 items-center gap-3 rounded-[12px] bg-blanc px-4 py-2.5 text-[0.9375rem] font-semibold text-indigo lg:hidden",
          className,
        )}
      >
        <span className="relative">
          <Bell aria-hidden="true" className="size-5" strokeWidth={1.8} />
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-terracotta"
          />
        </span>
        {label(unread)}
      </Link>
    </HideOnPath>
  );
}

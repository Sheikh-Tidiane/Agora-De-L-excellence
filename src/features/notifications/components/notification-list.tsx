"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/actions";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  href: string | null;
  read: boolean;
  /** Date déjà mise en forme côté serveur (fuseau du club). */
  when: string;
  label: string;
};

/**
 * Liste des notifications. Ouvrir une notification la marque comme lue ; « Tout marquer comme
 * lu » est proposé dès qu'il en reste une non lue. L'état lu s'affiche aussitôt (optimiste).
 */
export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [optimistic, setRead] = useOptimistic(items, (state, id: string | "all") =>
    state.map((item) => (id === "all" || item.id === id ? { ...item, read: true } : item)),
  );
  const unread = optimistic.filter((item) => !item.read).length;

  const markOne = (id: string) =>
    start(async () => {
      setRead(id);
      const result = await markNotificationReadAction({ id });
      if (!result.ok) setError(result.message);
      router.refresh();
    });

  const markAll = () =>
    start(async () => {
      setError(undefined);
      setRead("all");
      const result = await markAllNotificationsReadAction({});
      if (!result.ok) setError(result.message);
      router.refresh();
    });

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p className="petit font-semibold text-gris" aria-live="polite">
          {unread === 0 ? "Tout est lu." : `${unread} non ${unread > 1 ? "lues" : "lue"}`}
        </p>
        {unread > 0 ? (
          <Button variant="contour" onClick={markAll} disabled={pending}>
            Tout marquer comme lu
          </Button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="petit mt-2 text-erreur">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 border-b border-indigo/20">
        {optimistic.map((item) => {
          const content = (
            <>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-2 shrink-0 rounded-full transition-colors duration-200",
                    item.read ? "bg-transparent" : "bg-terracotta",
                  )}
                />
                <span className="petit font-semibold text-gris">
                  {item.label} · {item.when}
                </span>
                {item.read ? null : <span className="sr-only">(non lue)</span>}
              </span>
              <span
                className={cn(
                  "mt-1 block pl-4 font-serif text-lg leading-snug",
                  item.read ? "text-indigo/80" : "text-indigo",
                )}
              >
                {item.title}
              </span>
              <span className="mt-1 block pl-4 text-gris">{item.body}</span>
            </>
          );
          return (
            <li key={item.id} className="border-t border-indigo/20">
              {item.href ? (
                <Link
                  href={item.href}
                  onClick={() => (item.read ? undefined : markOne(item.id))}
                  className="-mx-3 block rounded-[12px] px-3 py-4 transition-colors duration-200 hover:bg-blanc focus-visible:outline-2"
                >
                  {content}
                </Link>
              ) : (
                <div className="py-4">
                  {content}
                  {item.read ? null : (
                    <button
                      type="button"
                      onClick={() => markOne(item.id)}
                      className="lien mt-1 ml-4 inline-flex min-h-11 items-center"
                    >
                      Marquer comme lue
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, CalendarDays, Home, Trophy, UserRound, type LucideIcon } from "lucide-react";
import { activeMemberTab, memberTabs, type MemberTabKey } from "@/config/navigation";
import { cn } from "@/lib/utils";

export const memberTabIcons: Record<MemberTabKey, LucideIcon> = {
  home: Home,
  readings: BookOpen,
  events: CalendarDays,
  scrabble: Trophy,
  profile: UserRound,
};

const readyTabs = memberTabs.filter((tab) => tab.ready);

/**
 * Barre d'onglets du bas (mobile, sous 1024 px) : fixée dans la zone du pouce,
 * cibles de 64 px de haut, onglet courant marqué par un trait terracotta.
 */
export function MemberBottomBar() {
  const active = activeMemberTab(usePathname());
  return (
    <nav
      aria-label="Espace membre"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-trait bg-blanc pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${readyTabs.length}, minmax(0, 1fr))` }}
      >
        {readyTabs.map((tab) => {
          const Icon = memberTabIcons[tab.key];
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold transition-colors duration-200 active:bg-ivoire",
                  current ? "text-indigo" : "text-gris",
                )}
              >
                {current ? (
                  <span
                    aria-hidden="true"
                    className="rounded-b-sm absolute top-0 h-[3px] w-8 bg-terracotta"
                  />
                ) : null}
                <Icon
                  aria-hidden="true"
                  className="size-[22px]"
                  strokeWidth={current ? 2.2 : 1.8}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Navigation de la colonne latérale (desktop) : liste verticale, filet terracotta sur l'onglet courant. */
export function MemberSideNav() {
  const active = activeMemberTab(usePathname());
  return (
    <nav aria-label="Espace membre">
      <ul className="border-t border-indigo/15">
        {readyTabs.map((tab) => {
          const Icon = memberTabIcons[tab.key];
          const current = tab.key === active;
          return (
            <li key={tab.key} className="border-b border-indigo/15">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-12 items-center gap-3 py-3 pl-4 text-[0.9375rem] font-semibold transition-colors duration-200",
                  current ? "text-indigo" : "text-gris hover:text-indigo",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-2 bottom-2 left-0 w-[3px] rounded-full transition-colors duration-200",
                    current ? "bg-terracotta" : "bg-transparent group-hover:bg-indigo/20",
                  )}
                />
                <Icon
                  aria-hidden="true"
                  className="size-[18px]"
                  strokeWidth={current ? 2.2 : 1.8}
                />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

import { memberTabIcons } from "@/components/layout/member-nav";
import { memberTabs, type MemberTabKey } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Gabarit statique de la barre d'onglets, présenté dans /design-system avec ses cinq onglets.
 * L'espace membre utilise la version reliée à l'adresse : `MemberBottomBar` (member-nav.tsx).
 */
export function MemberTabBar({ active = "home" }: { active?: MemberTabKey }) {
  return (
    <div className="border-t border-trait bg-blanc pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {memberTabs.map((tab) => {
          const Icon = memberTabIcons[tab.key];
          const current = tab.key === active;
          return (
            <li key={tab.key}>
              <span
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-semibold",
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
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

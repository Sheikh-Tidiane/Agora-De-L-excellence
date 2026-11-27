import Link from "next/link";
import { cn } from "@/lib/utils";

/** Pastille de filtre (activité, année) : un lien, l'état choisi est annoncé par `aria-current`. */
export function FilterChip({
  active,
  to,
  children,
}: {
  active: boolean;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex h-11 items-center rounded-pastille border px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200",
        active
          ? "border-indigo bg-indigo text-ivoire"
          : "border-indigo/25 hover:border-indigo hover:bg-indigo/5",
      )}
    >
      {children}
    </Link>
  );
}

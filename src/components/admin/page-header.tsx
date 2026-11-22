import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** En-tête d'une page d'administration : titre en serif, phrase d'aide, actions à droite. */
export function AdminPageHeader({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 border-b border-indigo/20 pb-5 md:flex-row md:items-end md:justify-between lg:mb-8",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-serif text-[1.75rem] leading-tight lg:text-[2.25rem]">{title}</h1>
        {children ? <p className="mt-1.5 max-w-[46rem] text-gris">{children}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Squelette commun des pages de liste. */
export function AdminListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-9 w-64" />
      <div className="skeleton mt-3 h-5 w-96 max-w-full" />
      <div className="skeleton mt-10 h-10 w-full max-w-md" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="skeleton mt-3 h-11 w-full" />
      ))}
    </div>
  );
}

/** Pastille de statut. */
export function StatusPill({
  tone,
  children,
}: {
  tone: "neutre" | "succes" | "alerte" | "erreur" | "accent";
  children: ReactNode;
}) {
  const tones = {
    neutre: "bg-sable text-indigo",
    accent: "bg-indigo text-ivoire",
    succes: "bg-succes-fond text-succes",
    alerte: "bg-alerte-fond text-alerte",
    erreur: "bg-erreur-fond text-erreur",
  };
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-pastille px-2.5 text-[0.8125rem] font-semibold whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

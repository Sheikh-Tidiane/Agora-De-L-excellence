import type { ReactNode } from "react";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { cn } from "@/lib/utils";

const rangsVides = gradins(["var(--color-trait)", "var(--color-trait)", "var(--color-sable)"], {
  inner: 34,
  step: 14,
});

/** État vide : des gradins sans public, un titre, une phrase, une action éventuelle. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start py-10", className)}>
      <div className="w-40">
        <Hemicycle rows={rangsVides} overshoot={0} />
      </div>
      <h2 className="titre-3 mt-6">{title}</h2>
      {children ? <p className="mt-2 max-w-[28rem] text-gris">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/** État d'erreur : dit ce qui s'est passé et propose de réessayer. */
export function ErrorState({
  title = "Quelque chose s’est mal passé",
  children,
  action,
  className,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("rounded-champ border-l-4 border-erreur bg-erreur-fond p-5", className)}
    >
      <h3 className="font-sans text-base font-bold text-erreur">{title}</h3>
      {children ? <p className="mt-1">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Attente longue : trois tuiles qui se retournent l'une après l'autre. */
export function TileLoader({ label = "Chargement" }: { label?: string }) {
  return (
    <div role="status" className="inline-flex items-center gap-1.5 [perspective:400px]">
      {["•", "•", "•"].map((_, i) => (
        <span
          key={i}
          className="animate-[retournement_1.5s_ease-in-out_infinite]"
          style={{ animationDelay: `${i * 160}ms` }}
        >
          <LetterTile
            letter=""
            value={null}
            tone={i === 1 ? "terracotta" : "indigo"}
            className="text-[22px]"
          />
        </span>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Squelette d'une carte livre, aux mêmes proportions que la vraie. */
export function BookCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={className}>
      <div className="skeleton aspect-[2/3] w-full rounded-couverture!" />
      <div className="skeleton mt-4 h-3 w-2/5" />
      <div className="skeleton mt-2.5 h-5 w-4/5" />
      <div className="skeleton mt-2 h-4 w-3/5" />
    </div>
  );
}

/** Squelette d'une ligne d'agenda. */
export function EventRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[64px_1fr] gap-x-4 border-t border-indigo/20 py-6"
    >
      <div className="skeleton h-14 w-12" />
      <div>
        <div className="skeleton h-6 w-24 rounded-full!" />
        <div className="skeleton mt-3 h-6 w-4/5" />
        <div className="skeleton mt-2 h-4 w-3/5" />
      </div>
    </div>
  );
}

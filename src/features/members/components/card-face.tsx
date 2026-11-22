import type { ReactNode } from "react";
import Image from "next/image";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

const rangs = gradins(
  [
    "rgb(247 244 237 / 0.07)",
    "rgb(247 244 237 / 0.07)",
    "rgb(224 138 95 / 0.22)",
    "rgb(194 86 46 / 0.3)",
  ],
  { inner: 40, step: 14 },
);

/**
 * Recto de la carte de membre : au format d'une carte bancaire (ID-1), indigo, gradins en filigrane
 * qui débordent du coin, symbole du club, nom, numéro. `children` reçoit le QR sur la page de la carte.
 */
export function CardFace({
  fullName,
  memberNumber,
  status,
  children,
  className,
}: {
  fullName: string;
  memberNumber: string | null;
  /** Mention d'état (« Carte réglée », « Carte à régler »). */
  status: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[1.586] w-full flex-col overflow-hidden rounded-[18px] bg-indigo p-5 text-ivoire sm:p-6",
        className,
      )}
    >
      <div aria-hidden="true" className="absolute -right-[18%] -bottom-[38%] -z-10 w-[78%]">
        <Hemicycle rows={rangs} overshoot={20} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Image src="/logos/symbole-inverse.svg" alt="" width={34} height={34} unoptimized />
          <span className="font-serif text-[1.125rem] leading-none">{site.shortName}</span>
        </div>
        <p className="text-right text-[0.625rem] font-bold tracking-[0.18em] text-terracotta-clair uppercase">
          Carte de membre
        </p>
      </div>
      <div className="mt-auto flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-serif text-[1.375rem] leading-tight break-words sm:text-[1.625rem]">
            {fullName}
          </p>
          <p className="mt-1.5 font-sans text-[0.8125rem] font-semibold tracking-[0.14em] text-terracotta-clair tabular-nums">
            {memberNumber ?? "Numéro à venir"}
          </p>
          <div className="mt-3">{status}</div>
        </div>
        {children}
      </div>
    </div>
  );
}

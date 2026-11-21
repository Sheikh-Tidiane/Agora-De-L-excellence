import type { ReactNode } from "react";
import { LetterTile } from "@/components/shared/letter-tile";

/** Lien d'activation ou de réinitialisation expiré, déjà utilisé ou incomplet. */
export function InvalidLink({
  title = "Ce lien a fait son temps.",
  children,
  action,
}: {
  title?: string;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <div>
      <div className="flex gap-1.5" aria-hidden="true">
        <LetterTile letter="F" tone="indigo" className="text-[44px]" />
        <LetterTile letter="I" tone="indigo" className="text-[44px]" />
        <LetterTile letter="N" tone="terracotta" className="text-[44px]" />
      </div>
      <p className="surtitre mt-8">Lien expiré</p>
      <h1 className="titre-1 mt-3">{title}</h1>
      <p className="mt-4 text-[1.0625rem] text-gris">{children}</p>
      <div className="mt-8">{action}</div>
    </div>
  );
}

/** Squelette affiché pendant la vérification du lien. */
export function PasswordFormSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="skeleton h-3 w-28" />
      <div className="skeleton mt-4 h-10 w-4/5" />
      <div className="skeleton mt-5 h-5 w-full" />
      <div className="skeleton mt-10 h-4 w-32" />
      <div className="skeleton mt-2 h-12 w-full rounded-champ!" />
      <div className="skeleton mt-6 h-4 w-32" />
      <div className="skeleton mt-2 h-12 w-full rounded-champ!" />
      <div className="skeleton mt-6 h-14 w-full rounded-champ!" />
    </div>
  );
}

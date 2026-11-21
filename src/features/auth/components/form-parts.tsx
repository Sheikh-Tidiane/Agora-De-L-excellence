import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/** En-tête commun des pages de compte : surtitre, grand titre, chapô facultatif. */
export function AuthHeading({
  surtitre,
  title,
  children,
}: {
  surtitre: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div>
      <p className="surtitre">{surtitre}</p>
      <h1 className="titre-1 mt-3">{title}</h1>
      {children ? <p className="mt-4 text-[1.0625rem] text-gris">{children}</p> : null}
    </div>
  );
}

/** Message d'erreur global d'un formulaire (identifiants refusés, limite atteinte…). */
export function FormError({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        "rounded-champ border-l-4 border-erreur bg-erreur-fond px-4 py-3 text-[0.9375rem] font-semibold text-erreur",
        className,
      )}
    >
      {message}
    </p>
  );
}

/** Confirmation discrète (compte activé, mot de passe enregistré…). */
export function FormNotice({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p
      role="status"
      className={cn(
        "flex gap-2.5 rounded-champ bg-succes-fond px-4 py-3 text-[0.9375rem] font-semibold text-succes",
        className,
      )}
    >
      <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

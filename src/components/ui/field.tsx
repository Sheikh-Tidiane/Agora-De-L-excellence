import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Champs de formulaire du club (base shadcn/ui réhabillée).
 * Libellé toujours visible, 48 px de haut, erreur sous le champ concerné.
 */
const base = [
  "w-full rounded-champ border border-indigo/25 bg-blanc px-4 text-base text-indigo",
  "placeholder:text-gris/80",
  "transition-[border-color,box-shadow] duration-200",
  "hover:border-indigo/50",
  "focus-visible:border-indigo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo/20",
  "aria-invalid:border-erreur aria-invalid:ring-erreur/20",
  "disabled:cursor-not-allowed disabled:bg-sable disabled:text-gris",
];

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, "h-12", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, "min-h-28 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        base,
        // Chevron et fond blanc : classe `champ-select` (globals.css). Une image de fond en classe
        // arbitraire Tailwind ne produisait aucune règle et faisait retirer le fond blanc.
        "champ-select h-12 appearance-none pr-11",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

type FieldProps = {
  /** Identifiant du champ : relie le libellé, l'aide et l'erreur. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Enveloppe d'un champ. Le champ enfant doit recevoir `id`, et
 * `aria-describedby={`${id}-aide ${id}-erreur`}` ainsi que `aria-invalid` en cas d'erreur.
 */
export function Field({ id, label, hint, error, optional, children, className }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[0.9375rem] font-semibold">
        {label}
        {optional ? <span className="font-normal text-gris"> (facultatif)</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-aide`} className="petit mt-1.5 text-gris">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-erreur`} className="petit mt-1.5 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

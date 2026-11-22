"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field, Input } from "@/components/ui/field";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Lien affiché à droite du libellé (« Mot de passe oublié ? »). */
  aside?: ReactNode;
};

/** Champ mot de passe avec bascule afficher/masquer (cible tactile de 44 px). */
export function PasswordField({ id, label, hint, error, aside, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {aside ? <div className="absolute top-0 right-0 z-10">{aside}</div> : null}
      <Field id={id} label={label} hint={hint} error={error}>
        <div className="relative">
          <Input
            id={id}
            type={visible ? "text" : "password"}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-erreur` : hint ? `${id}-aide` : undefined}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="pr-13"
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute top-0.5 right-0.5 grid size-11 place-items-center rounded-[8px] text-gris transition-colors duration-200 hover:text-indigo"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-5" />
            ) : (
              <Eye aria-hidden="true" className="size-5" />
            )}
          </button>
        </div>
      </Field>
    </div>
  );
}

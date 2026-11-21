"use client";

import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * Champs reliés à React Hook Form : libellé visible, aide, erreur sous le champ,
 * attributs ARIA posés une fois pour toutes.
 */
type Common<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  /** Préfixe d'identifiant, quand deux formulaires partagent la même page. */
  idPrefix?: string;
};

function wiring<T extends FieldValues>({ form, name, hint, idPrefix }: Common<T>) {
  const id = `${idPrefix ?? "champ"}-${name}`;
  const error = form.formState.errors[name]?.message as string | undefined;
  return {
    id,
    error,
    aria: {
      id,
      "aria-invalid": error ? (true as const) : undefined,
      "aria-describedby": error ? `${id}-erreur` : hint ? `${id}-aide` : undefined,
    },
  };
}

export function TextField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  optional,
  className,
  idPrefix,
  ...input
}: Common<T> & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "form" | "id">) {
  const { id, error, aria } = wiring({ form, name, label, hint, idPrefix });
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <Input {...aria} {...input} {...form.register(name)} />
    </Field>
  );
}

export function TextareaField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  optional,
  className,
  idPrefix,
  inputClassName,
  ...input
}: Common<T> & { inputClassName?: string } & Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    "name" | "form" | "id" | "className"
  >) {
  const { id, error, aria } = wiring({ form, name, label, hint, idPrefix });
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <Textarea {...aria} {...input} className={inputClassName} {...form.register(name)} />
    </Field>
  );
}

export function SelectField<T extends FieldValues>({
  form,
  name,
  label,
  hint,
  optional,
  className,
  idPrefix,
  placeholder,
  options,
}: Common<T> & {
  /** Première option vide, par exemple « Choisir… ». */
  placeholder?: string;
  options: readonly { value: string; label: string }[];
}) {
  const { id, error, aria } = wiring({ form, name, label, hint, idPrefix });
  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      className={className}
    >
      <Select {...aria} {...form.register(name)}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}

const box =
  "mt-0.5 size-5 shrink-0 rounded-[5px] border border-indigo/40 accent-indigo focus-visible:outline-2 focus-visible:outline-offset-2";

/** Case à cocher : toute la ligne est cliquable, 44 px de haut au minimum. */
export function CheckboxField<T extends FieldValues>({
  form,
  name,
  children,
  value,
  className,
  idPrefix,
}: Pick<Common<T>, "form" | "name" | "className" | "idPrefix"> & {
  children: ReactNode;
  /** Pour un groupe de cases partageant le même nom (tableau de valeurs). */
  value?: string;
}) {
  const id = `${idPrefix ?? "champ"}-${name}${value ? `-${value}` : ""}`;
  const error = value ? undefined : (form.formState.errors[name]?.message as string | undefined);
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
        <input
          id={id}
          type="checkbox"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-erreur` : undefined}
          className={box}
          {...form.register(name)}
        />
        <span className="text-[0.9375rem] leading-snug">{children}</span>
      </label>
      {error ? (
        <p id={`${id}-erreur`} className={cn("petit font-semibold text-erreur")}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

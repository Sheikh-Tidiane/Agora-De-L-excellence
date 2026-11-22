"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";
import type { ActionResult } from "@/lib/errors";

type Options<TIn extends FieldValues, TOut, R> = {
  /** Le même schéma Zod que celui de la Server Action. */
  schema: z.ZodType<TOut, TIn>;
  defaultValues: DefaultValues<TIn>;
  action: (input: TIn) => Promise<ActionResult<R>>;
  onSuccess?: (data: R, values: TIn) => void;
};

export type ActionForm<TIn extends FieldValues, R = unknown> = {
  form: UseFormReturn<TIn>;
  pending: boolean;
  /** Erreur globale renvoyée par le serveur (limite de débit, conflit…). */
  formError: string | undefined;
  /** Résultat du dernier envoi réussi. */
  result: { data: R } | undefined;
  submit: (event?: React.BaseSyntheticEvent) => void;
  reset: () => void;
};

/**
 * Formulaire relié à une Server Action : validation Zod côté client (React Hook Form),
 * puis côté serveur ; les erreurs du serveur reviennent sous le champ concerné.
 */
export function useActionForm<TIn extends FieldValues, TOut, R = undefined>({
  schema,
  defaultValues,
  action,
  onSuccess,
}: Options<TIn, TOut, R>): ActionForm<TIn, R> {
  const form = useForm<TIn>({
    // Le formulaire garde les valeurs saisies ; c'est le serveur qui transforme et fait foi.
    resolver: zodResolver(schema as never) as unknown as Resolver<TIn>,
    defaultValues,
  });
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [result, setResult] = useState<{ data: R }>();

  const submit = (event?: React.BaseSyntheticEvent) => {
    void form.handleSubmit(() => {
      setFormError(undefined);
      const values = form.getValues();
      startTransition(async () => {
        const response = await action(values);
        if (response.ok) {
          setResult({ data: response.data });
          onSuccess?.(response.data, values);
          return;
        }
        let placed = false;
        // Erreurs du serveur sur un champ qui n'est pas à l'écran (champ conditionnel, valeur
        // cachée) : sans cela, le formulaire resterait muet. Elles remontent en tête de formulaire.
        const orphans: string[] = [];
        for (const [name, message] of Object.entries(response.fieldErrors ?? {})) {
          if (name in values && document.getElementsByName(name).length > 0) {
            form.setError(name as Path<TIn>, { message });
            placed = true;
          } else {
            orphans.push(message);
          }
        }
        if (response.code !== "VALIDATION" || !placed || orphans.length > 0) {
          setFormError(orphans[0] ?? response.message);
        }
      });
    })(event);
  };

  return {
    form,
    pending,
    formError,
    result,
    submit,
    reset: () => {
      setResult(undefined);
      setFormError(undefined);
      form.reset();
    },
  };
}

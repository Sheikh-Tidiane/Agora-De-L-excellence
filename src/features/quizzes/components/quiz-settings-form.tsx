"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createQuizAction, updateQuizAction } from "@/features/quizzes/actions";
import { quizSettingsSchema, type QuizSettingsInput } from "@/features/quizzes/schemas";
import { zodFieldErrors } from "@/lib/errors";

export type QuizSettingsValues = Required<Omit<QuizSettingsInput, "quizId">> & {
  durationMinutes: number | string;
};

const describedBy = (id: string) => `${id}-aide ${id}-erreur`;

/**
 * Réglages d'un quiz : création (puis passage à la fiche) ou modification. Les mêmes règles Zod
 * qu'au serveur s'appliquent avant l'envoi ; ce qui est figé après publication est grisé.
 */
export function QuizSettingsForm({
  quizId,
  initial,
  events,
  locked,
}: {
  quizId?: string;
  initial: QuizSettingsValues;
  events: { id: string; title: string; when: string }[];
  /** Après publication : durée, ouverture et adresse ne bougent plus. */
  locked?: { duration: boolean; opensAt: boolean; slug: boolean; closesAt: boolean };
}) {
  const router = useRouter();
  const { run, pending, toast } = useAdminAction();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof QuizSettingsValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = { ...values, durationMinutes: Number(values.durationMinutes) };
    const parsed = quizSettingsSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (quizId) {
      await run(() => updateQuizAction({ ...input, quizId }), {
        success: "Réglages enregistrés.",
      });
    } else {
      await run(() => createQuizAction(input), {
        success: "Quiz créé en brouillon.",
        onSuccess: (data) => router.push(`/admin/quizzes/${data.id}`),
      });
    }
  };

  const field = (id: keyof QuizSettingsValues) => ({
    id: `quiz-${id}`,
    "aria-describedby": describedBy(`quiz-${id}`),
    "aria-invalid": errors[id] ? true : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field id="quiz-title" label="Titre" error={errors.title}>
        <Input
          {...field("title")}
          value={values.title}
          onChange={(e) => set("title")(e.target.value)}
          maxLength={120}
          required
        />
      </Field>
      <Field
        id="quiz-instructions"
        label="Consigne"
        optional
        hint="Affichée avant de commencer : thème, règle du jeu, ton."
        error={errors.instructions}
      >
        <Textarea
          {...field("instructions")}
          value={values.instructions ?? ""}
          onChange={(e) => set("instructions")(e.target.value)}
          rows={3}
          maxLength={1000}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          id="quiz-durationMinutes"
          label="Durée (minutes)"
          hint="De 1 à 180."
          error={errors.durationMinutes}
        >
          <Input
            {...field("durationMinutes")}
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={values.durationMinutes}
            onChange={(e) => set("durationMinutes")(e.target.value)}
            disabled={locked?.duration}
          />
        </Field>
        <Field id="quiz-opensAt" label="Ouverture" error={errors.opensAt}>
          <Input
            {...field("opensAt")}
            type="datetime-local"
            value={values.opensAt}
            onChange={(e) => set("opensAt")(e.target.value)}
            disabled={locked?.opensAt}
          />
        </Field>
        <Field id="quiz-closesAt" label="Fermeture" error={errors.closesAt}>
          <Input
            {...field("closesAt")}
            type="datetime-local"
            value={values.closesAt}
            onChange={(e) => set("closesAt")(e.target.value)}
            disabled={locked?.closesAt}
          />
        </Field>
      </div>
      <Field id="quiz-eventId" label="Rencontre « Génies du soir »" optional error={errors.eventId}>
        <Select
          {...field("eventId")}
          value={values.eventId ?? ""}
          onChange={(e) => set("eventId")(e.target.value)}
        >
          <option value="">Aucune</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {item.when}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        id="quiz-slug"
        label="Adresse"
        optional
        hint="Vide : tirée du titre. Minuscules, chiffres et tirets."
        error={errors.slug}
      >
        <Input
          {...field("slug")}
          value={values.slug ?? ""}
          onChange={(e) => set("slug")(e.target.value)}
          disabled={locked?.slug}
          spellCheck={false}
          autoCapitalize="none"
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : quizId ? "Enregistrer les réglages" : "Créer le quiz"}
      </Button>
      {toast}
    </form>
  );
}

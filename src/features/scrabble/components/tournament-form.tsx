"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { createTournamentAction, updateTournamentAction } from "@/features/scrabble/actions";
import { formatLabels, modeLabels, ruleLabels } from "@/features/scrabble/components/labels";
import { tournamentSchema } from "@/features/scrabble/schemas";
import { zodFieldErrors } from "@/lib/errors";

export type TournamentFormValues = {
  name: string;
  description: string;
  rules: string;
  format: "INDIVIDUAL" | "TEAMS";
  gameMode: "DUPLICATE" | "CLASSIC";
  rankingRule: "WINS_SCORE_SPREAD" | "CUMULATIVE_SCORE";
  isInterclub: boolean;
  countsForMonthly: boolean;
  location: string;
  reward: string;
  startsAt: string;
  endsAt: string;
  eventId: string;
};

const aria = (id: string, error?: string) => ({
  id,
  "aria-describedby": `${id}-aide ${id}-erreur`,
  "aria-invalid": error ? true : undefined,
});

/**
 * Réglages d'un tournoi. Le classement suit le mode de jeu par défaut (duplicate : cumul ;
 * classique : victoires), mais reste modifiable : la règle choisie est affichée aux joueurs.
 */
export function TournamentForm({
  tournamentId,
  initial,
  events,
  locked,
}: {
  tournamentId?: string;
  initial: TournamentFormValues;
  events: { id: string; label: string }[];
  /** Formule figée dès qu'il existe des manches. */
  locked?: boolean;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAdminAction();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof TournamentFormValues>(key: K, value: TournamentFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const input = { ...values, endsAt: values.endsAt || null, eventId: values.eventId || null };
    const parsed = tournamentSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    if (tournamentId) {
      await run(() => updateTournamentAction({ id: tournamentId, ...input }), {
        success: "Réglages enregistrés.",
        onSuccess: () => router.push(`/admin/scrabble/${tournamentId}`),
      });
    } else {
      await run(() => createTournamentAction(input), {
        success: "Tournoi créé en brouillon.",
        onSuccess: (data) => router.push(`/admin/scrabble/${data.id}`),
      });
    }
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-[48rem] space-y-6">
      <Field id="t-name" label="Nom du tournoi" error={errors.name}>
        <Input
          {...aria("t-name", errors.name)}
          value={values.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={120}
        />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="t-startsAt" label="Début" error={errors.startsAt}>
          <Input
            {...aria("t-startsAt", errors.startsAt)}
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => set("startsAt", e.target.value)}
          />
        </Field>
        <Field id="t-endsAt" label="Fin" optional error={errors.endsAt}>
          <Input
            {...aria("t-endsAt", errors.endsAt)}
            type="datetime-local"
            value={values.endsAt}
            onChange={(e) => set("endsAt", e.target.value)}
          />
        </Field>
      </div>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={locked}>
        <legend className="sr-only">Formule</legend>
        <Field
          id="t-format"
          label="Format"
          hint={locked ? "Figé : des manches existent." : undefined}
        >
          <Select
            {...aria("t-format")}
            value={values.format}
            onChange={(e) => set("format", e.target.value as TournamentFormValues["format"])}
          >
            {Object.entries(formatLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="t-gameMode" label="Mode de jeu">
          <Select
            {...aria("t-gameMode")}
            value={values.gameMode}
            onChange={(e) => {
              const gameMode = e.target.value as TournamentFormValues["gameMode"];
              setValues((current) => ({
                ...current,
                gameMode,
                rankingRule: gameMode === "DUPLICATE" ? "CUMULATIVE_SCORE" : "WINS_SCORE_SPREAD",
              }));
            }}
          >
            {Object.entries(modeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="t-rankingRule" label="Règle de classement" className="sm:col-span-2">
          <Select
            {...aria("t-rankingRule")}
            value={values.rankingRule}
            onChange={(e) =>
              set("rankingRule", e.target.value as TournamentFormValues["rankingRule"])
            }
          >
            {Object.entries(ruleLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <div className="space-y-2">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={values.countsForMonthly}
            onChange={(e) => set("countsForMonthly", e.target.checked)}
            className="size-5 accent-indigo"
          />
          Compte dans le classement mensuel
        </label>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={values.isInterclub}
            onChange={(e) => set("isInterclub", e.target.checked)}
            className="size-5 accent-indigo"
          />
          Rencontre interclubs
        </label>
      </div>

      <Field id="t-location" label="Lieu" optional error={errors.location}>
        <Input
          {...aria("t-location", errors.location)}
          value={values.location}
          onChange={(e) => set("location", e.target.value)}
          maxLength={160}
        />
      </Field>
      <Field
        id="t-eventId"
        label="Rencontre liée"
        optional
        hint="Inscrire un membre au tournoi l’inscrit aussi à cette rencontre."
      >
        <Select
          {...aria("t-eventId")}
          value={values.eventId}
          onChange={(e) => set("eventId", e.target.value)}
        >
          <option value="">Aucune</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="t-description" label="Présentation" optional error={errors.description}>
        <Textarea
          {...aria("t-description", errors.description)}
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={2000}
        />
      </Field>
      <Field
        id="t-rules"
        label="Règlement"
        optional
        hint="Affiché aux participants sur la page du tournoi."
        error={errors.rules}
      >
        <Textarea
          {...aria("t-rules", errors.rules)}
          value={values.rules}
          onChange={(e) => set("rules", e.target.value)}
          rows={4}
          maxLength={5000}
        />
      </Field>
      <Field
        id="t-reward"
        label="Récompense"
        optional
        hint="Rien n’est affiché tant que ce champ est vide."
        error={errors.reward}
      >
        <Input
          {...aria("t-reward", errors.reward)}
          value={values.reward}
          onChange={(e) => set("reward", e.target.value)}
          maxLength={300}
        />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Enregistrement…" : tournamentId ? "Enregistrer" : "Créer le tournoi"}
      </Button>
      {toast}
    </form>
  );
}

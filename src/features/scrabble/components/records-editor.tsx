"use client";

import { useState } from "react";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  createRecordAction,
  deleteRecordAction,
  replaceRecordAction,
} from "@/features/scrabble/actions";
import { recordSchema } from "@/features/scrabble/schemas";
import { formatShortDate } from "@/lib/dates";
import { zodFieldErrors } from "@/lib/errors";

export type AdminRecordRow = {
  id: string;
  category: string;
  value: string;
  holder: string;
  tournamentName: string | null;
  achievedAt: Date | null;
  supersededAt: Date | null;
};

type Values = {
  category: string;
  value: string;
  holderName: string;
  tournamentId: string;
  achievedAt: string;
};
const blank: Values = { category: "", value: "", holderName: "", tournamentId: "", achievedAt: "" };

function RecordForm({
  initial,
  tournaments,
  submitLabel,
  onSubmit,
  pending,
  onCancel,
}: {
  initial: Values;
  tournaments: { id: string; name: string }[];
  submitLabel: string;
  pending: boolean;
  onSubmit: (input: ReturnType<typeof toInput>) => Promise<boolean>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof Values) => (e: { target: { value: string } }) =>
    setValues({ ...values, [key]: e.target.value });
  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const input = toInput(values);
        const parsed = recordSchema.safeParse(input);
        if (!parsed.success) return setErrors(zodFieldErrors(parsed.error));
        setErrors({});
        // Vidé tout de suite (ajout), rétabli si le serveur refuse.
        const typed = values;
        if (!onCancel) setValues(blank);
        if (!(await onSubmit(input)) && !onCancel) setValues(typed);
      }}
    >
      <Field
        id="r-category"
        label="Record"
        hint="Par exemple « Meilleur score sur une partie »."
        error={errors.category}
      >
        <Input id="r-category" value={values.category} onChange={set("category")} maxLength={100} />
      </Field>
      <Field id="r-value" label="Valeur" hint="« 512 points », « OXYDANTS »…" error={errors.value}>
        <Input id="r-value" value={values.value} onChange={set("value")} maxLength={60} />
      </Field>
      <Field id="r-holder" label="Détenteur" error={errors.holderName}>
        <Input
          id="r-holder"
          value={values.holderName}
          onChange={set("holderName")}
          maxLength={80}
        />
      </Field>
      <Field id="r-date" label="Date" optional error={errors.achievedAt}>
        <Input id="r-date" type="date" value={values.achievedAt} onChange={set("achievedAt")} />
      </Field>
      <Field id="r-tournament" label="Tournoi" optional className="sm:col-span-2">
        <Select id="r-tournament" value={values.tournamentId} onChange={set("tournamentId")}>
          <option value="">Aucun</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="contour" onClick={onCancel}>
            Annuler
          </Button>
        ) : null}
      </div>
    </form>
  );
}

const toInput = (values: Values) => ({
  category: values.category,
  value: values.value,
  holderName: values.holderName,
  userId: null,
  tournamentId: values.tournamentId || null,
  achievedAt: values.achievedAt || null,
});

/**
 * Records du club. Rien n'est public tant que la liste est vide. Battre un record le remplace :
 * l'ancien reste dans l'historique, marqué « battu ».
 */
export function RecordsEditor({
  records,
  tournaments,
}: {
  records: AdminRecordRow[];
  tournaments: { id: string; name: string }[];
}) {
  const { run, pending, toast } = useAdminAction();
  const [replacing, setReplacing] = useState<string>();
  const current = records.filter((r) => !r.supersededAt);
  const beaten = records.filter((r) => r.supersededAt);

  return (
    <div className="grid gap-12 xl:grid-cols-12">
      <section aria-labelledby="records-titre" className="xl:col-span-7">
        <h2 id="records-titre" className="titre-3">
          Records en cours
        </h2>
        {current.length === 0 ? (
          <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
            Aucun record : le comité ne les a pas encore définis. La rubrique reste invisible du
            public tant qu’elle est vide.
          </p>
        ) : (
          <ul className="mt-4 border-b border-indigo/20">
            {current.map((record) => (
              <li key={record.id} className="border-t border-indigo/20 py-4">
                {replacing === record.id ? (
                  <RecordForm
                    initial={{ ...blank, category: record.category }}
                    tournaments={tournaments}
                    submitLabel="Enregistrer le nouveau record"
                    pending={pending}
                    onCancel={() => setReplacing(undefined)}
                    onSubmit={(input) =>
                      run(() => replaceRecordAction({ id: record.id, record: input }), {
                        success: "Record battu : l’ancien passe dans l’historique.",
                        onSuccess: () => setReplacing(undefined),
                      })
                    }
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="petit font-semibold text-gris">{record.category}</p>
                      <p className="font-serif text-xl">{record.value}</p>
                      <p className="petit text-gris">
                        {record.holder}
                        {record.tournamentName ? ` · ${record.tournamentName}` : ""}
                        {record.achievedAt ? ` · ${formatShortDate(record.achievedAt)}` : ""}
                      </p>
                    </div>
                    <Button size="sm" variant="contour" onClick={() => setReplacing(record.id)}>
                      Record battu
                    </Button>
                    <Button
                      size="sm"
                      variant="discret"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm("Supprimer ce record (saisie erronée) ?")) return;
                        void run(() => deleteRecordAction({ id: record.id }), {
                          success: "Record supprimé.",
                        });
                      }}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {beaten.length > 0 ? (
          <>
            <h3 className="mt-10 font-serif text-xl">Historique</h3>
            <ul className="mt-3 border-b border-indigo/20">
              {beaten.map((record) => (
                <li
                  key={record.id}
                  className="flex items-center gap-3 border-t border-indigo/20 py-3 text-gris"
                >
                  <span className="min-w-0 flex-1">
                    {record.category} · {record.value} · {record.holder}
                  </span>
                  <StatusPill tone="neutre">Battu</StatusPill>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
      <section
        aria-labelledby="nouveau-record"
        className="rounded-[16px] bg-blanc p-5 lg:p-6 xl:col-span-5"
      >
        <h2 id="nouveau-record" className="font-serif text-xl">
          Nouveau record
        </h2>
        <div className="mt-4">
          <RecordForm
            initial={blank}
            tournaments={tournaments}
            submitLabel="Ajouter le record"
            pending={pending}
            onSubmit={(input) =>
              run(() => createRecordAction(input), { success: "Record ajouté." })
            }
          />
        </div>
      </section>
      {toast}
    </div>
  );
}

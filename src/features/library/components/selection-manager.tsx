"use client";

import { useAdminAction } from "@/components/admin/use-admin-action";
import { SelectField, TextField, TextareaField } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { deleteSelectionAction, saveSelectionAction } from "@/features/library/actions";
import { selectionSchema } from "@/features/library/schemas";
import { formatMonthYear } from "@/lib/dates";

export type SelectionRow = {
  id: string;
  month: Date;
  /** Valeur du champ mois : AAAA-MM. */
  monthValue: string;
  bookId: string;
  bookTitle: string;
  eventId: string | null;
  eventTitle: string | null;
  note: string | null;
  current: boolean;
};

type Option = { value: string; label: string };

/** Livre du mois : une sélection par mois, liée ou non à une rencontre. */
export function SelectionManager({
  rows,
  books,
  events,
  defaultMonth,
}: {
  rows: SelectionRow[];
  books: Option[];
  events: Option[];
  defaultMonth: string;
}) {
  const { run, pending, toast } = useAdminAction();
  const {
    form,
    pending: saving,
    formError,
    submit,
  } = useActionForm({
    schema: selectionSchema,
    defaultValues: { month: defaultMonth, bookId: "", eventId: "", note: "" },
    action: saveSelectionAction,
    onSuccess: () => {
      form.reset({ month: form.getValues("month"), bookId: "", eventId: "", note: "" });
      void run(async () => ({ ok: true as const, data: undefined }), {
        success: "Livre du mois enregistré. Il paraît sur l’accueil.",
      });
    },
  });

  const edit = (row: SelectionRow) => {
    form.reset({
      month: row.monthValue,
      bookId: row.bookId,
      eventId: row.eventId ?? "",
      note: row.note ?? "",
    });
    document.getElementById("selection-form")?.scrollIntoView({ block: "start" });
  };

  return (
    <div className="grid gap-x-14 gap-y-12 xl:grid-cols-12">
      <form
        id="selection-form"
        onSubmit={submit}
        noValidate
        className="flex scroll-mt-24 flex-col gap-5 xl:col-span-5"
      >
        <h2 className="titre-3">Choisir le livre d’un mois</h2>
        <FormError message={formError} />
        <TextField
          form={form}
          name="month"
          idPrefix="sel"
          label="Mois"
          type="month"
          hint="Enregistrer un mois déjà choisi remplace sa sélection."
        />
        <SelectField
          form={form}
          name="bookId"
          idPrefix="sel"
          label="Livre"
          placeholder="Choisir un livre du catalogue…"
          options={books}
        />
        <SelectField
          form={form}
          name="eventId"
          idPrefix="sel"
          label="Rencontre associée"
          optional
          placeholder="Aucune"
          options={events}
        />
        <TextareaField
          form={form}
          name="note"
          idPrefix="sel"
          label="Pourquoi ce livre"
          optional
          rows={4}
          hint="Affiché sur l’accueil à la place du résumé."
        />
        <div>
          <Button type="submit" disabled={saving || books.length === 0}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>
      </form>

      <section aria-labelledby="selections-titre" className="xl:col-span-7">
        <h2 id="selections-titre" className="titre-3">
          Sélections
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="Aucun livre du mois">
            Tant qu’aucun mois n’est renseigné, l’accueil du site n’affiche pas de livre du mois.
          </EmptyState>
        ) : (
          <ul className="mt-4 border-t border-indigo/30">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 border-b border-trait py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="surtitre">
                    {formatMonthYear(row.month)}
                    {row.current ? " · en cours" : ""}
                  </p>
                  <p className="mt-1 font-serif text-lg leading-snug">{row.bookTitle}</p>
                  {row.eventTitle ? (
                    <p className="petit text-gris">Rencontre : {row.eventTitle}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="contour" size="sm" onClick={() => edit(row)}>
                    Modifier
                  </Button>
                  <Button
                    variant="discret"
                    size="sm"
                    className="text-erreur hover:bg-erreur-fond"
                    disabled={pending}
                    onClick={() =>
                      void run(() => deleteSelectionAction({ id: row.id }), {
                        success: "Sélection retirée.",
                      })
                    }
                  >
                    Retirer
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      {toast}
    </div>
  );
}

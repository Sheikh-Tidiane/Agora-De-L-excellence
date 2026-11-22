"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { TextField, TextareaField } from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import {
  deleteAuthorAction,
  deleteCategoryAction,
  saveAuthorAction,
  saveCategoryAction,
} from "@/features/library/actions";
import { authorSchema, categorySchema } from "@/features/library/schemas";
import type { ActionResult } from "@/lib/errors";

export type TaxonomyRow = { id: string; name: string; text: string | null; books: number };

type Kind = "category" | "author";

const copy = {
  category: {
    title: "Catégories",
    singular: "catégorie",
    add: "Nouvelle catégorie",
    textLabel: "Description",
    textHint: "Une phrase pour dire ce que l’on y range.",
    empty: "Aucune catégorie pour l’instant.",
  },
  author: {
    title: "Auteurs",
    singular: "auteur",
    add: "Nouvel auteur",
    textLabel: "Notice",
    textHint: "Quelques lignes rédigées pour le club, affichées sur les fiches de ses livres.",
    empty: "Aucun auteur pour l’instant. Ils se créent aussi depuis la fiche d’un livre.",
  },
} as const;

function ItemForm({
  kind,
  item,
  onSaved,
  onCancel,
}: {
  kind: Kind;
  item: TaxonomyRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const isCategory = kind === "category";
  const category = useActionForm({
    schema: categorySchema,
    defaultValues: { id: item?.id ?? "", name: item?.name ?? "", description: item?.text ?? "" },
    action: saveCategoryAction,
    onSuccess: onSaved,
  });
  const author = useActionForm({
    schema: authorSchema,
    defaultValues: { id: item?.id ?? "", name: item?.name ?? "", bio: item?.text ?? "" },
    action: saveAuthorAction,
    onSuccess: onSaved,
  });
  const active = isCategory ? category : author;

  return (
    <form onSubmit={active.submit} noValidate className="flex flex-col gap-5">
      <FormError message={active.formError} />
      {isCategory ? (
        <>
          <TextField
            form={category.form}
            name="name"
            idPrefix="cat"
            label="Nom"
            autoComplete="off"
          />
          <TextareaField
            form={category.form}
            name="description"
            idPrefix="cat"
            label={copy.category.textLabel}
            hint={copy.category.textHint}
            optional
            rows={3}
          />
        </>
      ) : (
        <>
          <TextField form={author.form} name="name" idPrefix="aut" label="Nom" autoComplete="off" />
          <TextareaField
            form={author.form}
            name="bio"
            idPrefix="aut"
            label={copy.author.textLabel}
            hint={copy.author.textHint}
            optional
            rows={6}
          />
        </>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={active.pending}>
          {active.pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="contour" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function Section({ kind, rows }: { kind: Kind; rows: TaxonomyRow[] }) {
  const text = copy[kind];
  const { run, pending, toast } = useAdminAction();
  const [editing, setEditing] = useState<TaxonomyRow | "new" | null>(null);
  const item = editing === "new" ? null : editing;
  const remove = (id: string): Promise<ActionResult> =>
    kind === "category" ? deleteCategoryAction({ id }) : deleteAuthorAction({ id });

  const columns: Column<TaxonomyRow>[] = [
    { key: "name", header: "Nom", cell: (row) => row.name, sort: (row) => row.name },
    {
      key: "books",
      header: "Livres",
      align: "right",
      cell: (row) => row.books,
      sort: (row) => row.books,
      className: "w-20",
    },
  ];

  return (
    <section aria-labelledby={`${kind}-titre`}>
      <h2 id={`${kind}-titre`} className="titre-3 mb-4">
        {text.title}
      </h2>
      <DataTable
        label={text.title}
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={kind === "author" ? (row) => row.name : undefined}
        searchPlaceholder="Nom…"
        defaultSort={kind === "author" ? { key: "name", direction: "asc" } : undefined}
        onOpen={(row) => setEditing(row)}
        actions={
          <Button
            size="sm"
            variant="contour"
            onClick={() => setEditing("new")}
            {...(kind === "category" ? { "data-shortcut-new": true } : {})}
          >
            <Plus aria-hidden="true" />
            {text.add}
          </Button>
        }
        card={(row) => (
          <span className="flex items-center justify-between gap-3">
            <span className="font-semibold">{row.name}</span>
            <span className="petit text-gris tabular-nums">
              {row.books} livre{row.books > 1 ? "s" : ""}
            </span>
          </span>
        )}
        empty={<EmptyState title={text.empty} />}
      />
      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        surtitre={text.title}
        title={item ? item.name : text.add}
      >
        {editing !== null ? (
          <>
            <ItemForm
              key={item?.id ?? "new"}
              kind={kind}
              item={item}
              onCancel={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                void run(async () => ({ ok: true as const, data: undefined }), {
                  success: "Enregistré.",
                });
              }}
            />
            {item ? (
              <div className="mt-8 border-t border-trait pt-5">
                <Button
                  variant="discret"
                  className="-ml-3 text-erreur hover:bg-erreur-fond"
                  disabled={pending || item.books > 0}
                  onClick={() =>
                    void run(() => remove(item.id), {
                      success: "Supprimé.",
                      onSuccess: () => setEditing(null),
                    })
                  }
                >
                  Supprimer cet{kind === "category" ? "te" : ""} {text.singular}
                </Button>
                {item.books > 0 ? (
                  <p className="petit mt-1 text-gris">
                    Suppression impossible tant que {item.books} livre
                    {item.books > 1 ? "s y sont" : " y est"} rattaché{item.books > 1 ? "s" : ""}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </SidePanel>
      {toast}
    </section>
  );
}

/** Catégories et auteurs : deux listes côte à côte sur desktop, l'une sous l'autre sur mobile. */
export function TaxonomyManager({
  categories,
  authors,
}: {
  categories: TaxonomyRow[];
  authors: TaxonomyRow[];
}) {
  return (
    <div className="grid gap-x-14 gap-y-12 xl:grid-cols-2">
      <Section kind="category" rows={categories} />
      <Section kind="author" rows={authors} />
    </div>
  );
}

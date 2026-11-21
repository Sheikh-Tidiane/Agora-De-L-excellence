"use client";

import { useState } from "react";
import { useWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { SidePanel } from "@/components/admin/side-panel";
import { useAdminAction } from "@/components/admin/use-admin-action";
import {
  CheckboxField,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/shared/form-fields";
import { EmptyState } from "@/components/shared/states";
import { useActionForm } from "@/components/shared/use-action-form";
import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/components/form-parts";
import { saveBookAction, setBookArchivedAction } from "@/features/library/actions";
import { CoverUpload } from "@/features/library/components/cover-upload";
import { bookSchema, type BookInput } from "@/features/library/schemas";

export type BookRow = {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  authors: string;
  categoryId: string;
  categoryName: string;
  summary: string;
  clubNote: string | null;
  isClubFavorite: boolean;
  isPublished: boolean;
  archived: boolean;
  publisher: string | null;
  publishedYear: number | null;
  pageCount: number | null;
  isbn: string | null;
  language: string;
  coverImage: string | null;
};

type Option = { value: string; label: string };

const state = (row: BookRow) =>
  row.archived ? "archived" : row.isPublished ? "published" : "hidden";
const stateLabels = { published: "En ligne", hidden: "Masqué", archived: "Archivé" } as const;
const stateTones = { published: "succes", hidden: "alerte", archived: "neutre" } as const;

const State = ({ row }: { row: BookRow }) => (
  <StatusPill tone={stateTones[state(row)]}>{stateLabels[state(row)]}</StatusPill>
);

const columns: Column<BookRow>[] = [
  { key: "title", header: "Titre", cell: (row) => row.title, sort: (row) => row.title },
  { key: "authors", header: "Auteur", cell: (row) => row.authors, sort: (row) => row.authors },
  {
    key: "category",
    header: "Catégorie",
    cell: (row) => row.categoryName,
    sort: (row) => row.categoryName,
    className: "max-lg:hidden",
  },
  {
    key: "year",
    header: "Année",
    align: "right",
    cell: (row) => row.publishedYear ?? "—",
    sort: (row) => row.publishedYear,
    className: "max-xl:hidden",
  },
  {
    key: "favorite",
    header: "Coup de cœur",
    cell: (row) => (row.isClubFavorite ? "Oui" : "—"),
    sort: (row) => (row.isClubFavorite ? 0 : 1),
    className: "max-xl:hidden",
  },
  { key: "state", header: "État", cell: (row) => <State row={row} />, sort: (row) => state(row) },
];

const blank = (categoryId: string): BookInput => ({
  id: "",
  title: "",
  subtitle: "",
  authors: "",
  categoryId,
  summary: "",
  clubNote: "",
  isClubFavorite: false,
  isPublished: true,
  publisher: "",
  publishedYear: "",
  pageCount: "",
  isbn: "",
  language: "fr",
  coverImage: "",
});

const toInput = (row: BookRow): BookInput => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle ?? "",
  authors: row.authors,
  categoryId: row.categoryId,
  summary: row.summary,
  clubNote: row.clubNote ?? "",
  isClubFavorite: row.isClubFavorite,
  isPublished: row.isPublished,
  publisher: row.publisher ?? "",
  publishedYear: row.publishedYear ? String(row.publishedYear) : "",
  pageCount: row.pageCount ? String(row.pageCount) : "",
  isbn: row.isbn ?? "",
  language: (["fr", "en", "wo"].includes(row.language) ? row.language : "fr") as "fr",
  coverImage: row.coverImage ?? "",
});

function BookForm({
  initial,
  categories,
  authorNames,
  onSaved,
  onCancel,
}: {
  initial: BookInput;
  categories: Option[];
  authorNames: string[];
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const { form, pending, formError, submit } = useActionForm({
    schema: bookSchema,
    defaultValues: initial,
    action: saveBookAction,
    onSuccess: () => onSaved(initial.id ? "Fiche enregistrée." : "Livre ajouté au catalogue."),
  });
  const cover = useWatch({ control: form.control, name: "coverImage" });
  const previewTitle = useWatch({ control: form.control, name: "title" });
  const previewAuthors = useWatch({ control: form.control, name: "authors" });

  return (
    <form id="book-form" onSubmit={submit} noValidate className="flex flex-col gap-5">
      <FormError message={formError} />
      <TextField form={form} name="title" idPrefix="livre" label="Titre" autoComplete="off" />
      <TextField
        form={form}
        name="subtitle"
        idPrefix="livre"
        label="Sous-titre"
        optional
        autoComplete="off"
      />
      <TextField
        form={form}
        name="authors"
        idPrefix="livre"
        label="Auteur(s)"
        autoComplete="off"
        list="auteurs-connus"
        hint="Plusieurs auteurs : séparez-les par une virgule. Un auteur inconnu est créé."
      />
      <datalist id="auteurs-connus">
        {authorNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <SelectField
        form={form}
        name="categoryId"
        idPrefix="livre"
        label="Catégorie"
        placeholder="Choisir…"
        options={categories}
      />
      <TextareaField
        form={form}
        name="summary"
        idPrefix="livre"
        label="Résumé"
        rows={6}
        hint="Rédigé pour le club, avec ses mots. Jamais copié d’un éditeur ou d’un site."
      />
      <TextareaField
        form={form}
        name="clubNote"
        idPrefix="livre"
        label="Le mot du club"
        optional
        rows={2}
        hint="Une phrase qui donne envie. Affichée sous la couverture."
      />
      <CoverUpload
        value={cover ?? ""}
        onChange={(name) => form.setValue("coverImage", name, { shouldDirty: true })}
        preview={{ title: previewTitle ?? "", author: previewAuthors ?? "" }}
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          form={form}
          name="publishedYear"
          idPrefix="livre"
          label="Année de parution"
          optional
          inputMode="numeric"
          autoComplete="off"
        />
        <TextField
          form={form}
          name="pageCount"
          idPrefix="livre"
          label="Pages"
          optional
          inputMode="numeric"
          autoComplete="off"
        />
      </div>
      <TextField
        form={form}
        name="publisher"
        idPrefix="livre"
        label="Éditeur"
        optional
        autoComplete="off"
      />
      <div className="grid grid-cols-2 gap-4">
        <TextField
          form={form}
          name="isbn"
          idPrefix="livre"
          label="ISBN"
          optional
          inputMode="numeric"
          autoComplete="off"
        />
        <SelectField
          form={form}
          name="language"
          idPrefix="livre"
          label="Langue"
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "Anglais" },
            { value: "wo", label: "Wolof" },
          ]}
        />
      </div>
      <div className="border-t border-trait pt-2">
        <CheckboxField form={form} name="isClubFavorite" idPrefix="livre">
          Coup de cœur du club (mis en avant en tête du catalogue)
        </CheckboxField>
        <CheckboxField form={form} name="isPublished" idPrefix="livre">
          Visible sur le site public
        </CheckboxField>
      </div>
      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-trait bg-blanc px-5 py-3 md:-mx-7 md:px-7">
        <Button type="submit" className="flex-1" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button variant="contour" onClick={onCancel}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

/** Livres : tableau triable, fiche créée ou modifiée dans un panneau, archivage groupé. */
export function BooksTable({
  rows,
  categories,
  authorNames,
  initialOpenId,
}: {
  rows: BookRow[];
  categories: Option[];
  authorNames: string[];
  initialOpenId?: string;
}) {
  const { run, toast, notify } = useAdminAction();
  const [editing, setEditing] = useState<BookInput | null>(() => {
    const row = rows.find((r) => r.id === initialOpenId);
    return row ? toInput(row) : null;
  });
  const current = editing?.id ? rows.find((row) => row.id === editing.id) : undefined;

  const archive = (ids: string[], archived: boolean) =>
    Promise.all(ids.map((id) => run(() => setBookArchivedAction({ id, archived }), {}))).then(() =>
      notify({
        tone: "succes",
        text: archived ? "Archivé : retiré du site public." : "Restauré dans le catalogue.",
      }),
    );

  return (
    <>
      <DataTable
        label="Livres"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.title} ${row.authors} ${row.categoryName}`}
        searchPlaceholder="Titre ou auteur…"
        filters={[
          {
            key: "category",
            label: "Catégorie",
            get: (row) => row.categoryId,
            options: categories,
          },
          {
            key: "state",
            label: "État",
            get: (row) => state(row),
            options: Object.entries(stateLabels).map(([value, label]) => ({ value, label })),
          },
        ]}
        defaultSort={{ key: "title", direction: "asc" }}
        onOpen={(row) => setEditing(toInput(row))}
        bulkActions={[
          { label: "Archiver", run: (ids) => archive(ids, true) },
          { label: "Restaurer", tone: "contour", run: (ids) => archive(ids, false) },
        ]}
        actions={
          <Button
            size="sm"
            data-shortcut-new
            onClick={() => setEditing(blank(categories[0]?.value ?? ""))}
          >
            <Plus aria-hidden="true" />
            Nouveau livre
          </Button>
        }
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.title}</span>
              <State row={row} />
            </span>
            <span className="petit mt-1 block text-gris">
              {row.authors} · {row.categoryName}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucun livre ici">
            Ajoutez le premier livre du club avec le bouton « Nouveau livre ».
          </EmptyState>
        }
      />

      <SidePanel
        open={editing !== null}
        onClose={() => setEditing(null)}
        wide
        surtitre={editing?.id ? "Fiche du livre" : "Nouveau livre"}
        title={editing?.id ? (current?.title ?? "Livre") : "Ajouter au catalogue"}
      >
        {editing ? (
          <>
            {current && !current.archived && current.isPublished ? (
              <p className="petit mb-5">
                <a
                  href={`/library/${current.slug}`}
                  target="_blank"
                  className="lien"
                  rel="noreferrer"
                >
                  Voir la fiche sur le site
                </a>
              </p>
            ) : null}
            <BookForm
              key={editing.id || "nouveau"}
              initial={editing}
              categories={categories}
              authorNames={authorNames}
              onCancel={() => setEditing(null)}
              onSaved={(message) => {
                setEditing(null);
                void run(async () => ({ ok: true as const, data: undefined }), {
                  success: message,
                });
              }}
            />
          </>
        ) : null}
      </SidePanel>
      {toast}
    </>
  );
}

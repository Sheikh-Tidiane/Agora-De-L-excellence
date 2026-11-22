"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DataTable, type Column } from "@/components/admin/data-table";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { setArticleStatusAction } from "@/features/articles/actions";
import { stateLabels, stateTones } from "@/features/articles/components/article-editor";
import type { ArticleStatusCode } from "@/features/articles/schemas";
import { formatDateTime, formatShortDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type ArticleRow = {
  id: string;
  title: string;
  category: string;
  state: keyof typeof stateLabels;
  publishedAt: Date | null;
  updatedAt: Date;
  authorName: string | null;
};

const State = ({ state }: { state: ArticleRow["state"] }) => (
  <StatusPill tone={stateTones[state]}>{stateLabels[state]}</StatusPill>
);

const columns: Column<ArticleRow>[] = [
  { key: "title", header: "Titre", cell: (row) => row.title, sort: (row) => row.title },
  { key: "category", header: "Rubrique", cell: (row) => row.category, sort: (row) => row.category },
  {
    key: "author",
    header: "Auteur",
    cell: (row) => row.authorName ?? "—",
    sort: (row) => row.authorName,
    className: "max-xl:hidden",
  },
  {
    key: "publishedAt",
    header: "Publication",
    cell: (row) => (
      <span className="tabular-nums">
        {row.publishedAt ? formatDateTime(row.publishedAt) : "—"}
      </span>
    ),
    sort: (row) => row.publishedAt?.getTime() ?? null,
  },
  {
    key: "updatedAt",
    header: "Modifié le",
    cell: (row) => <span className="tabular-nums">{formatShortDate(row.updatedAt)}</span>,
    sort: (row) => row.updatedAt.getTime(),
    className: "max-lg:hidden",
  },
  {
    key: "state",
    header: "État",
    cell: (row) => <State state={row.state} />,
    sort: (row) => row.state,
  },
];

/** Articles : tableau triable, publication et archivage groupés ; l'éditeur s'ouvre sur sa page. */
export function ArticlesTable({ rows }: { rows: ArticleRow[] }) {
  const router = useRouter();
  const { run, toast, notify } = useAdminAction();

  const setStatus = async (ids: string[], status: ArticleStatusCode, done: string) => {
    const results = await Promise.all(
      ids.map((id) => run(() => setArticleStatusAction({ id, status }), {})),
    );
    const ok = results.filter(Boolean).length;
    if (ok > 0) notify({ tone: "succes", text: `${ok} article${ok > 1 ? "s" : ""} ${done}.` });
  };

  return (
    <>
      <DataTable
        label="Articles"
        rows={rows}
        columns={columns}
        getId={(row) => row.id}
        searchText={(row) => `${row.title} ${row.category}`}
        searchPlaceholder="Titre ou rubrique…"
        filters={[
          {
            key: "state",
            label: "État",
            get: (row) => row.state,
            options: Object.entries(stateLabels).map(([value, label]) => ({ value, label })),
          },
          {
            key: "category",
            label: "Rubrique",
            get: (row) => row.category,
            options: [...new Set(rows.map((row) => row.category))]
              .sort((a, b) => a.localeCompare(b, "fr"))
              .map((value) => ({ value, label: value })),
          },
        ]}
        defaultSort={{ key: "updatedAt", direction: "desc" }}
        onOpen={(row) => router.push(`/admin/articles/${row.id}`)}
        bulkActions={[
          { label: "Publier", run: (ids) => setStatus(ids, "PUBLISHED", "publié(s)") },
          {
            label: "Archiver",
            tone: "contour",
            run: (ids) => setStatus(ids, "ARCHIVED", "archivé(s)"),
          },
        ]}
        actions={
          <Link
            href="/admin/articles/new"
            data-shortcut-new
            className={cn(buttonVariants({ variant: "principal", size: "sm" }))}
          >
            <Plus aria-hidden="true" />
            Nouvel article
          </Link>
        }
        card={(row) => (
          <>
            <span className="flex items-center justify-between gap-3">
              <span className="font-semibold">{row.title}</span>
              <State state={row.state} />
            </span>
            <span className="petit mt-1 block text-gris">
              {row.category} · modifié le {formatShortDate(row.updatedAt)}
            </span>
          </>
        )}
        empty={
          <EmptyState title="Aucun article ici">
            Écrivez le premier avec « Nouvel article » : compte rendu, mot de la semaine, conseil de
            lecture…
          </EmptyState>
        }
      />
      {toast}
    </>
  );
}

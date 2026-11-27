"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Valeur de tri. Sans elle, la colonne n'est pas triable. */
  sort?: (row: T) => string | number | null;
  align?: "right";
  /** Classes de la cellule (largeur, masquage sous un point de rupture). */
  className?: string;
};

export type TableFilter<T> = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  /** Une liste : la ligne passe si elle contient la valeur choisie (activités d'une rencontre). */
  get: (row: T) => string | readonly string[];
  /** Valeur sélectionnée à l'ouverture. */
  initial?: string;
};

export type BulkAction = {
  label: string;
  run: (ids: string[]) => void | Promise<void>;
  tone?: "principal" | "contour";
};

type Props<T> = {
  /** Nom de la liste pour les lecteurs d'écran. */
  label: string;
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  /** Texte dans lequel la recherche cherche. Sans lui, pas de champ de recherche. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  filters?: TableFilter<T>[];
  defaultSort?: { key: string; direction: "asc" | "desc" };
  /** Rendu d'une ligne sous 768 px : une carte simplifiée. */
  card: (row: T) => ReactNode;
  onOpen?: (row: T) => void;
  bulkActions?: BulkAction[];
  /** Désactive la case d'une ligne (par exemple : demande déjà traitée). */
  selectable?: (row: T) => boolean;
  empty: ReactNode;
  /** Actions à droite de la barre d'outils (bouton « Nouveau »…). */
  actions?: ReactNode;
};

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const PAGE = 50;

/**
 * Tableau d'administration : tri par colonne, recherche, filtres, sélection et actions groupées.
 * Sous 768 px, il devient une liste de cartes ; jamais de défilement horizontal de page.
 * Les données sont triées et filtrées dans le navigateur : les listes d'un club tiennent en mémoire.
 */
export function DataTable<T>({
  label,
  rows,
  columns,
  getId,
  searchText,
  searchPlaceholder = "Rechercher…",
  filters = [],
  defaultSort,
  card,
  onOpen,
  bulkActions = [],
  selectable,
  empty,
  actions,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((filter) => [filter.key, filter.initial ?? ""])),
  );
  const [sort, setSort] = useState(defaultSort);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(PAGE);
  const [busy, setBusy] = useState(false);

  const visible = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    let result = rows.filter((row) => {
      for (const filter of filters) {
        const wanted = values[filter.key];
        const got = filter.get(row);
        if (wanted && (typeof got === "string" ? got !== wanted : !got.includes(wanted))) {
          return false;
        }
      }
      if (words.length === 0 || !searchText) return true;
      const text = normalize(searchText(row));
      return words.every((word) => text.includes(word));
    });
    const column = sort ? columns.find((c) => c.key === sort.key) : undefined;
    if (sort && column?.sort) {
      const get = column.sort;
      const factor = sort.direction === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return typeof x === "number" && typeof y === "number"
          ? (x - y) * factor
          : String(x).localeCompare(String(y), "fr", { numeric: true }) * factor;
      });
    }
    return result;
  }, [rows, query, values, sort, columns, filters, searchText]);

  const shown = visible.slice(0, limit);
  const canSelect = bulkActions.length > 0;
  const selectableIds = visible.filter((row) => selectable?.(row) ?? true).map(getId);
  const chosen = selectableIds.filter((id) => selected.has(id));
  const allChosen = selectableIds.length > 0 && chosen.length === selectableIds.length;

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSort = (key: string) =>
    setSort((current) =>
      current?.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );

  const runBulk = async (action: BulkAction) => {
    setBusy(true);
    try {
      await action.run(chosen);
      setSelected(new Set());
    } finally {
      setBusy(false);
    }
  };

  const fieldClass =
    "h-10 rounded-champ border border-indigo/25 bg-blanc px-3 text-[0.9375rem] hover:border-indigo/50 focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20 focus-visible:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        {searchText ? (
          <div className="relative min-w-0 flex-1 basis-56 md:max-w-xs">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gris"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setLimit(PAGE);
              }}
              placeholder={searchPlaceholder}
              aria-label={`Rechercher dans : ${label}`}
              data-table-search
              className={cn(fieldClass, "w-full pl-9")}
            />
          </div>
        ) : null}
        {filters.map((filter) => (
          <select
            key={filter.key}
            aria-label={filter.label}
            value={values[filter.key]}
            onChange={(event) => {
              setValues((current) => ({ ...current, [filter.key]: event.target.value }));
              setLimit(PAGE);
            }}
            className={cn(fieldClass, "max-w-full pr-8")}
          >
            <option value="">{filter.label} : tout</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ))}
        <p role="status" className="petit text-gris tabular-nums md:ml-1">
          {visible.length === rows.length
            ? `${rows.length} ligne${rows.length > 1 ? "s" : ""}`
            : `${visible.length} sur ${rows.length}`}
        </p>
        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>

      {canSelect && chosen.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-champ bg-indigo px-4 py-2.5 text-ivoire">
          <p className="text-[0.9375rem] font-semibold tabular-nums">
            {chosen.length} sélectionnée{chosen.length > 1 ? "s" : ""}
          </p>
          <div className="ml-auto flex flex-wrap gap-2">
            {bulkActions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant={action.tone === "contour" ? "contour-clair" : "clair"}
                className="h-9"
                disabled={busy}
                onClick={() => void runBulk(action)}
              >
                {action.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="contour-clair"
              className="h-9 border-transparent"
              onClick={() => setSelected(new Set())}
            >
              Désélectionner
            </Button>
          </div>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="mt-2">{empty}</div>
      ) : (
        <>
          {/* Desktop : tableau dense, lignes séparées par un filet. */}
          <table
            aria-label={label}
            className="mt-4 hidden w-full text-left text-[0.9375rem] md:table"
          >
            <thead>
              <tr className="border-b border-indigo/30">
                {canSelect ? (
                  <th scope="col" className="w-10 py-2 pr-2">
                    <input
                      type="checkbox"
                      aria-label="Tout sélectionner"
                      checked={allChosen}
                      onChange={() => setSelected(new Set(allChosen ? [] : selectableIds))}
                      className="size-4 accent-indigo"
                    />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const active = sort?.key === column.key;
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      aria-sort={
                        active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined
                      }
                      className={cn(
                        "py-2 pr-5 text-[0.8125rem] font-semibold text-gris last:pr-0",
                        column.align === "right" && "text-right",
                        column.className,
                      )}
                    >
                      {column.sort ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className={cn(
                            "-mx-1.5 inline-flex h-8 items-center gap-1 rounded-[6px] px-1.5 hover:bg-indigo/5 hover:text-indigo",
                            active && "text-indigo",
                          )}
                        >
                          {column.header}
                          {active ? (
                            sort.direction === "asc" ? (
                              <ArrowUp aria-hidden="true" className="size-3.5" />
                            ) : (
                              <ArrowDown aria-hidden="true" className="size-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-50" />
                          )}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => {
                const id = getId(row);
                const isSelectable = selectable?.(row) ?? true;
                return (
                  <tr
                    key={id}
                    onClick={onOpen ? () => onOpen(row) : undefined}
                    className={cn(
                      "border-b border-trait transition-colors",
                      onOpen && "cursor-pointer hover:bg-sable/50",
                      selected.has(id) && "bg-sable/70",
                    )}
                  >
                    {canSelect ? (
                      <td className="py-2.5 pr-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Sélectionner la ligne"
                          checked={selected.has(id)}
                          disabled={!isSelectable}
                          onChange={() => toggle(id)}
                          className="size-4 accent-indigo disabled:opacity-30"
                        />
                      </td>
                    ) : null}
                    {columns.map((column, index) => (
                      <td
                        key={column.key}
                        className={cn(
                          "py-2.5 pr-5 align-middle last:pr-0",
                          column.align === "right" && "text-right tabular-nums",
                          column.className,
                        )}
                      >
                        {index === 0 && onOpen ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpen(row);
                            }}
                            className="text-left font-semibold decoration-terracotta underline-offset-4 hover:underline"
                          >
                            {column.cell(row)}
                          </button>
                        ) : (
                          column.cell(row)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Mobile : liste de cartes simplifiées. */}
          <ul aria-label={label} className="mt-3 md:hidden">
            {shown.map((row) => {
              const id = getId(row);
              const isSelectable = selectable?.(row) ?? true;
              return (
                <li key={id} className="flex items-stretch gap-1 border-b border-trait">
                  {canSelect ? (
                    <label className="flex w-9 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        aria-label="Sélectionner"
                        checked={selected.has(id)}
                        disabled={!isSelectable}
                        onChange={() => toggle(id)}
                        className="size-5 accent-indigo disabled:opacity-30"
                      />
                    </label>
                  ) : null}
                  {onOpen ? (
                    <button
                      type="button"
                      onClick={() => onOpen(row)}
                      className="min-w-0 flex-1 py-3.5 text-left active:bg-sable/60"
                    >
                      {card(row)}
                    </button>
                  ) : (
                    <div className="min-w-0 flex-1 py-3.5">{card(row)}</div>
                  )}
                </li>
              );
            })}
          </ul>

          {visible.length > limit ? (
            <div className="mt-4">
              <Button variant="contour" size="sm" onClick={() => setLimit(limit + PAGE)}>
                Afficher les {Math.min(PAGE, visible.length - limit)} suivantes
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

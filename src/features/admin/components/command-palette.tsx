"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import type { AdminNavGroup } from "@/config/admin-navigation";
import { adminSearchAction, type SearchHit } from "@/features/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Recherche globale (Ctrl K ou /) : rubriques, puis membres, demandes, livres, événements
 * et articles trouvés en base. Entièrement pilotable au clavier.
 */
export function CommandPalette({
  open,
  onClose,
  groups,
}: {
  open: boolean;
  onClose: () => void;
  groups: AdminNavGroup[];
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      input.current?.focus();
    }
    if (!open && element.open) element.close();
  }, [open]);

  // Recherche en base, différée de 220 ms après la dernière frappe.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const result = await adminSearchAction({ q });
      if (cancelled) return;
      setHits(result.ok ? result.data : []);
      setLoading(false);
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages: SearchHit[] = groups
      .flatMap((group) => group.items)
      .filter((item) => !q || item.label.toLowerCase().includes(q))
      .map((item) => ({ group: "Rubriques", label: item.label, hint: "", href: item.href }));
    return [...pages, ...(q.length >= 2 ? hits : [])];
  }, [groups, hits, query]);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    onClose();
    router.push(hit.href);
  };

  const close = () => {
    setQuery("");
    setHits([]);
    setActive(0);
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      aria-label="Recherche dans l’administration"
      onClose={close}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
      className="feuille fixed inset-x-0 top-0 m-0 max-h-[80dvh] w-full max-w-none rounded-b-feuille bg-blanc p-0 text-indigo shadow-feuille backdrop:bg-indigo/45 md:inset-x-auto md:top-[12vh] md:left-1/2 md:w-[600px] md:-translate-x-1/2 md:rounded-feuille"
    >
      {open ? (
        <div className="flex max-h-[80dvh] flex-col">
          <div className="relative shrink-0 border-b border-trait">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-gris"
            />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(i + 1, results.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  go(results[active]);
                }
              }}
              placeholder="Un membre, un livre, une rencontre, une rubrique…"
              aria-label="Rechercher"
              autoComplete="off"
              className="h-14 w-full bg-transparent pr-4 pl-12 text-base focus-visible:outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-gris">
                {loading ? "Recherche…" : "Aucun résultat."}
              </p>
            ) : (
              <ul>
                {results.map((hit, index) => (
                  <li key={`${hit.href}-${index}`}>
                    {index === 0 || results[index - 1]!.group !== hit.group ? (
                      <p className="surtitre px-3 pt-3 pb-1.5 text-[0.6875rem]!">{hit.group}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => go(hit)}
                      onMouseEnter={() => setActive(index)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left",
                        index === active && "bg-sable",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{hit.label}</span>
                        {hit.hint ? (
                          <span className="petit block truncate text-gris">{hit.hint}</span>
                        ) : null}
                      </span>
                      {index === active ? (
                        <CornerDownLeft aria-hidden="true" className="size-4 shrink-0 text-gris" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="petit hidden shrink-0 border-t border-trait px-4 py-2.5 text-gris md:block">
            ↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer
          </p>
        </div>
      ) : null}
    </dialog>
  );
}

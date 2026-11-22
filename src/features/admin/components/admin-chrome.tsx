"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, ExternalLink, Keyboard, Menu, Search, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  adminBreadcrumbLabels,
  type AdminNavGroup,
  type AdminNavItem,
} from "@/config/admin-navigation";
import { CommandPalette } from "@/features/admin/components/command-palette";
import { cn } from "@/lib/utils";

export type NavCounts = Partial<Record<NonNullable<AdminNavItem["badge"]>, number>>;

type ChromeProps = {
  groups: AdminNavGroup[];
  /** Compteurs affichés à côté des rubriques (demandes, lectures en attente). */
  counts: NavCounts;
  user: { name: string; role: string };
  shortName: string;
  /** Bouton de déconnexion (formulaire serveur). */
  signOut: ReactNode;
  children: ReactNode;
};

const isActive = (pathname: string, href: string, all: string[]) => {
  if (href === "/admin") return pathname === "/admin";
  if (!(pathname === href || pathname.startsWith(`${href}/`))) return false;
  // « /admin/books/categories » ne doit pas allumer aussi « /admin/books ».
  return !all.some(
    (other) =>
      other !== href &&
      other.startsWith(`${href}/`) &&
      (pathname === other || pathname.startsWith(`${other}/`)),
  );
};

function Nav({
  groups,
  counts,
  onNavigate,
}: Pick<ChromeProps, "groups" | "counts"> & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = groups.flatMap((group) => group.items.map((item) => item.href));
  const nav = useRef<HTMLElement>(null);
  // La rubrique courante reste visible, même sous le fondu d'un écran peu haut.
  useEffect(() => {
    nav.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  return (
    <nav ref={nav} aria-label="Administration">
      {groups.map((group, i) => (
        <div key={group.title ?? i} className={i > 0 ? "mt-5 lg:mt-2" : undefined}>
          {group.title ? (
            <p className="px-3 pb-1.5 text-[0.6875rem] font-bold tracking-[0.16em] text-ivoire/55 uppercase lg:pb-0.5 lg:text-[0.625rem]">
              {group.title}
            </p>
          ) : null}
          <ul>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, all);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex min-h-11 items-center justify-between gap-2 rounded-[8px] px-3 py-2 text-[0.9375rem] transition-colors lg:min-h-[30px] lg:py-1 lg:text-[0.875rem]",
                      active
                        ? "bg-ivoire/12 font-semibold text-ivoire before:absolute before:top-2 before:bottom-2 before:left-0 before:w-[3px] before:rounded-full before:bg-terracotta-clair"
                        : "text-ivoire/80 hover:bg-ivoire/8 hover:text-ivoire",
                    )}
                  >
                    {item.label}
                    {item.badge && (counts[item.badge] ?? 0) > 0 ? (
                      <span className="rounded-pastille bg-terracotta-clair px-2 text-[0.75rem] leading-5 font-bold text-indigo tabular-nums">
                        {counts[item.badge]}
                        <span className="sr-only">
                          {item.badge === "newMessages"
                            ? counts[item.badge] === 1
                              ? " nouveau"
                              : " nouveaux"
                            : " en attente"}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, i) => ({
    href: `/${segments.slice(0, i + 1).join("/")}`,
    label: adminBreadcrumbLabels[segment] ?? "Fiche",
  }));
  return (
    <nav aria-label="Fil d’Ariane" className="min-w-0">
      <ol className="flex items-center gap-1 text-[0.9375rem]">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={crumb.href}
              className={cn("flex min-w-0 items-center gap-1", !last && "max-md:hidden")}
            >
              {i > 0 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gris max-md:hidden"
                />
              ) : null}
              {last ? (
                <span aria-current="page" className="truncate font-semibold">
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className="truncate text-gris hover:text-indigo">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Cadre de l'administration : sidebar fixe, en-tête avec fil d'Ariane et recherche, raccourcis clavier. */
export function AdminChrome({ groups, counts, user, shortName, signOut, children }: ChromeProps) {
  const router = useRouter();
  const menu = useRef<HTMLDialogElement>(null);
  const help = useRef<HTMLDialogElement>(null);
  const [palette, setPalette] = useState(false);
  const pendingG = useRef(0);

  useEffect(() => {
    const shortcuts = new Map(
      groups
        .flatMap((group) => group.items)
        .flatMap((item) => (item.key ? [[item.key, item.href]] : [])) as [string, string][],
    );
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette(true);
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (Date.now() - pendingG.current < 1200 && shortcuts.has(key)) {
        event.preventDefault();
        pendingG.current = 0;
        router.push(shortcuts.get(key)!);
      } else if (key === "g") {
        pendingG.current = Date.now();
      } else if (event.key === "/") {
        // « / » : le champ de recherche de la liste s'il y en a un, sinon la recherche globale.
        event.preventDefault();
        const field = document.querySelector<HTMLInputElement>("[data-table-search]");
        if (field && field.offsetParent !== null) field.focus();
        else setPalette(true);
      } else if (key === "n") {
        const link = document.querySelector<HTMLElement>("[data-shortcut-new]");
        if (link) {
          event.preventDefault();
          link.click();
        }
      } else if (event.key === "?") {
        event.preventDefault();
        help.current?.showModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groups, router]);

  const brand = (
    <Link href="/admin" className="flex items-center gap-2.5">
      <Image src="/logos/symbole-inverse.svg" alt="" width={34} height={34} unoptimized priority />
      <span className="flex flex-col">
        <span className="font-serif text-[1.25rem] leading-none text-ivoire">{shortName}</span>
        <span className="mt-1 text-[0.625rem] font-bold tracking-[0.16em] text-terracotta-clair uppercase">
          Administration
        </span>
      </span>
    </Link>
  );

  const account = (
    <div className="border-t border-ivoire/15 pt-4 lg:pt-3">
      <p className="truncate px-3 font-semibold text-ivoire">{user.name}</p>
      <p className="petit truncate px-3 text-ivoire/65">{user.role}</p>
      <div className="mt-3 flex flex-col gap-1 lg:mt-1 lg:gap-0">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded-[8px] px-3 text-[0.9375rem] text-ivoire/80 hover:bg-ivoire/8 hover:text-ivoire lg:min-h-8"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Voir le site
        </Link>
        {signOut}
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-[264px]">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-champ bg-indigo px-4 py-3 font-semibold text-ivoire focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>

      {/* Sidebar fixe (desktop). */}
      <aside className="sur-indigo fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-indigo px-3 pt-5 pb-4 lg:flex">
        <div className="px-3 pb-4">{brand}</div>
        {/* Fondu en bas : sur un écran peu haut, il signale que la liste continue. */}
        <div className="min-h-0 flex-1 overflow-y-auto [mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)] pb-8">
          <Nav groups={groups} counts={counts} />
        </div>
        {account}
      </aside>

      <header className="sticky top-0 z-20 border-b border-trait bg-ivoire">
        <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-10">
          <button
            type="button"
            onClick={() => menu.current?.showModal()}
            aria-haspopup="dialog"
            className={cn(buttonVariants({ variant: "discret", size: "icone" }), "-ml-2 lg:hidden")}
          >
            <Menu aria-hidden="true" className="size-6!" />
            <span className="sr-only">Ouvrir le menu</span>
          </button>
          <Breadcrumb />
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex h-10 items-center gap-2 rounded-champ border border-indigo/20 bg-blanc px-3 text-[0.9375rem] text-gris hover:border-indigo/50 max-md:size-10 max-md:justify-center max-md:px-0 md:w-64"
            >
              <Search aria-hidden="true" className="size-4 shrink-0" />
              <span className="max-md:sr-only">Rechercher…</span>
              <kbd className="ml-auto rounded-[5px] border border-trait px-1.5 font-sans text-[0.75rem] font-semibold max-md:hidden">
                Ctrl K
              </kbd>
            </button>
            <button
              type="button"
              onClick={() => help.current?.showModal()}
              className={cn(
                buttonVariants({ variant: "discret", size: "icone" }),
                "size-10 max-lg:hidden",
              )}
            >
              <Keyboard aria-hidden="true" />
              <span className="sr-only">Raccourcis clavier</span>
            </button>
          </div>
        </div>
      </header>

      <main id="contenu" className="px-4 pt-6 pb-16 lg:px-10 lg:pt-9">
        {children}
      </main>

      {/* Menu mobile. */}
      <dialog
        ref={menu}
        aria-label="Menu de l’administration"
        onClick={(event) => {
          if (event.target === menu.current) menu.current?.close();
        }}
        className="menu-plein-ecran sur-indigo m-0 h-dvh max-h-none w-[min(86vw,320px)] max-w-none overflow-y-auto bg-indigo p-0 text-ivoire backdrop:bg-indigo/55"
      >
        <div className="flex min-h-full flex-col px-3 pt-4 pb-5">
          <div className="flex items-center justify-between px-3 pb-5">
            {brand}
            <button
              type="button"
              onClick={() => menu.current?.close()}
              className={cn(
                buttonVariants({ variant: "contour-clair", size: "icone" }),
                "-mr-2 border-transparent",
              )}
            >
              <X aria-hidden="true" className="size-6!" />
              <span className="sr-only">Fermer le menu</span>
            </button>
          </div>
          <div className="flex-1">
            <Nav groups={groups} counts={counts} onNavigate={() => menu.current?.close()} />
          </div>
          <div className="mt-6">{account}</div>
        </div>
      </dialog>

      <CommandPalette open={palette} onClose={() => setPalette(false)} groups={groups} />

      <dialog
        ref={help}
        aria-label="Raccourcis clavier"
        onClick={(event) => {
          if (event.target === help.current) help.current?.close();
        }}
        className="feuille m-auto w-[min(92vw,440px)] rounded-feuille bg-blanc p-7 text-indigo shadow-feuille backdrop:bg-indigo/45"
      >
        <h2 className="titre-3">Raccourcis clavier</h2>
        <dl className="mt-4">
          {[
            ["Ctrl K", "Recherche globale"],
            ["/", "Chercher dans la liste affichée"],
            ["N", "Nouvel élément (livre, événement, article…)"],
            ...groups
              .flatMap((group) => group.items)
              .filter((item) => item.key)
              .map((item) => [`G puis ${item.key!.toUpperCase()}`, item.label]),
            ["?", "Cette aide"],
            ["Échap", "Fermer un panneau"],
          ].map(([keys, label]) => (
            <div
              key={keys}
              className="flex items-center justify-between gap-4 border-t border-trait py-2.5"
            >
              <dt className="text-[0.9375rem]">{label}</dt>
              <dd>
                <kbd className="rounded-[5px] border border-indigo/25 bg-ivoire px-2 py-0.5 font-sans text-[0.8125rem] font-semibold whitespace-nowrap">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={() => help.current?.close()}
          className={cn(buttonVariants({ variant: "principal", size: "sm" }), "mt-5")}
        >
          Fermer
        </button>
      </dialog>
    </div>
  );
}

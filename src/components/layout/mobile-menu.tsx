"use client";

import { useRef, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { LetterTile } from "@/components/shared/letter-tile";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type MobileMenuProps = {
  items: NavItem[];
  shortName: string;
  /** Actions du bas (adhésion et connexion, ou espace et déconnexion), rendues par le serveur. */
  actions: ReactNode;
};

/**
 * Menu plein écran du site public (mobile et tablette).
 * Repose sur <dialog> natif : piège à focus, touche Échap et couche supérieure
 * sont gérés par le navigateur, sans bibliothèque.
 */
export function MobileMenu({ items, shortName, actions }: MobileMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Chaque lien referme le menu : la navigation se fait derrière.
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        className={cn(buttonVariants({ variant: "discret", size: "icone" }), "-mr-2 lg:hidden")}
      >
        <Menu aria-hidden="true" className="size-6!" />
        <span className="sr-only">Ouvrir le menu</span>
      </button>

      <dialog
        ref={dialog}
        aria-label="Menu principal"
        className="menu-plein-ecran sur-indigo m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto overscroll-contain bg-indigo text-ivoire backdrop:bg-indigo"
      >
        <div className="flex min-h-full flex-col px-5 pb-8">
          <div className="flex h-(--hauteur-entete) shrink-0 items-center justify-between">
            <Link href="/" onClick={close} className="flex items-center gap-2.5">
              <Image src="/logos/symbole-inverse.svg" alt="" width={36} height={36} unoptimized />
              <span className="font-serif text-[1.375rem] leading-none">{shortName}</span>
            </Link>
            <button
              type="button"
              onClick={close}
              className={cn(
                buttonVariants({ variant: "contour-clair", size: "icone" }),
                "-mr-2 border-transparent",
              )}
            >
              <X aria-hidden="true" className="size-6!" />
              <span className="sr-only">Fermer le menu</span>
            </button>
          </div>

          <nav aria-label="Rubriques" className="mt-6 flex-1">
            <ul>
              {items.map((item, i) => (
                <li
                  key={item.label}
                  className="menu-entree border-b border-ivoire/12"
                  style={{ animationDelay: `${80 + i * 40}ms` }}
                >
                  <Link
                    href={item.href}
                    onClick={close}
                    className="group flex min-h-[68px] items-center gap-4 py-3"
                  >
                    <LetterTile
                      letter={item.label.charAt(0)}
                      tone={i === 0 ? "clair" : "ivoire"}
                      className="text-[40px]"
                    />
                    <span className="flex-1">
                      <span className="block font-serif text-[1.625rem] leading-tight">
                        {item.label}
                      </span>
                      {item.hint ? (
                        <span className="block text-sm text-ivoire/70">{item.hint}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Les liens viennent du serveur : on referme le menu au clic sur l'un d'eux. */}
          <div
            className="mt-8 space-y-3"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) close();
            }}
          >
            {actions}
          </div>
        </div>
      </dialog>
    </>
  );
}

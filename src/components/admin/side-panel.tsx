"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidePanelProps = {
  open: boolean;
  onClose: () => void;
  surtitre?: string;
  title: string;
  children: ReactNode;
  /** Barre d'actions collée en bas du panneau. */
  footer?: ReactNode;
  wide?: boolean;
};

/**
 * Panneau latéral : consulter ou modifier une ligne sans quitter la liste.
 * Desktop : volet à droite. Mobile : feuille qui monte du bas.
 * <dialog> natif : focus piégé, Échap et clic sur le fond pour fermer.
 */
export function SidePanel({
  open,
  onClose,
  surtitre,
  title,
  children,
  footer,
  wide,
}: SidePanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
      className={cn(
        "panneau bg-ivoire text-indigo shadow-feuille backdrop:bg-indigo/45",
        "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none rounded-t-feuille p-0",
        "md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-none md:rounded-none",
        wide ? "md:w-[640px]" : "md:w-[500px]",
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col md:h-dvh md:max-h-none">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-trait px-5 pt-4 pb-4 md:px-7 md:pt-6">
            <div className="min-w-0">
              {surtitre ? <p className="surtitre">{surtitre}</p> : null}
              <h2 id={titleId} className="titre-3 mt-1 break-words">
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(buttonVariants({ variant: "discret", size: "icone" }), "-mt-1 -mr-2")}
            >
              <X aria-hidden="true" />
              <span className="sr-only">Fermer</span>
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 md:px-7 md:py-6">
            {children}
          </div>
          {footer ? (
            <footer className="shrink-0 border-t border-trait bg-blanc px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-7 md:py-4">
              {footer}
            </footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}

/** Ligne « libellé : valeur » d'une fiche. */
export function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 border-b border-trait py-3">
      <dt className="petit pt-0.5 text-gris">{label}</dt>
      <dd className="min-w-0 text-[0.9375rem] font-semibold break-words">{children}</dd>
    </div>
  );
}

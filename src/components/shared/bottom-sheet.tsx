"use client";

import { useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  title: string;
  /** Contenu du bouton qui ouvre la feuille. */
  trigger: ReactNode;
  triggerClassName?: string;
  children: ReactNode;
};

/**
 * Feuille qui monte du bas de l'écran (mobile) ; panneau centré à partir de 768 px.
 * <dialog> natif : focus piégé, Échap et clic sur le fond pour fermer.
 */
export function BottomSheet({ title, trigger, triggerClassName, children }: BottomSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className={triggerClassName ?? buttonVariants({ variant: "contour" })}
      >
        {trigger}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => {
          // Un clic sur le fond (le <dialog> lui-même, pas son contenu) referme.
          if (e.target === dialog.current) dialog.current?.close();
        }}
        className={cn(
          "feuille rounded-t-feuille bg-blanc text-indigo shadow-feuille backdrop:bg-indigo/45",
          "fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto overscroll-contain p-0",
          "md:inset-0 md:m-auto md:h-fit md:max-w-lg md:rounded-feuille",
        )}
      >
        <div className="px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-7">
          <span
            aria-hidden="true"
            className="mx-auto block h-1 w-10 rounded-full bg-trait md:hidden"
          />
          <div className="mt-3 flex items-start justify-between gap-4 md:mt-0">
            <h2 id={titleId} className="titre-3">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={cn(buttonVariants({ variant: "discret", size: "icone" }), "-mt-2 -mr-2")}
            >
              <X aria-hidden="true" />
              <span className="sr-only">Fermer</span>
            </button>
          </div>
          <div className="mt-3">{children}</div>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { Share2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};
/** Le partage natif n'existe que dans certains navigateurs (téléphones surtout). */
const canShareNatively = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

const button = cn(buttonVariants({ variant: "contour" }), "min-w-0 flex-1 sm:flex-none");

/**
 * « Partager sur WhatsApp » (lien wa.me, sans JavaScript) et, si le navigateur le propose, le
 * partage natif du téléphone. Les deux tiennent sur une ligne, et la place du second est occupée
 * dès le premier rendu par un bloc inerte de même taille : rien ne bouge quand il apparaît.
 */
export function ShareButtons({
  whatsappHref,
  share,
}: {
  whatsappHref: string;
  share: { title: string; text: string; url: string };
}) {
  const native = useSyncExternalStore(subscribe, canShareNatively, () => false);
  return (
    <div className="flex gap-2">
      <a
        href={whatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Partager sur WhatsApp (nouvel onglet)"
        className={button}
      >
        <WhatsAppIcon />
        <span className="sm:hidden">WhatsApp</span>
        <span className="max-sm:hidden">Partager sur WhatsApp</span>
      </a>
      {native ? (
        <button
          type="button"
          onClick={() => {
            navigator.share(share).catch(() => {
              // Partage annulé par la personne, ou refusé par le navigateur : rien à signaler.
            });
          }}
          className={button}
        >
          <Share2 aria-hidden="true" />
          Partager…
        </button>
      ) : (
        <span aria-hidden="true" className={cn(button, "invisible")}>
          <Share2 />
          Partager…
        </span>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="currentColor">
      <path d="M12.04 2a9.93 9.93 0 0 0-8.6 14.9L2 22l5.25-1.38A9.94 9.94 0 1 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.11.82.83-3.04-.2-.31a8.22 8.22 0 1 1 6.96 3.85Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.55.12-.16.25-.63.8-.78.96-.14.17-.29.19-.53.06a6.73 6.73 0 0 1-3.32-2.9c-.25-.43.25-.4.71-1.33.08-.16.04-.3-.02-.43-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.41-.55-.42h-.47a.9.9 0 0 0-.65.3 2.74 2.74 0 0 0-.86 2.04 4.76 4.76 0 0 0 1 2.53 10.9 10.9 0 0 0 4.18 3.7c1.56.67 2.17.73 2.95.61.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.15-1.17-.06-.1-.22-.16-.47-.29Z" />
    </svg>
  );
}

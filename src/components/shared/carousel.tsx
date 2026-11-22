"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CarouselProps = {
  /** Nom de la liste pour les lecteurs d'écran, ex. « Sélection de livres ». */
  label: string;
  children: ReactNode;
  className?: string;
  /** Classes de la piste (espacement, marges de débord). */
  trackClassName?: string;
};

/**
 * Carrousel tactile : défilement natif avec aimantation (aucune bibliothèque,
 * fluide sur un téléphone d'entrée de gamme). Les boutons précédent / suivant
 * et le clavier offrent une alternative au geste.
 */
export function Carousel({ label, children, className, trackClassName }: CarouselProps) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft <= 4,
        end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({
      left: direction * el.clientWidth * 0.8,
      behavior: reduce ? "auto" : "smooth",
    });
  };

  return (
    <div className={cn("relative", className)}>
      <ul
        ref={track}
        aria-label={label}
        tabIndex={0}
        className={cn(
          "sans-barre flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain",
          trackClassName,
        )}
      >
        {children}
      </ul>
      <div className="mt-6 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={edges.start}
          className={buttonVariants({ variant: "contour", size: "icone" })}
        >
          <ChevronLeft aria-hidden="true" />
          <span className="sr-only">Voir les précédents</span>
        </button>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={edges.end}
          className={buttonVariants({ variant: "contour", size: "icone" })}
        >
          <ChevronRight aria-hidden="true" />
          <span className="sr-only">Voir les suivants</span>
        </button>
      </div>
    </div>
  );
}

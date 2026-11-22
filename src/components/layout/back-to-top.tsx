"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELECTEUR_INTERACTIF, boutonVisible, distanceAuBas } from "@/components/layout/back-to-top-logic";

/** Marge au bord de l'écran (px), en plus des zones de sécurité du téléphone. */
const MARGE = 16;

/**
 * « Revenir en haut » des pages publiques longues : une petite tuile indigo à flèche
 * ivoire, aux coins de la tuile A1 du logo. Elle se soulève au-dessus du pied de page
 * et s'efface dès qu'un lien, un bouton ou un champ passerait dessous.
 */
export function BackToTop() {
  const bouton = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [masque, setMasque] = useState(false);
  const [bas, setBas] = useState(MARGE);

  useEffect(() => {
    let image = 0;
    let etaitVisible = false;
    const mesurer = () => {
      image = 0;
      const hauteur = window.innerHeight;
      etaitVisible = boutonVisible(window.scrollY, hauteur, etaitVisible);
      setVisible(etaitVisible);

      const pied = document.querySelector("body > footer, #contenu ~ footer");
      const distance = distanceAuBas(pied ? pied.getBoundingClientRect().top : null, hauteur, MARGE);
      if (distance === null) return setMasque(true);
      setBas(distance);

      // Rien d'interactif sous le bouton : on regarde sous ses coins et son centre,
      // à la position qu'il prend maintenant.
      const el = bouton.current;
      if (!el || !etaitVisible) return setMasque(false);
      const r = el.getBoundingClientRect();
      const decalage = hauteur - distance - r.bottom;
      r.y += decalage;
      const points: [number, number][] = [
        [r.left + 2, r.top + 2],
        [r.right - 2, r.top + 2],
        [r.left + 2, r.bottom - 2],
        [r.right - 2, r.bottom - 2],
        [(r.left + r.right) / 2, (r.top + r.bottom) / 2],
      ];
      const dessous = points.some(([x, y]) =>
        document
          .elementsFromPoint(x, y)
          .some((n) => n !== el && !el.contains(n) && n.closest(SELECTEUR_INTERACTIF) !== null),
      );
      setMasque(dessous);
    };
    const demander = () => {
      if (!image) image = requestAnimationFrame(mesurer);
    };
    mesurer();
    window.addEventListener("scroll", demander, { passive: true });
    window.addEventListener("resize", demander);
    return () => {
      window.removeEventListener("scroll", demander);
      window.removeEventListener("resize", demander);
      if (image) cancelAnimationFrame(image);
    };
  }, []);

  const affiche = visible && !masque;

  const remonter = () => {
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduit ? "auto" : "smooth" });
    // Le focus revient au début du contenu, pour le clavier et les lecteurs d'écran.
    document.getElementById("contenu")?.focus({ preventScroll: true });
  };

  return (
    <button
      ref={bouton}
      type="button"
      onClick={remonter}
      aria-label="Revenir en haut"
      aria-hidden={affiche ? undefined : true}
      tabIndex={affiche ? 0 : -1}
      style={{ bottom: `calc(${bas}px + env(safe-area-inset-bottom))` }}
      className={cn(
        "fixed right-[max(1rem,env(safe-area-inset-right))] z-30 grid size-12 place-items-center rounded-[7px] bg-indigo text-ivoire",
        "shadow-[0_1px_0_rgb(31_42_85/0.06),0_6px_14px_-8px_rgb(31_42_85/0.35)]",
        "transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none",
        "hover:-translate-y-0.5 active:translate-y-0 focus-visible:rounded-[7px] lg:right-8",
        affiche ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <ArrowUp aria-hidden="true" className="size-5" strokeWidth={2.2} />
    </button>
  );
}

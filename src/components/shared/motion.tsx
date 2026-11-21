import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Apparition au défilement : montée de 16 px et fondu.
 *
 * Composant serveur, sans JavaScript : l'animation est pilotée par le défilement en CSS
 * (`animation-timeline: view()`, voir globals.css). Mesuré en phase 1 : la même animation
 * faite avec Motion coûtait ~700 ms de blocage sur un Android milieu de gamme.
 * Là où le navigateur ne connaît pas cette propriété, ou si l'utilisateur a demandé
 * moins d'animations, le contenu est simplement visible.
 * Motion reste réservé aux interactions qui ont besoin d'état (gestes, transitions de liste).
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Décalage en secondes « équivalentes » : retarde légèrement l'entrée, pour les cascades. */
  delay?: number;
  className?: string;
}) {
  const style = delay
    ? ({ "--decalage": `${Math.round(delay * 150)}%` } as CSSProperties)
    : undefined;

  return (
    <div className={cn("apparition", className)} style={style}>
      {children}
    </div>
  );
}

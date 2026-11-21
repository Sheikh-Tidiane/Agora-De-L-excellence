import type { ReactNode } from "react";
import { Hemicycle, type HemicycleRow } from "@/components/shared/hemicycle";
import { LetterTile, type LetterTileTone } from "@/components/shared/letter-tile";
import { cn } from "@/lib/utils";

const T = "var(--color-terracotta)";
const C = "var(--color-terracotta-clair)";
const I = "var(--color-indigo)";
const V = "var(--color-trait)";

/** Trois jeux de gradins : chaque rubrique a les siens, pour que les pages ne se ressemblent pas. */
const arcs: Record<"a" | "b" | "c", HemicycleRow[]> = {
  a: [
    { radius: 58, fill: C },
    { radius: 73, fill: V, accents: { 4: I, 11: T } },
    { radius: 88, fill: V, accents: { 7: I, 16: C } },
    { radius: 103, fill: V, accents: { 2: T, 19: I } },
  ],
  b: [
    { radius: 58, fill: I },
    { radius: 73, fill: I, accents: { 6: T } },
    { radius: 88, fill: V, accents: { 3: I, 4: I, 14: C } },
    { radius: 103, fill: V, accents: { 10: I } },
  ],
  c: [
    { radius: 58, fill: T },
    { radius: 73, fill: C },
    { radius: 88, fill: V, accents: { 9: I } },
    { radius: 103, fill: V, accents: { 5: I, 17: T } },
  ],
};

type PageIntroProps = {
  surtitre: string;
  title: ReactNode;
  children?: ReactNode;
  /** Initiale posée sur la scène des gradins. */
  letter: string;
  tone?: LetterTileTone;
  arc?: keyof typeof arcs;
  /** Contenu sous le chapô (actions, repères). */
  aside?: ReactNode;
  className?: string;
};

/**
 * Ouverture d'une page de rubrique : titre calé à gauche en grand corps, gradins rognés par
 * le bord droit de l'écran, l'initiale de la rubrique posée sur la scène.
 */
export function PageIntro({
  surtitre,
  title,
  children,
  letter,
  tone = "indigo",
  arc = "a",
  aside,
  className,
}: PageIntroProps) {
  return (
    <section className={cn("relative overflow-hidden border-b border-trait", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[86px] -right-[150px] w-[330px] rotate-[200deg] sm:-right-[150px] sm:w-[440px] lg:-top-[190px] lg:-right-[230px] lg:w-[820px] xl:-right-[150px]"
      >
        <Hemicycle rows={arcs[arc]} overshoot={8} cascade />
      </div>
      <div className="page relative pt-10 pb-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:pt-24 lg:pb-20">
        <div className="lg:col-span-8">
          <LetterTile letter={letter} tone={tone} className="text-[52px] lg:text-[72px]" />
          <p className="surtitre mt-6 lg:mt-8">{surtitre}</p>
          <h1 className="titre-1 mt-3 max-w-[15em] pr-10 lg:pr-0 lg:text-[4.25rem]">{title}</h1>
          {children ? <p className="chapo mt-5 text-gris lg:mt-6">{children}</p> : null}
          {aside ? <div className="mt-7">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}

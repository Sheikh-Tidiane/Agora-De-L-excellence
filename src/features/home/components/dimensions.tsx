import { LetterTile } from "@/components/shared/letter-tile";
import { Reveal } from "@/components/shared/motion";
import { dimensions, objectives } from "@/features/home/content";
import { cn } from "@/lib/utils";

const tones = ["indigo", "terracotta", "clair"] as const;
/** Sur desktop, les trois colonnes descendent en marches, comme des gradins. */
const steps = ["lg:mt-0", "lg:mt-16", "lg:mt-32"];

/** Les trois dimensions du club (docs/CONTENUS-CLUB.md, section 4). */
export function Dimensions({ className }: { className?: string }) {
  return (
    <section aria-labelledby="dimensions-titre" className={cn("page py-18 lg:py-36", className)}>
      <div className="lg:grid lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="surtitre">Les trois dimensions du club</p>
          <h2 id="dimensions-titre" className="titre-1 mt-3">
            Culturelle, intellectuelle, sociale.
          </h2>
        </div>
        <p className="chapo mt-5 text-gris lg:col-span-5 lg:col-start-8 lg:mt-0 lg:self-end">
          {objectives[0]}
        </p>
      </div>

      <ol className="mt-12 grid gap-10 lg:mt-20 lg:grid-cols-3 lg:gap-8">
        {dimensions.map((dimension, i) => (
          <li key={dimension.title} className={steps[i]}>
            <Reveal delay={i * 0.08}>
              <div className={cn("border-t border-indigo pt-6", "flex gap-5 lg:block")}>
                <LetterTile
                  letter={dimension.letter}
                  tone={tones[i]}
                  className="text-[64px] lg:text-[88px]"
                />
                <div className="lg:mt-7">
                  <h3 className="titre-2">
                    <span className="surtitre mb-1.5 block">Dimension</span>
                    {dimension.title}
                  </h3>
                  <p className="mt-2 text-gris lg:mt-3 lg:max-w-[22rem] lg:text-[1.0625rem]">
                    {dimension.text}
                  </p>
                </div>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}

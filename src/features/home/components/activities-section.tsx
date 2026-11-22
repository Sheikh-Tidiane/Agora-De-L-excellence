import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { Reveal } from "@/components/shared/motion";
import { buttonVariants } from "@/components/ui/button";
import { activities } from "@/config/activities";
import { cn } from "@/lib/utils";

/** Gradins en filigrane : aucun rang vif derrière le texte. */
const rangs = gradins(
  ["rgb(247 244 237 / 0.10)", "rgb(247 244 237 / 0.07)", "rgb(247 244 237 / 0.05)"],
  { inner: 52, step: 15 },
);

/** Les cinq activités du club : la section sombre de l'accueil. Chaque ligne mène à sa présentation. */
export function ActivitiesSection() {
  return (
    <section
      aria-labelledby="activites-titre"
      className="sur-indigo relative overflow-hidden bg-indigo text-ivoire"
    >
      {/* Les gradins sortent par le coin supérieur droit. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-[150px] -right-[210px] w-[520px] rotate-180 lg:-top-[330px] lg:-right-[200px] lg:w-[1100px]"
      >
        <Hemicycle rows={rangs} overshoot={10} />
      </div>

      <div className="page relative py-18 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-36">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            <p className="surtitre">Ce qu’on y fait</p>
            <h2 id="activites-titre" className="titre-1 mt-3 pr-16 lg:pr-0">
              Cinq activités.
            </h2>
            <p className="chapo mt-5 text-ivoire/80">
              La lecture et les jeux de l’esprit, pour donner le goût du savoir et cultiver
              l’excellence.
            </p>
            <Link
              href="/activities"
              className={cn(buttonVariants({ variant: "clair" }), "mt-7 hidden lg:inline-flex")}
            >
              Toutes les activités
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>

        <ol className="mt-10 lg:col-span-7 lg:col-start-6 lg:mt-0">
          {activities.map((activity, i) => (
            <li key={activity.slug}>
              <Reveal delay={Math.min(i, 4) * 0.05}>
                <Link
                  href={`/activities#${activity.slug}`}
                  className="group grid grid-cols-[auto_1fr] items-start gap-x-5 border-t border-ivoire/20 py-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-x-8 lg:py-8"
                >
                  <LetterTile
                    letter={activity.letter}
                    tone={i === 0 ? "clair" : "ivoire"}
                    className="text-[52px] lg:text-[72px]"
                  />
                  <span>
                    <span className="titre-2 block decoration-terracotta-clair decoration-2 underline-offset-[0.18em] group-hover:underline">
                      {activity.name}
                    </span>
                    <span className="mt-2 block text-ivoire/80 lg:max-w-[34rem]">
                      {activity.paragraphs[0]}
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="hidden size-12 place-items-center rounded-full border border-ivoire/30 transition-colors duration-200 ease-agora group-hover:bg-ivoire group-hover:text-indigo lg:grid"
                  >
                    <ArrowUpRight className="size-5" />
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ol>

        <Link
          href="/activities"
          className={cn(buttonVariants({ variant: "clair", largeur: "pleine" }), "mt-6 lg:hidden")}
        >
          Toutes les activités
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

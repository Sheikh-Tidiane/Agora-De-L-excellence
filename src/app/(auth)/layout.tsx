import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Hemicycle, type HemicycleRow } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { site } from "@/config/site";

const T = "var(--color-terracotta)";
const C = "var(--color-terracotta-clair)";
const V = "var(--color-trait)";
const I = "var(--color-indigo)";
const voile = (a: number) => `rgb(247 244 237 / ${a})`;

/** Mobile : des gradins qui attendent, une seule place prise. */
const rangsMobile: HemicycleRow[] = [
  { radius: 96, fill: V, accents: { 7: I, 15: T } },
  { radius: 111, fill: V, accents: { 4: I, 20: I } },
  { radius: 126, fill: V, accents: { 12: C } },
];

/** Desktop, sur indigo : la salle dans la pénombre, les deux premiers rangs éclairés. */
const rangsDesktop: HemicycleRow[] = [
  { radius: 52, fill: C },
  { radius: 67, fill: T },
  { radius: 82, fill: voile(0.16), accents: { 5: C, 13: voile(0.5) } },
  { radius: 97, fill: voile(0.11), accents: { 9: voile(0.4), 18: T } },
  { radius: 112, fill: voile(0.07), accents: { 3: voile(0.3), 15: C } },
  { radius: 127, fill: voile(0.05) },
];

/**
 * Pages de compte : connexion, activation, mot de passe oublié.
 * Mobile : la page et son formulaire, des gradins rognés par le bas de l'écran.
 * Desktop : le formulaire à gauche sur ivoire, la salle à droite sur indigo.
 */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex min-w-0 flex-col">
        <header className="page flex h-(--hauteur-entete) items-center justify-between gap-4 lg:h-[92px] lg:px-14!">
          <Link
            href="/"
            aria-label={`${site.name}, accueil`}
            className="flex shrink-0 items-center"
          >
            <span className="flex items-center gap-2.5 lg:hidden">
              <Image src="/logos/symbole.svg" alt="" width={36} height={36} unoptimized priority />
              <span className="font-serif text-[1.375rem] leading-none">{site.shortName}</span>
            </span>
            <Image
              src="/logos/logo-horizontal.svg"
              alt=""
              width={209}
              height={76}
              unoptimized
              priority
              className="-ml-3 hidden lg:block"
            />
          </Link>
          <Link
            href="/"
            className="-mr-2 inline-flex min-h-11 items-center gap-1.5 px-2 text-[0.9375rem] font-semibold transition-colors duration-200 hover:text-terracotta-fonce"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Retour au site
          </Link>
        </header>

        <main
          id="contenu"
          className="page flex flex-1 flex-col pt-8 pb-10 sm:pt-14 lg:justify-center lg:px-14! lg:pt-6 lg:pb-24"
        >
          <div className="w-full max-w-[27rem] sm:mx-auto lg:mx-0">{children}</div>
        </main>

        <div
          aria-hidden="true"
          className="relative h-[92px] overflow-hidden sm:h-[150px] lg:hidden"
        >
          <div className="absolute top-0 left-1/2 w-[640px] -translate-x-1/2 sm:w-[860px]">
            <Hemicycle rows={rangsMobile} overshoot={0} />
          </div>
        </div>
      </div>

      <aside
        aria-hidden="true"
        className="sur-indigo relative hidden overflow-hidden bg-indigo text-ivoire lg:block"
      >
        <div className="relative z-10 max-w-[34rem] px-16 pt-[18vh] xl:px-20">
          <p className="surtitre">
            {site.baseline} · {site.city}
          </p>
          <p className="titre-1 mt-5">
            Une place vous attend <span className="text-terracotta-clair">dans les gradins.</span>
          </p>
        </div>
        <div className="absolute -right-[18%] -bottom-[21%] w-[118%] max-w-[1080px] min-w-[760px]">
          <Hemicycle rows={rangsDesktop} overshoot={12} cascade />
          <LetterTile
            letter="A"
            tone="ivoire"
            className="absolute top-[45%] left-1/2 -translate-x-1/2 -rotate-6 text-[clamp(72px,7.5vw,112px)]"
          />
        </div>
      </aside>
    </div>
  );
}

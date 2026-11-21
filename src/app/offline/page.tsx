import type { Metadata } from "next";
import Image from "next/image";
import { Hemicycle, gradins } from "@/components/shared/hemicycle";
import { TileWord } from "@/components/shared/letter-tile";
import { site } from "@/config/site";
import { RetryButton } from "./retry-button";

export const metadata: Metadata = {
  title: "Hors ligne",
  robots: { index: false, follow: false },
};

const rangs = gradins(["var(--color-trait)", "var(--color-trait)", "var(--color-sable)"], {
  inner: 60,
  step: 15,
});

/**
 * Page servie par le service worker quand la connexion tombe pendant une navigation.
 * Autonome : ni en-tête ni pied de page, aucun lien qui mènerait à une page inaccessible.
 */
export default function OfflinePage() {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="page flex h-(--hauteur-entete) items-center gap-2.5">
        <Image src="/logos/symbole.svg" alt="" width={36} height={36} unoptimized priority />
        <span className="font-serif text-[1.375rem] leading-none">{site.shortName}</span>
      </div>
      <div className="page relative z-10 flex flex-1 flex-col justify-center pb-40">
        <TileWord word="PAUSE" tone="indigo" tileClassName="text-[44px] sm:text-[56px]" />
        <p className="surtitre mt-8">Hors ligne</p>
        <h1 className="titre-1 mt-3 max-w-[12em]">La connexion a quitté la salle.</h1>
        <p className="chapo mt-4 text-gris">
          Cette page n’a pas pu se charger. Dès que le réseau revient, reprenez là où vous en étiez.
        </p>
        <div className="mt-8">
          <RetryButton />
        </div>
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[230px] left-1/2 w-[640px] -translate-x-1/2 sm:w-[860px] lg:-right-[160px] lg:-bottom-[380px] lg:left-auto lg:w-[1000px] lg:translate-x-0"
      >
        <Hemicycle rows={rangs} overshoot={0} />
      </div>
    </main>
  );
}

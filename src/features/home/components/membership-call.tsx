import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Hemicycle, type HemicycleRow } from "@/components/shared/hemicycle";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { getClubSettings } from "@/features/settings/club";
import { formatFcfa } from "@/lib/money";
import { cn } from "@/lib/utils";

const V = "var(--color-trait)";
const I = "var(--color-indigo)";

/** Des gradins presque pleins : une seule place en terracotta, la vôtre. */
const rangs: HemicycleRow[] = [
  { radius: 46, fill: I },
  { radius: 61, fill: I, accents: { 8: "var(--color-terracotta)" } },
  { radius: 76, fill: I, accents: { 2: V, 15: V } },
  { radius: 91, fill: V, accents: { 4: I, 5: I, 11: I, 12: I, 13: I, 19: I } },
  { radius: 106, fill: V, accents: { 9: I, 10: I, 20: I } },
];

const etapes = [
  "Vous envoyez votre demande : deux minutes, sans créer de compte.",
  "Un responsable du club la lit et vous répond par e-mail.",
  "Vous recevez un lien pour activer votre espace membre.",
];

export async function MembershipCall() {
  const club = await getClubSettings();
  return (
    <section aria-labelledby="adhesion-titre" className="relative overflow-hidden">
      <div className="page relative pt-18 lg:grid lg:grid-cols-12 lg:gap-8 lg:pt-36">
        <div className="relative z-10 lg:col-span-6 lg:pb-36">
          <p className="surtitre">Adhésion</p>
          <h2
            id="adhesion-titre"
            className="titre-affiche mt-3 text-[clamp(2.5rem,1.4rem+4.8vw,5rem)]!"
          >
            Il reste une place. <span className="text-terracotta">La vôtre.</span>
          </h2>
          <ol className="mt-8 max-w-[30rem] lg:mt-10">
            {etapes.map((etape, i) => (
              <li key={etape} className="flex gap-4 border-t border-indigo/20 py-4">
                <span className="font-serif text-xl leading-7">{i + 1}</span>
                <span>{etape}</span>
              </li>
            ))}
          </ol>
          <Link
            href={membershipHref}
            className={cn(buttonVariants({ variant: "action", size: "lg" }), "mt-6 max-sm:w-full")}
          >
            Demander mon adhésion
            <ArrowRight aria-hidden="true" />
          </Link>
          <p className="petit mt-4 max-w-[28rem] text-gris">
            Carte de membre&nbsp;: {formatFcfa(club.membershipCardFee)}, versés une fois à
            l’adhésion. Participation&nbsp;: {formatFcfa(club.sessionFee)} par séance.
          </p>
        </div>

        <div className="relative -mx-5 mt-12 h-[230px] sm:h-[320px] lg:col-span-6 lg:mx-0 lg:mt-0 lg:h-auto">
          <div className="absolute top-0 left-1/2 w-[620px] -translate-x-1/2 sm:w-[820px] lg:top-auto lg:bottom-[-34%] lg:left-[52%] lg:w-[980px]">
            <Hemicycle rows={rangs} overshoot={14} />
          </div>
        </div>
      </div>
    </section>
  );
}

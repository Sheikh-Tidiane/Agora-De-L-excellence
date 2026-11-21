import type { Metadata } from "next";
import Link from "next/link";
import { Hemicycle, type HemicycleRow } from "@/components/shared/hemicycle";
import { LetterTile } from "@/components/shared/letter-tile";
import { loginHref } from "@/config/navigation";
import { getCharter } from "@/features/settings/charter";
import { formatFcfa } from "@/lib/money";
import { getClubSettings } from "@/features/settings/club";
import { MembershipForm } from "@/features/memberships/components/membership-form";
import { ByViewer, ForVisitors } from "@/components/layout/by-viewer";
import { spaceHref, type Viewer } from "@/features/auth/viewer";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Adhérer",
  description:
    "Rejoindre le club : carte de membre à 1 000 F CFA, participation de 100 F CFA par séance. Une demande en deux minutes, sans créer de compte.",
  alternates: { canonical: "/membership" },
};

const V = "var(--color-trait)";
const I = "var(--color-indigo)";
/** Des gradins presque pleins : une seule place en terracotta, la vôtre. */
const rangs: HemicycleRow[] = [
  { radius: 46, fill: I },
  { radius: 61, fill: I, accents: { 8: "var(--color-terracotta)" } },
  { radius: 76, fill: I, accents: { 2: V, 15: V } },
  { radius: 91, fill: V, accents: { 4: I, 5: I, 11: I, 12: I, 13: I, 19: I } },
];

const etapes = [
  ["Vous envoyez la demande", "Deux minutes, sans créer de compte ni choisir de mot de passe."],
  ["Un responsable la lit", "Il vous répond par e-mail, à l’adresse que vous indiquez."],
  ["Vous activez votre espace", "Un lien personnel vous permet de choisir votre mot de passe."],
];

const pratique = [
  ["Paiement", "En espèces, sur place. Rien n’est à régler en ligne."],
  ["Mineurs", "Le nom et le téléphone d’un parent ou tuteur sont demandés."],
];

function RequestForm({ charterProvisional }: { charterProvisional: boolean }) {
  return (
    <>
      <h2 className="titre-3 mt-6">Votre demande</h2>
      <p className="petit mt-1 mb-6 text-gris">
        Sauf mention contraire, tous les champs sont nécessaires.
      </p>
      <MembershipForm charterProvisional={charterProvisional} />
    </>
  );
}

/** Ce que voit un membre ou un responsable connecté à la place du formulaire. */
function AlreadyMember({ viewer }: { viewer: Exclude<Viewer, { kind: "visitor" }> }) {
  return (
    <div className="mt-6">
      <h2 className="titre-3">
        {viewer.kind === "staff"
          ? `${viewer.firstName}, vous êtes responsable du club.`
          : `${viewer.firstName}, vous êtes déjà membre.`}
      </h2>
      <p className="mt-2 text-gris">
        {viewer.kind === "member" && !viewer.cardPaid
          ? "Votre carte de membre reste à régler, en espèces, auprès d’un responsable lors d’une rencontre."
          : "Il n’y a rien à remplir ici. Votre espace réunit votre adhésion et vos inscriptions."}
      </p>
      <Link
        href={spaceHref(viewer)}
        className={cn(buttonVariants({ variant: "principal", size: "lg" }), "mt-6 max-sm:w-full")}
      >
        Mon espace
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}

export default async function MembershipPage() {
  const [club, charter] = await Promise.all([getClubSettings(), getCharter()]);
  return (
    <div className="relative overflow-hidden">
      <div className="page py-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-20">
        {/* Colonne de gauche : pourquoi et comment. Reste en vue pendant qu'on remplit. */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <LetterTile letter="A" tone="terracotta" className="text-[52px] lg:text-[72px]" />
            <p className="surtitre mt-6 lg:mt-8">Adhésion</p>
            {/* Le titre entier change selon le visiteur : le repli (un <div>) n'a pas sa place
                dans un <h1>. */}
            <ForVisitors
              signedIn={
                <h1 className="titre-1 mt-3 lg:text-[4.25rem]">
                  Votre place <span className="text-terracotta">est prise.</span>
                </h1>
              }
            >
              <h1 className="titre-1 mt-3 lg:text-[4.25rem]">
                Il reste une place. <span className="text-terracotta">La vôtre.</span>
              </h1>
            </ForVisitors>
            <p className="chapo mt-5 text-gris">
              {club.shortName} est un lieu de rencontres, d’échanges, de culture, de réflexion et de
              convivialité.
            </p>

            <ForVisitors>
              <ol className="mt-8">
                {etapes.map(([title, text], i) => (
                  <li key={title} className="flex gap-4 border-t border-indigo/20 py-4">
                    <span className="font-serif text-2xl leading-7 text-terracotta">{i + 1}</span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="petit mt-0.5 text-gris">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </ForVisitors>

            <dl className="mt-6 hidden border-t border-indigo/20 lg:block">
              {pratique.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3">
                  <dt className="petit pt-0.5 text-gris">{label}</dt>
                  <dd className="text-[0.9375rem]">{value}</dd>
                </div>
              ))}
            </dl>

            <div
              aria-hidden="true"
              className="pointer-events-none relative mt-6 hidden h-[190px] overflow-hidden lg:block"
            >
              <div className="absolute top-0 -left-16 w-[620px]">
                <Hemicycle rows={rangs} overshoot={0} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-0">
          {/* Les montants, toujours juste avant le formulaire (le QR du lancement arrive ici). */}
          <div id="demande" className="scroll-mt-20 rounded-feuille bg-sable/60 p-5 sm:p-8">
            <dl className="grid gap-x-6 gap-y-3 border-b border-indigo/20 pb-5 sm:grid-cols-2">
              {[
                ["Carte de membre", club.membershipCardFee, "une fois, à l’adhésion"],
                ["Participation", club.sessionFee, "par séance"],
              ].map(([label, amount, detail]) => (
                <div key={label} className="flex items-baseline justify-between gap-4 sm:block">
                  <dt>
                    <span className="surtitre block">{label}</span>
                    <span className="petit mt-0.5 block text-gris sm:hidden">{detail}</span>
                  </dt>
                  <dd className="sm:mt-1.5">
                    <span className="block font-serif text-[1.625rem] leading-none whitespace-nowrap sm:text-[2.25rem]">
                      {formatFcfa(amount as number)}
                    </span>
                    <span className="petit mt-1.5 block text-gris max-sm:hidden">{detail}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <ByViewer
              reserve={<RequestForm charterProvisional={charter.provisional} />}
              render={(viewer) =>
                viewer.kind === "visitor" ? (
                  <RequestForm charterProvisional={charter.provisional} />
                ) : (
                  <AlreadyMember viewer={viewer} />
                )
              }
            />
          </div>
          <ForVisitors>
            <p className="mt-6 text-gris">
              Déjà membre&nbsp;?{" "}
              <Link href={loginHref} className="lien inline-block py-2.5">
                Se connecter
              </Link>
            </p>
          </ForVisitors>
          <dl className="mt-6 border-t border-indigo/20 lg:hidden">
            {pratique.map(([label, value]) => (
              <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-4 py-3">
                <dt className="petit pt-0.5 text-gris">{label}</dt>
                <dd className="text-[0.9375rem]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}

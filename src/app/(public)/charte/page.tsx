import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/layout/page-intro";
import { buttonVariants } from "@/components/ui/button";
import { membershipHref } from "@/config/navigation";
import { getCharter } from "@/features/settings/charter";
import { getClubSettings } from "@/features/settings/club";
import { formatDate } from "@/lib/dates";
import { Markdown } from "@/lib/markdown";
import { formatFcfa } from "@/lib/money";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  title: "Charte du club",
  description:
    "Les principes que chaque membre s’engage à respecter : écoute, ponctualité, bienveillance, respect des personnes et de leur image.",
  alternates: { canonical: "/charte" },
};

export default async function CharterPage() {
  const [charter, club] = await Promise.all([getCharter(), getClubSettings()]);

  return (
    <>
      <PageIntro
        surtitre="Charte du club"
        letter="C"
        tone="indigo"
        arc="b"
        title="Ce à quoi chacun s’engage."
      >
        Adhérer à {club.shortName}, c’est accepter ces principes. Ils valent pour les rencontres
        comme pour ce que l’on publie sur la plateforme.
      </PageIntro>

      <div className="page py-12 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-24">
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-32">
            {charter.provisional ? (
              <div className="rounded-champ border-l-4 border-alerte bg-alerte-fond px-4 py-3.5">
                <p className="font-bold text-alerte">Version provisoire</p>
                <p className="mt-1 text-[0.9375rem]">
                  Ce texte reprend les principes retenus par le comité de pilotage. Le texte
                  définitif est en cours de rédaction.
                </p>
              </div>
            ) : null}
            <dl className="mt-6 border-t border-indigo/20">
              <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-indigo/20 py-3">
                <dt className="petit pt-0.5 text-gris">Version</dt>
                <dd className="font-semibold">
                  {charter.version}
                  {charter.provisional ? " (provisoire)" : ""}
                </dd>
              </div>
              {charter.updatedAt ? (
                <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-indigo/20 py-3">
                  <dt className="petit pt-0.5 text-gris">Mise à jour</dt>
                  <dd className="font-semibold">{formatDate(charter.updatedAt)}</dd>
                </div>
              ) : null}
              <div className="grid grid-cols-[7.5rem_1fr] gap-4 border-b border-indigo/20 py-3">
                <dt className="petit pt-0.5 text-gris">Cotisations</dt>
                <dd className="font-semibold">
                  Carte de membre {formatFcfa(club.membershipCardFee)}, participation{" "}
                  {formatFcfa(club.sessionFee)} par séance
                </dd>
              </div>
            </dl>
          </div>
        </aside>

        <article className="mt-10 text-[1.0625rem] lg:col-span-7 lg:col-start-6 lg:mt-0">
          <Markdown source={charter.content} />
          <div className="mt-12 border-t border-indigo/20 pt-8">
            <ForVisitors
              signedIn={
                <p className="font-semibold">
                  Vous êtes membre du club&nbsp;: vous avez accepté cette charte en adhérant.
                </p>
              }
            >
              <Link
                href={membershipHref}
                className={buttonVariants({ variant: "action", size: "lg" })}
              >
                Demander mon adhésion
                <ArrowRight aria-hidden="true" />
              </Link>
            </ForVisitors>
          </div>
        </article>
      </div>
    </>
  );
}

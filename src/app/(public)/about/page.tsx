import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageIntro } from "@/components/layout/page-intro";
import { LetterTile } from "@/components/shared/letter-tile";
import { Reveal } from "@/components/shared/motion";
import { buttonVariants } from "@/components/ui/button";
import { charterHref, membershipHref } from "@/config/navigation";
import { site } from "@/config/site";
import { initials } from "@/features/committee/schemas";
import { getCommittee } from "@/features/committee/service";
import { Dimensions } from "@/features/home/components/dimensions";
import { meetings, objectives, remoteNote } from "@/features/home/content";
import { getClubSettings } from "@/features/settings/club";
import { formatFcfa } from "@/lib/money";
import { uploadUrl } from "@/lib/storage-names";
import { cn } from "@/lib/utils";
import { ForVisitors } from "@/components/layout/by-viewer";

export const metadata: Metadata = {
  title: "Le club",
  description:
    "Les objectifs du club, ses trois dimensions, son comité de pilotage, le rythme des rencontres et les conditions d’adhésion.",
  alternates: { canonical: "/about" },
};

const avatarTones = [
  "bg-indigo text-ivoire",
  "bg-terracotta-fonce text-blanc",
  "bg-blanc text-indigo",
  "bg-terracotta-clair text-indigo",
];

export default async function AboutPage() {
  const [club, committee] = await Promise.all([getClubSettings(), getCommittee()]);

  return (
    <>
      <PageIntro
        surtitre="Le club"
        letter="A"
        arc="a"
        title="Un lieu de rencontres, d’échanges et de culture."
      >
        {club.name} est un club de lecture et de Scrabble, à {site.city}.
        {club.slogan ? ` « ${club.slogan} ».` : ""}
      </PageIntro>

      {/* Objectifs : trois lignes numérotées en tuiles, sur indigo. */}
      <section
        aria-labelledby="objectifs-titre"
        className="sur-indigo bg-indigo py-18 text-ivoire lg:py-32"
      >
        <div className="page">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="lg:col-span-5">
              <p className="surtitre">Ce que nous cherchons</p>
              <h2 id="objectifs-titre" className="titre-1 mt-3">
                Trois objectifs.
              </h2>
            </div>
            <ol className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-2">
              {objectives.map((objective, i) => (
                <li key={objective}>
                  <Reveal delay={i * 0.06}>
                    <div className="flex gap-5 border-t border-ivoire/20 py-6 lg:gap-7 lg:py-8">
                      <LetterTile
                        letter={String(i + 1)}
                        value={null}
                        tone={i === 0 ? "clair" : "ivoire"}
                        className="text-[44px] lg:text-[56px]"
                      />
                      <p className="font-serif text-[1.25rem] leading-snug lg:text-[1.625rem]">
                        {objective}
                      </p>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <Dimensions />

      {/* Comité de pilotage : les noms, et rien d'inventé autour. */}
      {committee.length > 0 ? (
        <section aria-labelledby="comite-titre" className="bg-sable py-18 lg:py-32">
          <div className="page">
            <p className="surtitre">Celles et ceux qui portent le club</p>
            <h2 id="comite-titre" className="titre-1 mt-3">
              Comité de pilotage
            </h2>
            <ul className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
              {committee.map((member, i) => (
                <li
                  key={member.id}
                  className={["lg:mt-0", "lg:mt-10", "lg:mt-20", "lg:mt-30"][i % 4]}
                >
                  <Reveal delay={Math.min(i, 4) * 0.06}>
                    <div className="flex items-center gap-5 border-t border-indigo pt-6 lg:block">
                      {member.photo ? (
                        <Image
                          src={uploadUrl(member.photo)}
                          alt=""
                          width={112}
                          height={112}
                          className="size-20 shrink-0 rounded-champ object-cover lg:size-28"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-20 shrink-0 place-items-center rounded-champ font-serif text-[1.75rem] lg:size-28 lg:text-[2.5rem]",
                            avatarTones[i % avatarTones.length],
                          )}
                        >
                          {initials(member.name)}
                        </span>
                      )}
                      <div className="min-w-0 lg:mt-6">
                        <h3 className="titre-3">{member.name}</h3>
                        {member.role ? (
                          <p className="petit mt-1 font-semibold text-terracotta-fonce">
                            {member.role}
                          </p>
                        ) : null}
                        {member.bio ? <p className="mt-2 text-gris">{member.bio}</p> : null}
                      </div>
                    </div>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* Les rencontres : deux chiffres, en grand. */}
      <section aria-labelledby="rencontres-titre" className="page py-18 lg:py-32">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <p className="surtitre">Le rythme</p>
            <h2 id="rencontres-titre" className="titre-1 mt-3">
              Les rencontres
            </h2>
            <p className="mt-5 max-w-[24rem] text-gris">{remoteNote}</p>
            <Link href="/events" className="lien mt-4 inline-flex min-h-11 items-center">
              Voir l’agenda
            </Link>
          </div>
          <dl className="mt-10 grid gap-x-8 sm:grid-cols-2 lg:col-span-7 lg:col-start-6 lg:mt-0">
            {meetings.map((meeting, i) => (
              <div key={meeting.unit} className="border-t border-indigo py-6">
                <dt className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "font-serif text-[5.5rem] leading-[0.85] lg:text-[9rem]",
                      i === 0 && "text-terracotta",
                    )}
                  >
                    {meeting.figure}
                  </span>
                  <span className="surtitre">{meeting.unit}</span>
                </dt>
                <dd className="mt-4 text-[1.0625rem]">{meeting.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Conditions d'adhésion. */}
      <section aria-labelledby="adhesion-titre" className="bg-sable py-18 lg:py-28">
        <div className="page lg:grid lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="surtitre">Adhésion</p>
            <h2 id="adhesion-titre" className="titre-1 mt-3">
              Ce que l’on règle, et quand.
            </h2>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ForVisitors>
                <Link
                  href={membershipHref}
                  className={buttonVariants({ variant: "action", size: "lg" })}
                >
                  Demander mon adhésion
                  <ArrowRight aria-hidden="true" />
                </Link>
              </ForVisitors>
              <Link
                href={charterHref}
                className={buttonVariants({ variant: "contour", size: "lg" })}
              >
                Lire la charte
              </Link>
            </div>
          </div>
          <dl className="mt-10 lg:col-span-6 lg:col-start-7 lg:mt-2">
            <div className="border-t border-indigo/30 py-6">
              <dt className="surtitre">Carte de membre</dt>
              <dd className="mt-2">
                <span className="block font-serif text-[2.5rem] leading-none lg:text-[3.25rem]">
                  {formatFcfa(club.membershipCardFee)}
                </span>
                <span className="mt-2 block text-gris">Versés une fois, à l’adhésion.</span>
              </dd>
            </div>
            <div className="border-t border-indigo/30 py-6">
              <dt className="surtitre">Participation par séance</dt>
              <dd className="mt-2">
                <span className="block font-serif text-[2.5rem] leading-none lg:text-[3.25rem]">
                  {formatFcfa(club.sessionFee)}
                </span>
                <span className="mt-2 block text-gris">
                  Une somme symbolique, pour couvrir certains besoins du club.
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </>
  );
}

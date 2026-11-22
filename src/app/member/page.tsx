import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import { buttonVariants } from "@/components/ui/button";
import { authRoutes } from "@/config/auth";
import { CardFace } from "@/features/members/components/card-face";
import {
  ReadingsSection,
  RewardsSection,
  UpcomingSection,
} from "@/features/members/components/dashboard-sections";
import { getMemberDashboard } from "@/features/members/dashboard-queries";
import { membershipState } from "@/features/memberships/status";
import { loadClubSettings } from "@/features/settings/club";
import { formatDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can, requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

/** Tableau de bord du membre : sa carte, ses rencontres, ses lectures, ses points et badges. */
async function MemberHome() {
  const user = await requirePageAccess("member.access", authRoutes.member);
  const now = new Date();
  const [data, settings] = await Promise.all([
    getMemberDashboard(user.id, now),
    loadClubSettings(),
  ]);
  const state = membershipState(data.membership, now);

  return (
    <>
      <p className="surtitre">Espace membre</p>
      <h1 className="titre-1 mt-3">Bonjour, {user.firstName}.</h1>

      <div className="mt-8 grid gap-10 lg:mt-10 lg:grid-cols-9 lg:gap-x-10">
        <div className="space-y-6 lg:col-span-4">
          <Link
            href="/member/card"
            aria-label="Afficher ma carte de membre"
            className="block rounded-[18px] transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 active:translate-y-0"
          >
            <CardFace
              fullName={user.name}
              memberNumber={user.memberNumber}
              status={
                data.card ? (
                  <Tag tone="succes">Carte réglée</Tag>
                ) : (
                  <span className="inline-flex rounded-full bg-terracotta-clair px-2.5 py-1 text-[0.75rem] font-bold text-indigo">
                    Carte à régler
                  </span>
                )
              }
            />
          </Link>
          <div className="space-y-2">
            <Link href="/member/card" className="lien inline-flex min-h-11 items-center gap-1">
              Afficher ma carte et son code QR
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            {data.card ? (
              <p className="petit text-gris">Carte réglée le {formatDate(data.card.paidAt)}.</p>
            ) : (
              <p className="petit">
                Carte de membre&nbsp;: {formatFcfa(settings.membershipCardFee)}, une fois, en
                espèces auprès d’un responsable lors d’une rencontre. Puis{" "}
                {formatFcfa(settings.sessionFee)} par séance.
              </p>
            )}
            {state.kind === "active" && state.expiresSoon ? (
              <p className="petit text-alerte">
                Votre adhésion arrive à échéance. Parlez-en à un responsable à la prochaine
                rencontre.
              </p>
            ) : null}
            {state.kind === "expired" ? (
              <p className="petit text-alerte">
                Votre adhésion est arrivée à échéance. Un responsable du club peut la renouveler.
              </p>
            ) : null}
          </div>
          <RewardsSection points={data.points} level={data.level} badges={data.badges} />
        </div>

        <div className="space-y-12 lg:col-span-5">
          <UpcomingSection
            registrations={data.registrations}
            now={now}
            cancellationDeadlineHours={settings.cancellationDeadlineHours}
          />
          <ReadingsSection readings={data.readings} />
          <Link
            href="/member/assistant"
            className="group block rounded-[18px] bg-sable p-6 transition-colors duration-200 hover:bg-blanc"
          >
            <p className="surtitre">Le Compagnon des Lettres</p>
            <p className="mt-2 font-serif text-[1.375rem] leading-snug">
              Un conseil de lecture, un mot à comprendre, un sujet de débat&nbsp;?
            </p>
            <span className="lien mt-3 inline-flex items-center gap-1">
              Demander à l’assistant
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </Link>
          {can(user, "admin.access") ? (
            <Link
              href={authRoutes.admin}
              className={cn(buttonVariants({ variant: "contour" }), "max-sm:w-full")}
            >
              Ouvrir l’administration
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default function MemberPage() {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-4 h-10 w-3/5" />
          <div className="mt-8 grid gap-10 lg:grid-cols-9">
            <div className="skeleton aspect-[1.586] w-full lg:col-span-4" />
            <div className="skeleton h-48 w-full lg:col-span-5" />
          </div>
        </div>
      }
    >
      <MemberHome />
    </Suspense>
  );
}

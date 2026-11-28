import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import { authRoutes } from "@/config/auth";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { PhotoEditor } from "@/features/members/components/photo-editor";
import { ProfileForm } from "@/features/members/components/profile-form";
import { getMembershipCardPayment } from "@/features/members/dashboard-queries";
import { getOwnProfile } from "@/features/members/profile-service";
import { membershipState, membershipStateLabels } from "@/features/memberships/status";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Mon profil" };

const tones = {
  active: "succes",
  expired: "alerte",
  suspended: "erreur",
  ended: "neutre",
  none: "neutre",
} as const;

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={id}
      className="border-t border-indigo/20 pt-6 lg:grid lg:grid-cols-9 lg:gap-10"
    >
      <h2 id={id} className="titre-3 lg:col-span-3">
        {title}
      </h2>
      <div className="mt-5 lg:col-span-6 lg:mt-0">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-indigo/15 py-3.5 first:pt-0">
      <dt className="petit text-gris">{label}</dt>
      <dd className="mt-0.5 font-semibold break-words">{children}</dd>
    </div>
  );
}

async function Profile() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/profile`);
  const now = new Date();
  const [profile, membership, card] = await Promise.all([
    getOwnProfile(user.id),
    prisma.membership.findFirst({
      where: { userId: user.id },
      orderBy: { endsAt: "desc" },
      select: { status: true, startsAt: true, endsAt: true },
    }),
    getMembershipCardPayment(user.id),
  ]);
  if (!profile) return null;
  const state = membershipState(membership, now);

  return (
    <div className="mt-10 space-y-12">
      <Block id="photo-titre" title="Photo">
        <PhotoEditor firstName={profile.firstName} image={profile.image} />
      </Block>

      <Block id="coordonnees-titre" title="Coordonnées">
        <dl>
          <Row label="Nom">{`${profile.firstName} ${profile.lastName}`}</Row>
          <Row label="Adresse e-mail (identifiant de connexion)">{profile.email}</Row>
        </dl>
        <p className="petit mt-3 text-gris">
          Une erreur dans votre nom ou votre adresse&nbsp;? Un responsable du club peut la corriger.
        </p>
        <div className="mt-8">
          <ProfileForm
            defaults={{
              phone: profile.phone ?? "",
              hiddenFromRankings: profile.hiddenFromRankings,
              eventReminders: profile.eventReminders,
              mediaConsent: profile.mediaConsentAt !== null,
            }}
          />
        </div>
      </Block>

      <Block id="adhesion-titre" title="Mon adhésion">
        <dl>
          <Row label="Statut">
            <Tag tone={tones[state.kind]}>{membershipStateLabels[state.kind]}</Tag>
          </Row>
          <Row label="Numéro de membre">{profile.memberNumber ?? "Pas encore attribué"}</Row>
          {membership ? <Row label="Membre depuis">{formatDate(membership.startsAt)}</Row> : null}
          <Row label="Carte de membre">
            {card ? `Réglée le ${formatDate(card.paidAt)}` : "À régler auprès d’un responsable"}
          </Row>
        </dl>
        <Link href="/member/card" className="lien mt-4 inline-flex min-h-11 items-center gap-1">
          Afficher ma carte de membre
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        <Link
          href="/member/notifications"
          className="lien flex min-h-11 w-fit items-center gap-1 lg:hidden"
        >
          Mes notifications
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </Block>

      <Block id="securite-titre" title="Connexion">
        <p className="text-gris">
          Pour changer de mot de passe, demandez un lien&nbsp;: il arrive par e-mail et reste
          valable une heure.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href={authRoutes.forgotPassword} className="lien inline-flex min-h-11 items-center">
            Recevoir un lien pour changer de mot de passe
          </Link>
          <SignOutButton
            variant="contour"
            size="md"
            className="max-sm:w-full"
            formClassName="sm:ml-auto lg:hidden"
          />
        </div>
      </Block>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <>
      <p className="surtitre">Profil</p>
      <h1 className="titre-1 mt-3">Mon profil</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-10 space-y-8">
            <div className="skeleton h-24 w-full" />
            <div className="skeleton h-56 w-full" />
          </div>
        }
      >
        <Profile />
      </Suspense>
    </>
  );
}

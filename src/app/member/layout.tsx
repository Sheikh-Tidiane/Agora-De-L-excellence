import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberBottomBar, MemberSideNav } from "@/components/layout/member-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { TileLoader } from "@/components/shared/states";
import { authRoutes } from "@/config/auth";
import { MemberAvatar } from "@/features/members/components/member-avatar";
import {
  MobileUnreadBanner,
  SideNotificationsLink,
} from "@/features/notifications/components/unread-link";
import { getCurrentUser, requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Espace membre", template: "%s · Espace membre" },
  robots: { index: false },
};

/**
 * Espace protégé : le rendu attend la vérification de la session, et peut se terminer par une
 * redirection. On le dit à Next.js pour qu'il ne cherche pas à en valider la navigation instantanée.
 */
export const instant = false;

/** Vérifie la session et la permission en base avant de rendre quoi que ce soit de l'espace. */
async function Gate({ children }: { children: ReactNode }) {
  await requirePageAccess("member.access", authRoutes.member);
  return children;
}

/** En tête de la colonne latérale (desktop) : qui est connecté. */
async function MemberIdentity() {
  const user = await getCurrentUser();
  if (!user) return null;
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { image: true },
  });
  return (
    <div className="mb-8">
      <MemberAvatar firstName={user.firstName} image={profile?.image ?? null} size={64} />
      <p className="mt-4 font-serif text-[1.375rem] leading-tight">{user.name}</p>
      {user.memberNumber ? (
        <p className="surtitre mt-2 text-gris">
          <span className="sr-only">Numéro de membre&nbsp;: </span>
          {user.memberNumber}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Espace membre (phase 4). Mobile : header du site + barre d'onglets fixée en bas, dans la zone
 * du pouce. Desktop : colonne latérale (identité, rubriques, carte) et contenu à droite.
 * La déconnexion est dans le header et sur la page Profil.
 */
export default function MemberLayout({ children }: LayoutProps<"/member">) {
  return (
    <>
      <a
        href="#contenu"
        className="sr-only z-50 rounded-champ bg-indigo px-4 py-3 font-semibold text-ivoire focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Aller au contenu
      </a>
      <SiteHeader />
      <div className="page flex-1 py-8 lg:grid lg:grid-cols-12 lg:gap-10 lg:py-14">
        <aside className="hidden lg:col-span-3 lg:block">
          <div className="sticky top-[124px]">
            <Suspense fallback={<div aria-hidden="true" className="skeleton mb-8 h-32 w-40" />}>
              <MemberIdentity />
            </Suspense>
            <MemberSideNav />
            <div className="mt-8 flex flex-col items-start">
              <Suspense
                fallback={<span className="inline-flex min-h-11 items-center">Notifications</span>}
              >
                <SideNotificationsLink />
              </Suspense>
              <Link href="/member/card" className="lien inline-flex min-h-11 items-center">
                Ma carte de membre
              </Link>
              <Link href="/member/rewards" className="lien inline-flex min-h-11 items-center">
                Mes récompenses
              </Link>
              <Link href="/member/assistant" className="lien inline-flex min-h-11 items-center">
                Le Compagnon des Lettres
              </Link>
            </div>
          </div>
        </aside>
        <main id="contenu" className="lg:col-span-9">
          <Suspense
            fallback={
              <div className="py-10">
                <TileLoader label="Vérification de votre accès" />
              </div>
            }
          >
            <Gate>
              <Suspense fallback={null}>
                <MobileUnreadBanner />
              </Suspense>
              {children}
            </Gate>
          </Suspense>
        </main>
      </div>
      {/* Sous 1024 px, la barre d'onglets fixe recouvrirait la fin du pied de page : on lui réserve sa place. */}
      <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <SiteFooter />
      </div>
      <MemberBottomBar />
    </>
  );
}

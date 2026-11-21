import { Suspense } from "react";
import type { Metadata } from "next";
import { TileLoader } from "@/components/shared/states";
import { visibleAdminNav } from "@/config/admin-navigation";
import { authRoutes } from "@/config/auth";
import { site } from "@/config/site";
import { AdminChrome } from "@/features/admin/components/admin-chrome";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { can, requirePageAccess } from "@/lib/permissions";
import { ROLES, isRoleCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s · Administration" },
  robots: { index: false },
};

/**
 * Espace protégé : le rendu attend la vérification de la session, et peut se terminer par une
 * redirection. On le dit à Next.js pour qu'il ne cherche pas à en valider la navigation instantanée.
 */
export const instant = false;

/** Vérifie la session et la permission en base avant de rendre quoi que ce soit de l'administration. */
async function Frame({ children }: { children: React.ReactNode }) {
  const user = await requirePageAccess("admin.access", authRoutes.admin);
  const [pendingRequests, pendingReadings] = await Promise.all([
    can(user, "memberships.review")
      ? prisma.membershipRequest.count({ where: { status: "PENDING" } })
      : 0,
    // Livres terminés à valider et critiques à modérer : une seule file pour le responsable.
    can(user, "readings.validate") || can(user, "reviews.moderate")
      ? Promise.all([
          can(user, "readings.validate")
            ? prisma.reading.count({ where: { completionStatus: "PENDING" } })
            : 0,
          can(user, "reviews.moderate") ? prisma.review.count({ where: { status: "PENDING" } }) : 0,
        ]).then(([readings, reviews]) => readings + reviews)
      : 0,
  ]);
  const roles = user.roles
    .filter((code) => code !== "member")
    .map((code) => (isRoleCode(code) ? ROLES[code].name : code));

  return (
    <AdminChrome
      groups={visibleAdminNav(user.permissions)}
      counts={{ pendingRequests, pendingReadings }}
      user={{ name: user.name, role: roles.join(", ") }}
      shortName={site.shortName}
      signOut={
        <SignOutButton
          variant="contour-clair"
          size="sm"
          className="h-10 w-full justify-start border-transparent px-3 font-normal text-ivoire/80 lg:h-8"
        />
      }
    >
      {children}
    </AdminChrome>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center">
          <TileLoader label="Vérification de votre accès" />
        </div>
      }
    >
      <Frame>{children}</Frame>
    </Suspense>
  );
}

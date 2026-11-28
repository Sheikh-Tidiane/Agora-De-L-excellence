import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/states";
import { activityLabels } from "@/config/activities";
import { ScanStation } from "@/features/attendance/components/scan-station";
import { listCheckInEvents } from "@/features/attendance/service";
import { loadClubSettings } from "@/features/settings/club";
import { formatFullDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { can, requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Scan des présences" };

/**
 * Pointage des présences à l'entrée de la rencontre du jour : carte de membre scannée,
 * ou recherche d'un inscrit en secours. Conçu d'abord pour un téléphone tenu à la porte.
 */
async function Scan() {
  const user = await requirePageAccess("attendance.record", "/admin/scan");
  const now = new Date();
  const [events, settings] = await Promise.all([listCheckInEvents(now), loadClubSettings()]);

  return (
    <>
      <AdminPageHeader title="Scan des présences">
        {formatFullDate(now)}. Scannez la carte de membre : la présence, les points et, si vous le
        cochez, la participation sont enregistrés d’un seul geste.
      </AdminPageHeader>
      {events.length === 0 ? (
        <EmptyState
          title="Aucune rencontre à pointer aujourd’hui"
          action={
            can(user, "events.manage") ? (
              <Link href="/admin/events" className={buttonVariants({ variant: "contour" })}>
                Voir les événements
              </Link>
            ) : undefined
          }
        >
          Le pointage ouvre le jour de la rencontre, pour les rencontres publiées. Une rencontre
          passée se pointe depuis sa fiche, dans les événements.
        </EmptyState>
      ) : (
        <ScanStation
          events={events.map((event) => ({
            id: event.id,
            title: event.title,
            typeLabel: activityLabels(event).join(", "),
            startsAt: event.startsAt.toISOString(),
            confirmed: event.confirmed,
            present: event.present,
          }))}
          canCollect={can(user, "payments.record")}
          sessionFee={formatFcfa(settings.sessionFee)}
          cardFee={formatFcfa(settings.membershipCardFee)}
        />
      )}
    </>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Scan />
    </Suspense>
  );
}

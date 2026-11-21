import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { TournamentsTable } from "@/features/scrabble/components/tournaments-table";
import { getAdminTournaments } from "@/features/scrabble/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Tournois de Scrabble" };

async function Tournaments() {
  await requirePageAccess("tournaments.manage", "/admin/scrabble");
  const rows = await getAdminTournaments();
  return (
    <>
      <AdminPageHeader
        title="Tournois de Scrabble"
        actions={
          <Link href="/admin/scrabble/records" className="lien inline-flex min-h-11 items-center">
            Records du club
          </Link>
        }
      >
        Joueurs, manches et scores des compétitions sur place. Les résultats ne paraissent qu’après
        validation puis publication par le responsable Scrabble.
      </AdminPageHeader>
      <TournamentsTable rows={rows} />
    </>
  );
}

export default function TournamentsAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Tournaments />
    </Suspense>
  );
}

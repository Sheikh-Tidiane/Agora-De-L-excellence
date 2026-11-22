import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { RecordsEditor } from "@/features/scrabble/components/records-editor";
import { getAdminRecords, getAdminTournaments } from "@/features/scrabble/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Records du club" };

async function Records() {
  await requirePageAccess("tournaments.manage", "/admin/scrabble/records");
  const [records, tournaments] = await Promise.all([getAdminRecords(), getAdminTournaments()]);
  return (
    <>
      <AdminPageHeader title="Records du club">
        Les records à suivre se décident en comité. Ils paraissent sur la page Scrabble du site dès
        qu’il en existe un.
      </AdminPageHeader>
      <RecordsEditor
        records={records}
        tournaments={tournaments.map((t) => ({ id: t.id, name: t.name }))}
      />
    </>
  );
}

export default function RecordsAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Records />
    </Suspense>
  );
}

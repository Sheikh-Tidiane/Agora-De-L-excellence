import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { CommitteeManager } from "@/features/committee/components/committee-manager";
import { loadCommittee } from "@/features/committee/service";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Comité de pilotage" };

async function Committee() {
  await requirePageAccess("settings.manage", "/admin/committee");
  const members = await loadCommittee();
  return (
    <>
      <AdminPageHeader title="Comité de pilotage">
        Les personnes présentées sur la page « Le club », dans cet ordre. Seul le nom est nécessaire
        : rôle, photo et biographie s’ajoutent quand ils sont connus.
      </AdminPageHeader>
      <CommitteeManager members={members} />
    </>
  );
}

export default function CommitteePage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Committee />
    </Suspense>
  );
}

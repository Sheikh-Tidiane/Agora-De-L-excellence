import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { charterHref } from "@/config/navigation";
import { loadCharter } from "@/features/settings/charter";
import { CharterForm } from "@/features/settings/components/charter-form";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Charte du club" };

async function Charter() {
  await requirePageAccess("settings.manage", "/admin/charter");
  const charter = await loadCharter();
  return (
    <>
      <AdminPageHeader
        title="Charte du club"
        actions={
          <Link
            href={charterHref}
            target="_blank"
            className={buttonVariants({ variant: "contour", size: "sm" })}
          >
            Voir la page publique
          </Link>
        }
      >
        Le règlement intérieur que chaque demandeur accepte en adhérant. La version acceptée est
        enregistrée avec sa demande.
      </AdminPageHeader>
      <CharterForm
        version={charter.version}
        initial={{ content: charter.content, provisional: charter.provisional }}
      />
    </>
  );
}

export default function CharterAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Charter />
    </Suspense>
  );
}

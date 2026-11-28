import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { loadClubSettings } from "@/features/settings/club";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Paramètres du club" };

async function Settings() {
  await requirePageAccess("settings.manage", "/admin/settings");
  const settings = await loadClubSettings();
  return (
    <>
      <AdminPageHeader title="Paramètres du club">
        Chaque modification est consignée dans le journal et paraît aussitôt sur le site.
      </AdminPageHeader>
      <SettingsForm
        initial={{
          ...settings,
          cancellationDeadlineHours: String(settings.cancellationDeadlineHours),
          membershipDurationMonths: String(settings.membershipDurationMonths),
          cardGraceDays: String(settings.cardGraceDays),
          eventReminderHour: String(settings.eventReminderHour),
        }}
      />
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Settings />
    </Suspense>
  );
}

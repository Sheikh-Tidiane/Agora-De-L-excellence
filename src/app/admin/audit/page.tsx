import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { getRecentAuditLogs } from "@/features/settings/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Journal" };

async function Journal() {
  await requirePageAccess("audit.read", "/admin/audit");
  const logs = await getRecentAuditLogs(200);
  return (
    <>
      <AdminPageHeader title="Journal">
        Les deux cents dernières actions sensibles : comptes, rôles, adhésions, suspensions,
        exports, paramètres. Les lignes ne se modifient ni ne se suppriment.
      </AdminPageHeader>
      {logs.length === 0 ? (
        <EmptyState title="Rien à signaler">Les actions sensibles s’inscriront ici.</EmptyState>
      ) : (
        <>
          <table className="hidden w-full text-left text-[0.9375rem] md:table">
            <thead>
              <tr className="border-b border-indigo/30 text-gris">
                {["Date", "Action", "Concerne", "Par"].map((header) => (
                  <th key={header} scope="col" className="py-2 pr-6 text-[0.8125rem] font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-trait">
                  <td className="py-2.5 pr-6 whitespace-nowrap text-gris tabular-nums">
                    <time dateTime={log.createdAt.toISOString()}>
                      {formatDateTime(log.createdAt)}
                    </time>
                  </td>
                  <td className="py-2.5 pr-6 font-semibold">{log.label}</td>
                  <td className="py-2.5 pr-6">{log.target}</td>
                  <td className="py-2.5 text-gris">{log.actor}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="md:hidden">
            {logs.map((log) => (
              <li key={log.id} className="border-b border-trait py-3.5">
                <p className="font-semibold">{log.label}</p>
                <p className="petit mt-0.5">
                  {log.target} <span className="text-gris">· par {log.actor}</span>
                </p>
                <p className="petit mt-0.5 text-gris tabular-nums">
                  <time dateTime={log.createdAt.toISOString()}>
                    {formatDateTime(log.createdAt)}
                  </time>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Journal />
    </Suspense>
  );
}

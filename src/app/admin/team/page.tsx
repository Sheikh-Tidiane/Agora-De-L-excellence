import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { TeamManager, type TeamRow } from "@/features/auth/components/team-manager";
import { requirePageAccess } from "@/lib/permissions";
import { ALL_ROLES, ROLES } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Équipe et rôles" };

async function Team() {
  const user = await requirePageAccess("roles.manage", "/admin/team");
  // Les comptes qui portent au moins un rôle autre que « membre ».
  const users = await prisma.user.findMany({
    where: {
      status: { not: "ARCHIVED" },
      roles: { some: { role: { code: { not: "member" } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      roles: { select: { role: { select: { code: true } } } },
    },
  });
  const rows: TeamRow[] = users.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    status: member.status as TeamRow["status"],
    roles: member.roles.map(({ role }) => role.code),
    isSelf: member.id === user.id,
  }));

  return (
    <>
      <AdminPageHeader title="Équipe et rôles">
        Les comptes des responsables. Chaque rôle n’ouvre que les rubriques dont il a besoin ; toute
        attribution est consignée au journal.
      </AdminPageHeader>
      <TeamManager
        rows={rows}
        roles={ALL_ROLES.map((code) => ({
          code,
          name: ROLES[code].name,
          description: ROLES[code].description,
          staff: code !== "member",
        }))}
      />
    </>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Team />
    </Suspense>
  );
}

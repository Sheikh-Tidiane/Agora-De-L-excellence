import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { MembersTable, type MemberRow } from "@/features/members/components/members-table";
import { membershipState } from "@/features/memberships/status";
import { loadClubSettings } from "@/features/settings/club";
import { can, requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Membres" };

async function Members({ searchParams }: Pick<PageProps<"/admin/members">, "searchParams">) {
  const user = await requirePageAccess("members.read", "/admin/members");
  const { open } = await searchParams;
  const now = new Date();
  const { membershipCardFee } = await loadClubSettings();
  const users = await prisma.user.findMany({
    where: { status: { not: "ARCHIVED" }, roles: { some: { role: { code: "member" } } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 2000,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      memberNumber: true,
      status: true,
      createdAt: true,
      memberships: {
        orderBy: { endsAt: "desc" },
        select: { status: true, endsAt: true },
      },
      payments: {
        where: { kind: "MEMBERSHIP_CARD", cancelledAt: null },
        take: 1,
        select: { id: true, amount: true, paidAt: true, receivedBy: { select: { name: true } } },
      },
      _count: { select: { registrations: { where: { status: "CONFIRMED" } } } },
    },
  });

  const rows: MemberRow[] = users.map((member) => {
    const last = member.memberships[0] ?? null;
    const membership = membershipState(last, now);
    const state: MemberRow["state"] =
      member.status === "SUSPENDED"
        ? "suspended"
        : member.status === "PENDING_ACTIVATION"
          ? "pending"
          : membership.kind === "active"
            ? "active"
            : membership.kind === "expired"
              ? "expired"
              : membership.kind === "suspended"
                ? "suspended"
                : "none";
    return {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      phone: member.phone,
      memberNumber: member.memberNumber,
      state,
      joinedAt: member.createdAt,
      endsAt: last?.endsAt ?? null,
      card: member.payments[0]
        ? {
            paymentId: member.payments[0].id,
            amount: member.payments[0].amount,
            paidAt: member.payments[0].paidAt,
            receivedBy: member.payments[0].receivedBy?.name ?? null,
          }
        : null,
      periods: member.memberships.length,
      registrations: member._count.registrations,
      isSelf: member.id === user.id,
    };
  });

  return (
    <>
      <AdminPageHeader title="Membres">
        Les comptes nés d’une adhésion validée. Ouvrez une ligne pour consulter la fiche, encaisser
        la carte, renouveler, suspendre ou archiver.
      </AdminPageHeader>
      <MembersTable
        rows={rows}
        canManage={can(user, "members.manage")}
        canRecordPayment={can(user, "payments.record")}
        cardFee={membershipCardFee}
        initialOpenId={typeof open === "string" ? open : undefined}
      />
    </>
  );
}

export default function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Members searchParams={searchParams} />
    </Suspense>
  );
}

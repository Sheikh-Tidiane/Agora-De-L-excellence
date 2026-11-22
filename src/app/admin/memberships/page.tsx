import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { RequestsTable, type RequestRow } from "@/features/memberships/components/requests-table";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Demandes d’adhésion" };

async function Requests({ searchParams }: Pick<PageProps<"/admin/memberships">, "searchParams">) {
  await requirePageAccess("memberships.review", "/admin/memberships");
  const { open } = await searchParams;
  const requests = await prisma.membershipRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { reviewedBy: { select: { name: true } } },
  });
  const rows: RequestRow[] = requests.map((request) => ({
    id: request.id,
    firstName: request.firstName,
    lastName: request.lastName,
    email: request.email,
    phone: request.phone,
    ageRange: request.ageRange,
    occupation: request.occupation,
    interests: request.interests,
    motivation: request.motivation,
    guardianName: request.guardianName,
    guardianPhone: request.guardianPhone,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reviewerName: request.reviewedBy?.name ?? null,
    rejectionReason: request.rejectionReason,
  }));

  return (
    <>
      <AdminPageHeader title="Demandes d’adhésion">
        Valider une demande crée le compte du membre, lui attribue un numéro et lui envoie son lien
        d’activation.
      </AdminPageHeader>
      <RequestsTable rows={rows} initialOpenId={typeof open === "string" ? open : undefined} />
    </>
  );
}

export default function MembershipRequestsPage({ searchParams }: PageProps<"/admin/memberships">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Requests searchParams={searchParams} />
    </Suspense>
  );
}

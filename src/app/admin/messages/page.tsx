import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { MessagesTable, type MessageRow } from "@/features/contact/components/messages-table";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Messages" };

async function Messages({ searchParams }: Pick<PageProps<"/admin/messages">, "searchParams">) {
  await requirePageAccess("contact.manage", "/admin/messages");
  const { open } = await searchParams;
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { handledBy: { select: { name: true } } },
  });
  const rows: MessageRow[] = messages.map((message) => ({
    id: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: message.status,
    emailSent: message.emailSent,
    createdAt: message.createdAt,
    handledAt: message.handledAt,
    handlerName: message.handledBy?.name ?? null,
  }));

  return (
    <>
      <AdminPageHeader title="Messages">
        Les messages envoyés depuis la page Contact du site. Répondez par e-mail, puis marquez-les
        comme traités : ils sont supprimés douze mois plus tard.
      </AdminPageHeader>
      <MessagesTable rows={rows} initialOpenId={typeof open === "string" ? open : undefined} />
    </>
  );
}

export default function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Messages searchParams={searchParams} />
    </Suspense>
  );
}

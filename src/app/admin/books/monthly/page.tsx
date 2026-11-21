import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import {
  SelectionManager,
  type SelectionRow,
} from "@/features/library/components/selection-manager";
import { formatShortDate, monthStart } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Livre du mois" };

async function Monthly() {
  await requirePageAccess("books.manage", "/admin/books/monthly");
  const now = new Date();
  const thisMonth = monthStart(now);
  const [selections, books, events] = await Promise.all([
    prisma.monthlySelection.findMany({
      orderBy: { month: "desc" },
      take: 36,
      include: {
        book: { select: { title: true } },
        event: { select: { title: true } },
      },
    }),
    prisma.book.findMany({
      where: { archivedAt: null },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
    prisma.event.findMany({
      where: { archivedAt: null, status: { not: "CANCELLED" }, startsAt: { gte: thisMonth } },
      orderBy: { startsAt: "asc" },
      take: 60,
      select: { id: true, title: true, startsAt: true },
    }),
  ]);
  // La sélection affichée sur le site : la plus récente dont le mois a commencé.
  const currentId = selections.find((s) => s.month.getTime() <= thisMonth.getTime())?.id;

  const rows: SelectionRow[] = selections.map((selection) => ({
    id: selection.id,
    month: selection.month,
    monthValue: selection.month.toISOString().slice(0, 7),
    bookId: selection.bookId,
    bookTitle: selection.book.title,
    eventId: selection.eventId,
    eventTitle: selection.event?.title ?? null,
    note: selection.note,
    current: selection.id === currentId,
  }));

  return (
    <>
      <AdminPageHeader title="Livre du mois">
        Le livre mis en scène sur l’accueil et lu par tout le club. Une sélection par mois.
      </AdminPageHeader>
      <SelectionManager
        rows={rows}
        books={books.map((book) => ({ value: book.id, label: book.title }))}
        events={events.map((event) => ({
          value: event.id,
          label: `${formatShortDate(event.startsAt)} · ${event.title}`,
        }))}
        defaultMonth={thisMonth.toISOString().slice(0, 7)}
      />
    </>
  );
}

export default function MonthlyPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Monthly />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { QuizzesTable, type QuizRow } from "@/features/quizzes/components/quizzes-table";
import { listQuizzesForAdmin } from "@/features/quizzes/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Quiz" };

async function Quizzes() {
  await requirePageAccess("quizzes.manage", "/admin/quizzes");
  const quizzes = await listQuizzesForAdmin({ includeArchived: true });
  const rows: QuizRow[] = quizzes.map((quiz) => ({
    id: quiz.id,
    title: quiz.title,
    phase: quiz.phase,
    archived: quiz.archivedAt !== null,
    opensAt: quiz.opensAt,
    closesAt: quiz.closesAt,
    durationMinutes: quiz.durationMinutes,
    questionCount: quiz.questionCount,
    attemptCount: quiz.attemptCount,
    eventTitle: quiz.event?.title ?? null,
  }));
  return (
    <>
      <AdminPageHeader title="Quiz">
        Questionnaires à jouer sur téléphone, une question par écran, chronométrés par le serveur.
        Un quiz terminé rapporte des points à chaque participant, quel que soit son score.
      </AdminPageHeader>
      <QuizzesTable rows={rows} />
    </>
  );
}

export default function QuizzesAdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Quizzes />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { QuizPreview } from "@/features/quizzes/components/quiz-preview";
import { getQuizPreview } from "@/features/quizzes/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Aperçu du quiz" };

async function Preview({ params }: Pick<PageProps<"/admin/quizzes/[id]/preview">, "params">) {
  const { id } = await params;
  await requirePageAccess("quizzes.manage", `/admin/quizzes/${id}/preview`);
  const quiz = await getQuizPreview(id);
  if (!quiz) notFound();
  return (
    <>
      <AdminPageHeader
        title={quiz.title}
        actions={
          <Link
            href={`/admin/quizzes/${quiz.id}`}
            className="lien inline-flex min-h-11 items-center"
          >
            Retour à la fiche
          </Link>
        }
      >
        {quiz.durationMinutes} minutes pour {quiz.questionCount} questions. Le membre voit les
        propositions dans un ordre mélangé, propre à sa tentative.
      </AdminPageHeader>
      {quiz.questions.length === 0 ? (
        <EmptyState title="Rien à prévisualiser">
          Ajoutez au moins une question depuis la fiche du quiz.
        </EmptyState>
      ) : (
        <QuizPreview questions={quiz.questions} />
      )}
    </>
  );
}

export default function QuizPreviewPage({ params }: PageProps<"/admin/quizzes/[id]/preview">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Preview params={params} />
    </Suspense>
  );
}

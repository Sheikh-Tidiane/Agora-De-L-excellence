import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { QuestionList } from "@/features/quizzes/components/question-list";
import { QuizPublication } from "@/features/quizzes/components/quiz-publication";
import { QuizSettingsForm } from "@/features/quizzes/components/quiz-settings-form";
import { getQuizForAdmin, listGeniesEvents } from "@/features/quizzes/queries";
import { formatDate, toLocalDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Quiz" };

/** Fiche d'un quiz : réglages et questions à gauche, publication à droite (desktop d'abord). */
async function QuizEditor({ params }: Pick<PageProps<"/admin/quizzes/[id]">, "params">) {
  const { id } = await params;
  await requirePageAccess("quizzes.manage", `/admin/quizzes/${id}`);
  const isNew = id === "new";
  const [quiz, events] = await Promise.all([
    isNew ? null : getQuizForAdmin(id),
    listGeniesEvents(),
  ]);
  if (!isNew && !quiz) notFound();

  const eventOptions = events.map((event) => ({
    id: event.id,
    title: event.title,
    when: formatDate(event.startsAt),
  }));
  // La rencontre déjà liée reste proposée, même passée depuis longtemps.
  if (quiz?.event && !eventOptions.some((event) => event.id === quiz.event!.id)) {
    eventOptions.unshift({
      id: quiz.event.id,
      title: quiz.event.title,
      when: formatDate(quiz.event.startsAt),
    });
  }
  const published = quiz ? quiz.status !== "DRAFT" : false;

  const form = (
    <QuizSettingsForm
      quizId={quiz?.id}
      events={eventOptions}
      initial={{
        title: quiz?.title ?? "",
        instructions: quiz?.instructions ?? "",
        durationMinutes: quiz?.durationMinutes ?? 10,
        opensAt: toLocalDateTime(quiz?.opensAt),
        closesAt: toLocalDateTime(quiz?.closesAt),
        eventId: quiz?.event?.id ?? "",
        slug: quiz?.slug ?? "",
      }}
      locked={
        quiz && (published || quiz.archivedAt)
          ? {
              duration: true,
              opensAt: true,
              slug: true,
              closesAt: quiz.status !== "PUBLISHED",
            }
          : undefined
      }
    />
  );

  if (!quiz) {
    return (
      <>
        <AdminPageHeader title="Nouveau quiz">
          Il est créé en brouillon : vous ajoutez les questions, vous le relisez dans l’aperçu, puis
          vous le publiez.
        </AdminPageHeader>
        <div className="max-w-[44rem]">{form}</div>
      </>
    );
  }

  return (
    <>
      <AdminPageHeader title={quiz.title}>
        {quiz.can.editContent
          ? "Brouillon : tout se modifie encore. Les membres ne le voient qu’une fois publié."
          : "Publié : durée, ouverture, adresse et questions sont figées. Titre, consigne et rencontre se modifient encore."}
      </AdminPageHeader>
      <div className="grid gap-10 xl:grid-cols-12 xl:gap-12">
        <div className="space-y-12 xl:col-span-8">
          <section aria-labelledby="reglages-titre">
            <h2 id="reglages-titre" className="titre-3 mb-5">
              Réglages
            </h2>
            {form}
          </section>
          <section aria-labelledby="questions-titre">
            <h2 id="questions-titre" className="titre-3 mb-5">
              Questions
            </h2>
            <QuestionList
              quizId={quiz.id}
              editable={quiz.can.editContent}
              questions={quiz.questions}
            />
          </section>
        </div>
        <aside className="xl:col-span-4">
          <div className="xl:sticky xl:top-24">
            <QuizPublication
              quizId={quiz.id}
              phase={quiz.phase}
              archived={quiz.archivedAt !== null}
              attemptCount={quiz.attemptCount}
              questionCount={quiz.questions.length}
              problems={quiz.problems}
              can={quiz.can}
            />
          </div>
        </aside>
      </div>
    </>
  );
}

export default function QuizEditorPage({ params }: PageProps<"/admin/quizzes/[id]">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <QuizEditor params={params} />
    </Suspense>
  );
}

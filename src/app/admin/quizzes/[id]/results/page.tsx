import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { formatDuration, plural } from "@/features/quizzes/components/labels";
import { getQuizResults } from "@/features/quizzes/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Résultats du quiz" };

const percent = (rate: number | null) => (rate === null ? "—" : `${Math.round(rate * 100)} %`);

async function Results({ params }: Pick<PageProps<"/admin/quizzes/[id]/results">, "params">) {
  const { id } = await params;
  await requirePageAccess("quizzes.manage", `/admin/quizzes/${id}/results`);
  const results = await getQuizResults(id);
  if (!results) notFound();

  return (
    <>
      <AdminPageHeader
        title={`Résultats · ${results.quiz.title}`}
        actions={
          <Link
            href={`/admin/quizzes/${results.quiz.id}`}
            className="lien inline-flex min-h-11 items-center"
          >
            Retour à la fiche
          </Link>
        }
      >
        {plural(results.finishedCount, "tentative terminée", "tentatives terminées")}
        {results.inProgressCount > 0 ? `, ${results.inProgressCount} en cours` : ""}. Classement au
        score, puis à la durée.
      </AdminPageHeader>

      {results.finishedCount === 0 ? (
        <EmptyState title="Personne n’a encore terminé">
          Les résultats apparaissent dès qu’un membre termine sa tentative.
        </EmptyState>
      ) : (
        <div className="grid gap-12 xl:grid-cols-12">
          <section aria-labelledby="classement-titre" className="xl:col-span-7">
            <h2 id="classement-titre" className="titre-3">
              Classement
            </h2>
            <table className="mt-4 w-full text-left text-[0.9375rem]">
              <thead className="border-b border-indigo/25 text-gris">
                <tr>
                  <th scope="col" className="w-12 py-2 font-semibold">
                    Rang
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Membre
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Score
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold max-sm:hidden">
                    Durée
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold max-lg:hidden">
                    Terminé le
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.attempts.map((attempt) => (
                  <tr key={attempt.attemptId} className="border-b border-indigo/10">
                    <td className="py-2.5 font-serif text-lg tabular-nums">{attempt.rank}</td>
                    <td className="py-2.5">
                      <span className="font-semibold">
                        {attempt.firstName} {attempt.lastName}
                      </span>
                      {attempt.memberNumber ? (
                        <span className="petit block text-gris">{attempt.memberNumber}</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums">
                      {attempt.score}/{attempt.maxScore}
                    </td>
                    <td className="py-2.5 text-right tabular-nums max-sm:hidden">
                      {formatDuration(attempt.durationSeconds)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums max-lg:hidden">
                      {formatDateTime(attempt.finishedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="questions-titre" className="xl:col-span-5">
            <h2 id="questions-titre" className="titre-3">
              Réussite par question
            </h2>
            <ol className="mt-4 border-b border-indigo/20">
              {results.questions.map((question) => (
                <li key={question.id} className="border-t border-indigo/20 py-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-semibold">
                      {question.number}. {question.prompt}
                    </p>
                    <p className="shrink-0 font-serif text-xl tabular-nums">
                      {percent(question.successRate)}
                    </p>
                  </div>
                  <div
                    aria-hidden="true"
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo/10"
                  >
                    <div
                      className="h-full rounded-full bg-terracotta"
                      style={{ width: `${Math.round((question.successRate ?? 0) * 100)}%` }}
                    />
                  </div>
                  <ul className="petit mt-2 space-y-0.5 text-gris">
                    {question.choices.map((choice) => (
                      <li
                        key={choice.id}
                        className={cn(choice.isCorrect && "font-semibold text-succes")}
                      >
                        {choice.label} · {choice.picks}
                        {choice.isCorrect ? " (bonne réponse)" : ""}
                      </li>
                    ))}
                    {question.skipped + question.unanswered > 0 ? (
                      <li>Passée ou sans réponse · {question.skipped + question.unanswered}</li>
                    ) : null}
                  </ul>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}

export default function QuizResultsPage({ params }: PageProps<"/admin/quizzes/[id]/results">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Results params={params} />
    </Suspense>
  );
}

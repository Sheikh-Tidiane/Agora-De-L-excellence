import { Suspense } from "react";
import type { Metadata } from "next";
import { RankList } from "@/components/shared/rank-list";
import { authRoutes } from "@/config/auth";
import { OpenQuizCard, QuizRow } from "@/features/quizzes/components/quiz-cards";
import { getGeneralQuizRanking, listQuizzesForMember } from "@/features/quizzes/queries";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Quiz" };

async function Quizzes() {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/quiz`);
  const [lists, ranking] = await Promise.all([
    listQuizzesForMember(user.id),
    getGeneralQuizRanking({ viewerId: user.id }),
  ]);
  const { open, upcoming, ended } = lists;
  const viewer = ranking.viewer;
  const viewerInTop = ranking.top.some((row) => row.isViewer);

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
      <div className="space-y-12 lg:col-span-5">
        <section aria-labelledby="ouverts-titre">
          <h2 id="ouverts-titre" className="titre-3">
            À jouer maintenant
          </h2>
          {open.length === 0 ? (
            <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
              Aucun quiz ouvert en ce moment. Vous recevez une notification dès qu’un nouveau est
              publié.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {open.map((quiz) => (
                <OpenQuizCard key={quiz.id} quiz={quiz} />
              ))}
            </div>
          )}
        </section>

        {upcoming.length > 0 ? (
          <section aria-labelledby="bientot-titre">
            <h2 id="bientot-titre" className="titre-3">
              Bientôt
            </h2>
            <ul className="mt-4 border-b border-indigo/20">
              {upcoming.map((quiz) => (
                <QuizRow key={quiz.id} quiz={quiz} />
              ))}
            </ul>
          </section>
        ) : null}

        {ended.length > 0 ? (
          <section aria-labelledby="termines-titre">
            <h2 id="termines-titre" className="titre-3">
              Terminés
            </h2>
            <p className="petit mt-1 text-gris">Le corrigé s’ouvre quand le quiz est clos.</p>
            <ul className="mt-4 border-b border-indigo/20">
              {ended.map((quiz) => (
                <QuizRow key={quiz.id} quiz={quiz} />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <section aria-labelledby="classement-quiz-titre" className="lg:col-span-4">
        <h2 id="classement-quiz-titre" className="titre-3">
          Classement des quiz
        </h2>
        <p className="petit mt-1 text-gris">Le total des bonnes réponses, tous quiz confondus.</p>
        <RankList
          rows={ranking.top.map((row) => ({
            key: row.userId,
            rank: row.rank,
            name: `${row.firstName} ${row.lastNameInitial}`,
            isViewer: row.isViewer,
            value: String(row.correctAnswers),
          }))}
          empty="Personne n’a encore terminé de quiz."
          viewerNote={
            viewer && !viewerInTop
              ? viewer.hidden
                ? "Vous avez choisi de ne pas apparaître dans les classements (réglable dans votre profil)."
                : viewer.rank
                  ? `Votre position : ${viewer.rank}e, avec ${viewer.correctAnswers} bonnes réponses en ${viewer.quizzes} quiz.`
                  : null
              : null
          }
          footnote="Visible des seuls membres connectés : prénom et initiale du nom."
        />
      </section>
    </div>
  );
}

export default function MemberQuizzesPage() {
  return (
    <>
      <p className="surtitre">Génies du soir</p>
      <h1 className="titre-1 mt-3">Les quiz de l’Agora</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 space-y-4">
            <div className="skeleton h-48 w-full max-w-xl" />
            <div className="skeleton h-20 w-full max-w-xl" />
          </div>
        }
      >
        <Quizzes />
      </Suspense>
    </>
  );
}

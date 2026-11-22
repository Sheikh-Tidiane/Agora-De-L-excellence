import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, X } from "lucide-react";
import { RankList } from "@/components/shared/rank-list";
import { authRoutes } from "@/config/auth";
import { formatDuration, plural } from "@/features/quizzes/components/labels";
import { QuizPlayer } from "@/features/quizzes/components/quiz-player";
import { StartQuizButton } from "@/features/quizzes/components/start-quiz-button";
import {
  getMemberQuizScreen,
  getQuizRanking,
  type MemberQuizScreen,
  type QuizCorrection,
} from "@/features/quizzes/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Quiz" };

const blockerText = {
  members_only: "Les quiz sont réservés aux membres du club, avec un numéro de membre.",
  upcoming: "Ce quiz n’est pas encore ouvert.",
  ended: "Ce quiz est terminé : vous ne l’avez pas joué.",
  no_question: "Ce quiz n’a pas encore de question.",
} as const;

function Intro({ screen }: { screen: MemberQuizScreen }) {
  const { quiz, view } = screen;
  if (view.kind !== "intro") return null;
  return (
    <div className="max-w-[40rem]">
      <dl className="mt-6 grid grid-cols-3 gap-4 border-y border-indigo/20 py-5">
        <div>
          <dt className="petit text-gris">Questions</dt>
          <dd className="font-serif text-[2rem] leading-none tabular-nums">{quiz.questionCount}</dd>
        </div>
        <div>
          <dt className="petit text-gris">Durée</dt>
          <dd className="font-serif text-[2rem] leading-none tabular-nums">
            {quiz.durationMinutes}
            <span className="text-lg"> min</span>
          </dd>
        </div>
        <div>
          <dt className="petit text-gris">Tentative</dt>
          <dd className="font-serif text-[2rem] leading-none">1</dd>
        </div>
      </dl>
      {quiz.instructions ? <p className="mt-6 text-[1.0625rem]">{quiz.instructions}</p> : null}
      <ul className="mt-6 space-y-2 text-gris">
        <li>Une question par écran, sans retour en arrière.</li>
        <li>Le chrono part au premier écran et ne s’arrête pas si vous quittez la page.</li>
        <li>Une question passée compte comme fausse.</li>
      </ul>
      <p className="petit mt-4 text-gris">
        Ouvert du {formatDateTime(quiz.opensAt)} au {formatDateTime(quiz.closesAt)}.
      </p>
      <div className="mt-8">
        {view.canStart ? (
          <StartQuizButton quizId={quiz.id} minutes={quiz.durationMinutes} />
        ) : (
          <p className="rounded-champ bg-sable px-4 py-3 font-semibold">
            {blockerText[view.blocker ?? "ended"]}
          </p>
        )}
      </div>
    </div>
  );
}

function Correction({ correction }: { correction: QuizCorrection }) {
  const outcome = {
    correct: "Bonne réponse",
    wrong: "Mauvaise réponse",
    skipped: "Passée",
    unanswered: "Sans réponse",
  } as const;
  return (
    <section aria-labelledby="corrige-titre" className="mt-12">
      <h2 id="corrige-titre" className="titre-3">
        Le corrigé
      </h2>
      <ol className="mt-4 border-b border-indigo/20">
        {correction.map((question) => (
          <li key={question.number} className="border-t border-indigo/20 py-5">
            <p className="petit font-semibold text-gris">
              Question {question.number} · {outcome[question.outcome]}
            </p>
            <p className="mt-1 font-serif text-lg leading-snug">{question.prompt}</p>
            <ul className="mt-3 space-y-1">
              {question.choices.map((choice) => (
                <li
                  key={choice.id}
                  className={cn(
                    "flex items-start gap-2 text-[0.9375rem]",
                    choice.isCorrect ? "font-semibold text-succes" : "text-gris",
                    choice.chosen && !choice.isCorrect && "text-erreur",
                  )}
                >
                  {choice.isCorrect ? (
                    <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  ) : choice.chosen ? (
                    <X aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  ) : (
                    <span aria-hidden="true" className="w-4 shrink-0" />
                  )}
                  <span>
                    {choice.label}
                    {choice.chosen ? <span className="font-normal"> (votre choix)</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

async function Finished({ screen, userId }: { screen: MemberQuizScreen; userId: string }) {
  if (screen.view.kind !== "finished") return null;
  const { result } = screen.view;
  const ranking = await getQuizRanking({ quizId: screen.quiz.id, viewerId: userId });
  const viewerInTop = ranking.top.some((row) => row.isViewer);
  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
      <div className="lg:col-span-5">
        <section
          aria-labelledby="score-titre"
          className="rounded-[18px] bg-indigo p-6 text-ivoire sm:p-7"
        >
          <h2
            id="score-titre"
            className="text-[0.75rem] font-bold tracking-[0.16em] text-terracotta-clair uppercase"
          >
            Votre score
          </h2>
          <p className="mt-3 font-serif text-[4rem] leading-none tabular-nums">
            {result.score}
            <span className="text-[2rem] text-ivoire/70">/{result.maxScore}</span>
          </p>
          <p className="mt-3 text-ivoire/80">En {formatDuration(result.durationSeconds)}.</p>
          <Link
            href="/member/rewards"
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-terracotta-clair underline-offset-4 hover:underline"
          >
            Voir mes récompenses
          </Link>
        </section>
        {result.correction ? (
          <Correction correction={result.correction} />
        ) : (
          <p className="mt-6 text-gris">
            Le corrigé s’ouvrira à la clôture du quiz, le {formatDateTime(screen.quiz.closesAt)},
            pour que chacun joue à armes égales.
          </p>
        )}
      </div>
      <section aria-labelledby="classement-titre" className="lg:col-span-4">
        <h2 id="classement-titre" className="titre-3">
          Classement du quiz
        </h2>
        <p className="petit mt-1 text-gris">
          {plural(ranking.participants, "participant", "participants")} · au score, puis à la durée.
        </p>
        <RankList
          rows={ranking.top.map((row) => ({
            key: row.userId,
            rank: row.rank,
            name: `${row.firstName} ${row.lastNameInitial}`,
            isViewer: row.isViewer,
            value: `${row.score}/${ranking.maxScore}`,
            detail: formatDuration(row.durationSeconds),
          }))}
          empty="Le classement apparaît dès les premières tentatives terminées."
          viewerNote={
            ranking.viewer && !viewerInTop
              ? ranking.viewer.hidden
                ? "Vous avez choisi de ne pas apparaître dans les classements (réglable dans votre profil)."
                : ranking.viewer.rank
                  ? `Votre position : ${ranking.viewer.rank}e.`
                  : null
              : null
          }
          footnote="Visible des seuls membres connectés : prénom et initiale du nom."
        />
      </section>
    </div>
  );
}

async function QuizScreen({ params }: Pick<PageProps<"/member/quiz/[slug]">, "params">) {
  const { slug } = await params;
  const user = await requirePageAccess("member.access", `${authRoutes.member}/quiz/${slug}`);
  const screen = await getMemberQuizScreen(user.id, slug);
  if (!screen) notFound();
  const { view } = screen;

  if (view.kind === "playing") {
    return (
      <>
        <h1 className="sr-only">{screen.quiz.title}</h1>
        <QuizPlayer
          key={view.state.question.id}
          initial={{
            attemptId: view.state.attemptId,
            remainingSeconds: view.state.remainingSeconds,
            question: view.state.question,
          }}
        />
      </>
    );
  }

  return (
    <>
      <Link href="/member/quiz" className="lien inline-flex min-h-11 items-center">
        Tous les quiz
      </Link>
      <p className="surtitre mt-4">{screen.quiz.event?.title ?? "Génies du soir"}</p>
      <h1 className="titre-1 mt-3">{screen.quiz.title}</h1>
      {view.kind === "intro" ? <Intro screen={screen} /> : null}
      {view.kind === "finished" ? <Finished screen={screen} userId={user.id} /> : null}
    </>
  );
}

export default function MemberQuizPage({ params }: PageProps<"/member/quiz/[slug]">) {
  return (
    <Suspense
      fallback={
        <div aria-hidden="true" className="max-w-[40rem]">
          <div className="skeleton h-3 w-32" />
          <div className="skeleton mt-4 h-10 w-4/5" />
          <div className="skeleton mt-8 h-56 w-full" />
        </div>
      }
    >
      <QuizScreen params={params} />
    </Suspense>
  );
}

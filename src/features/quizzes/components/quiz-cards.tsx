import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "@/components/shared/event-row";
import { plural } from "@/features/quizzes/components/labels";
import type { MemberQuizItem } from "@/features/quizzes/queries";
import { formatDateTime, formatShortDate } from "@/lib/dates";

export const quizHref = (slug: string) => `/member/quiz/${slug}`;

/** Quiz ouvert, mis en avant : carte indigo, l'action dans la zone du pouce. */
export function OpenQuizCard({ quiz }: { quiz: MemberQuizItem }) {
  const attempt = quiz.attempt;
  const cta =
    attempt?.status === "finished"
      ? "Voir mon résultat"
      : attempt?.status === "in_progress"
        ? "Reprendre"
        : "Commencer";
  return (
    <article className="group relative overflow-hidden rounded-[18px] bg-indigo p-6 text-ivoire sm:p-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -bottom-10 font-serif text-[11rem] leading-none text-ivoire/[0.06] select-none"
      >
        ?
      </span>
      <p className="text-[0.75rem] font-bold tracking-[0.16em] text-terracotta-clair uppercase">
        Ouvert jusqu’au {formatDateTime(quiz.closesAt)}
      </p>
      <h3 className="mt-3 font-serif text-[1.75rem] leading-tight">
        <Link href={quizHref(quiz.slug)} className="after:absolute after:inset-0">
          {quiz.title}
        </Link>
      </h3>
      <p className="mt-2 text-ivoire/80">
        {plural(quiz.questionCount, "question", "questions")} · {quiz.durationMinutes}&nbsp;min
        {quiz.event ? ` · ${quiz.event.title}` : ""}
      </p>
      {attempt?.status === "finished" ? (
        <p className="mt-4 font-serif text-[2.25rem] leading-none tabular-nums">
          {attempt.score}
          <span className="text-[1.25rem] text-ivoire/70">/{attempt.maxScore}</span>
        </p>
      ) : null}
      <span className="mt-6 inline-flex h-12 items-center gap-2 rounded-champ bg-ivoire px-5 font-semibold text-indigo transition-colors duration-200 group-hover:bg-blanc">
        {cta}
        <ArrowRight aria-hidden="true" className="size-4" />
      </span>
    </article>
  );
}

/** Ligne d'un quiz à venir ou terminé. */
export function QuizRow({ quiz }: { quiz: MemberQuizItem }) {
  const attempt = quiz.attempt;
  return (
    <li className="group relative flex items-center gap-4 border-t border-indigo/20 py-4">
      <div className="min-w-0 flex-1">
        <p className="petit font-semibold text-gris">
          {quiz.phase === "upcoming"
            ? `Ouvre le ${formatDateTime(quiz.opensAt)}`
            : `Clos le ${formatShortDate(quiz.closesAt)}`}
        </p>
        <p className="mt-0.5 font-serif text-lg leading-snug">
          {quiz.phase === "upcoming" ? (
            quiz.title
          ) : (
            <Link
              href={quizHref(quiz.slug)}
              className="decoration-terracotta underline-offset-4 group-hover:underline after:absolute after:inset-0"
            >
              {quiz.title}
            </Link>
          )}
        </p>
      </div>
      {attempt?.status === "finished" ? (
        <span className="font-serif text-xl tabular-nums">
          {attempt.score}/{attempt.maxScore}
        </span>
      ) : quiz.phase === "ended" ? (
        <Tag>Non joué</Tag>
      ) : null}
    </li>
  );
}

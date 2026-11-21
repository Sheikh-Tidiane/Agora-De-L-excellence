"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import {
  archiveQuizAction,
  closeQuizAction,
  deleteQuizAction,
  publishQuizAction,
  unpublishQuizAction,
} from "@/features/quizzes/actions";
import { phaseLabels, phaseTones, plural } from "@/features/quizzes/components/labels";
import type { QuizPhase } from "@/features/quizzes/rules";

type Can = {
  publish: boolean;
  unpublish: boolean;
  close: boolean;
  archive: boolean;
  delete: boolean;
};

/**
 * Colonne « Publication » de la fiche d'un quiz : état, ce qui empêche de publier, et les gestes
 * permis à cet instant (calculés par le serveur). Les gestes définitifs demandent confirmation.
 */
export function QuizPublication({
  quizId,
  phase,
  archived,
  attemptCount,
  questionCount,
  problems,
  can,
}: {
  quizId: string;
  phase: QuizPhase;
  archived: boolean;
  attemptCount: number;
  questionCount: number;
  problems: string[];
  can: Can;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAdminAction();

  const confirmThen = (message: string, action: () => void) => {
    if (window.confirm(message)) action();
  };

  return (
    <section aria-labelledby="publication-titre" className="rounded-[16px] bg-blanc p-5 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="publication-titre" className="font-serif text-xl">
          Publication
        </h2>
        {archived ? (
          <StatusPill tone="neutre">Archivé</StatusPill>
        ) : (
          <StatusPill tone={phaseTones[phase]}>{phaseLabels[phase]}</StatusPill>
        )}
      </div>
      <p className="petit mt-2 text-gris">
        {plural(questionCount, "question", "questions")} ·{" "}
        {plural(attemptCount, "participant", "participants")}
      </p>

      {problems.length > 0 ? (
        <div className="mt-4 rounded-champ bg-alerte-fond p-3">
          <p className="petit font-semibold text-alerte">Avant de publier&nbsp;:</p>
          <ul className="petit mt-1 list-disc space-y-0.5 pl-5 text-indigo">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2">
        {phase === "draft" ? (
          <Button
            variant="action"
            disabled={pending || !can.publish}
            onClick={() =>
              confirmThen(
                "Publier ce quiz ? Les membres seront prévenus, et durée, ouverture et questions ne pourront plus changer.",
                () =>
                  void run(() => publishQuizAction({ quizId }), {
                    success: (data) =>
                      data.notified > 0
                        ? `Quiz publié, ${plural(data.notified, "membre prévenu", "membres prévenus")}.`
                        : "Quiz publié.",
                  }),
              )
            }
          >
            Publier
          </Button>
        ) : null}
        {can.unpublish ? (
          <Button
            variant="contour"
            disabled={pending}
            onClick={() =>
              void run(() => unpublishQuizAction({ quizId }), {
                success: "Repassé en brouillon.",
              })
            }
          >
            Repasser en brouillon
          </Button>
        ) : null}
        {can.close ? (
          <Button
            variant="contour"
            disabled={pending}
            onClick={() =>
              confirmThen(
                "Clore ce quiz ? Les tentatives en cours seront terminées et le corrigé deviendra visible.",
                () =>
                  void run(() => closeQuizAction({ quizId }), {
                    success: (data) =>
                      data.finalized > 0
                        ? `Quiz clos, ${plural(data.finalized, "tentative terminée", "tentatives terminées")}.`
                        : "Quiz clos.",
                  }),
              )
            }
          >
            Clore maintenant
          </Button>
        ) : null}
        {can.archive ? (
          <Button
            variant="contour"
            disabled={pending}
            onClick={() =>
              void run(() => archiveQuizAction({ quizId }), { success: "Quiz archivé." })
            }
          >
            Archiver
          </Button>
        ) : null}
        {can.delete ? (
          <Button
            variant="discret"
            className="text-erreur"
            disabled={pending}
            onClick={() =>
              confirmThen(
                "Supprimer ce quiz et ses questions ? C’est définitif.",
                () =>
                  void run(() => deleteQuizAction({ quizId }), {
                    success: "Quiz supprimé.",
                    onSuccess: () => router.push("/admin/quizzes"),
                  }),
              )
            }
          >
            Supprimer
          </Button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col border-t border-indigo/15 pt-3">
        <Link
          href={`/admin/quizzes/${quizId}/preview`}
          className="lien inline-flex min-h-11 items-center gap-1"
        >
          Aperçu côté membre
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
        {phase !== "draft" ? (
          <Link
            href={`/admin/quizzes/${quizId}/results`}
            className="lien inline-flex min-h-11 items-center gap-1"
          >
            Résultats
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>
      {toast}
    </section>
  );
}

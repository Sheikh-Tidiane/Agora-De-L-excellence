"use client";

import { useState } from "react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  invalidateResultsAction,
  publishResultsAction,
  validateResultsAction,
} from "@/features/scrabble/actions";
import { formatDateTime } from "@/lib/dates";

/**
 * Validation puis publication des résultats (responsable Scrabble). Valider fige les rangs et
 * attribue les points de victoire ; publier rend le classement public et prévient les joueurs.
 * Dévalider (motif obligatoire) reprend les points et retire la publication.
 */
export function ResultsPanel({
  tournamentId,
  canPublishResults,
  canValidate,
  missingScores,
  validatedAt,
  validatedBy,
  publishedAt,
}: {
  tournamentId: string;
  /** Permission `results.publish`. */
  canPublishResults: boolean;
  canValidate: boolean;
  missingScores: number;
  validatedAt: Date | null;
  validatedBy: string | null;
  publishedAt: Date | null;
}) {
  const { run, pending, toast } = useAdminAction();
  const [reason, setReason] = useState("");
  const [undoing, setUndoing] = useState(false);

  return (
    <section aria-labelledby="resultats-titre" className="rounded-[16px] bg-blanc p-5 lg:p-6">
      <h2 id="resultats-titre" className="font-serif text-xl">
        Résultats
      </h2>
      <ol className="mt-4 space-y-3">
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className={
              validatedAt
                ? "mt-1 size-2.5 shrink-0 rounded-full bg-succes"
                : "mt-1 size-2.5 shrink-0 rounded-full bg-indigo/20"
            }
          />
          <p className="petit">
            <span className="font-semibold">Validation.</span>{" "}
            {validatedAt
              ? `Faite le ${formatDateTime(validatedAt)}${validatedBy ? ` par ${validatedBy}` : ""}.`
              : missingScores > 0
                ? `${missingScores} score${missingScores > 1 ? "s" : ""} manquant${missingScores > 1 ? "s" : ""}.`
                : "Les rangs seront figés et les points de victoire attribués."}
          </p>
        </li>
        <li className="flex gap-3">
          <span
            aria-hidden="true"
            className={
              publishedAt
                ? "mt-1 size-2.5 shrink-0 rounded-full bg-succes"
                : "mt-1 size-2.5 shrink-0 rounded-full bg-indigo/20"
            }
          />
          <p className="petit">
            <span className="font-semibold">Publication.</span>{" "}
            {publishedAt
              ? `Le ${formatDateTime(publishedAt)} : le classement est public.`
              : "Le classement paraît sur le site et les joueurs sont prévenus."}
          </p>
        </li>
      </ol>

      {!canPublishResults ? (
        <p className="petit mt-4 text-gris">Réservé au responsable Scrabble.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-2">
          {!validatedAt ? (
            <Button
              variant="principal"
              disabled={pending || !canValidate}
              onClick={() => {
                if (!window.confirm("Valider les résultats ? Les rangs seront figés.")) return;
                void run(() => validateResultsAction({ tournamentId }), {
                  success: "Résultats validés.",
                });
              }}
            >
              Valider les résultats
            </Button>
          ) : null}
          {validatedAt && !publishedAt ? (
            <Button
              variant="action"
              disabled={pending}
              onClick={() =>
                void run(() => publishResultsAction({ tournamentId }), {
                  success: (data) =>
                    data.notified > 0
                      ? `Résultats publiés, ${data.notified} joueur${data.notified > 1 ? "s" : ""} prévenu${data.notified > 1 ? "s" : ""}.`
                      : "Résultats publiés.",
                })
              }
            >
              Publier les résultats
            </Button>
          ) : null}
          {validatedAt && !undoing ? (
            <Button variant="contour" disabled={pending} onClick={() => setUndoing(true)}>
              Dévalider pour corriger
            </Button>
          ) : null}
          {undoing ? (
            <form
              className="space-y-3 border-t border-indigo/15 pt-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => invalidateResultsAction({ tournamentId, reason }), {
                  success: "Résultats dévalidés : corrigez, puis validez à nouveau.",
                  onSuccess: () => {
                    setUndoing(false);
                    setReason("");
                  },
                });
              }}
            >
              <Field
                id="devalider-motif"
                label="Motif"
                hint="Les points de victoire sont repris, la publication retirée."
              >
                <Input
                  id="devalider-motif"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={pending || reason.trim().length < 3}>
                  Dévalider
                </Button>
                <Button type="button" size="sm" variant="contour" onClick={() => setUndoing(false)}>
                  Annuler
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      )}
      {toast}
    </section>
  );
}

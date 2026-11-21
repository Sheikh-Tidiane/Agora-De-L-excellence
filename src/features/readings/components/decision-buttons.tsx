"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { decideReadingAction, decideReviewAction } from "@/features/readings/actions";

/**
 * Valider ou refuser (avec un mot pour le membre) un « livre terminé » ou une critique.
 * Le refus ouvre un champ sur place : on ne quitte pas la file.
 */
export function DecisionButtons({
  id,
  kind,
  label,
  version,
}: {
  id: string;
  kind: "reading" | "review";
  /** Pour les lecteurs d'écran : « la lecture de Awa D., L'Aventure ambiguë ». */
  label: string;
  /** Critique : date ISO de la version affichée (la décision ne vaut que pour elle). */
  version?: string;
}) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const decide = (decision: "approve" | "reject") =>
    start(async () => {
      setError(undefined);
      const result =
        kind === "reading"
          ? await decideReadingAction({ id, decision, note })
          : await decideReviewAction({ id, decision, note, version: version ?? "" });
      if (!result.ok) {
        setError(result.fieldErrors?.note ?? result.message);
        return;
      }
      setDone(decision === "approve" ? "Validée." : "Refusée, le membre verra votre mot.");
      router.refresh();
    });

  if (done) {
    return (
      <p role="status" className="petit font-semibold text-succes">
        {done}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {rejecting ? (
        <div>
          <label htmlFor={`note-${id}`} className="mb-1.5 block text-[0.9375rem] font-semibold">
            Pourquoi&nbsp;? <span className="font-normal text-gris">(le membre lira ce mot)</span>
          </label>
          <Textarea
            id={`note-${id}`}
            rows={3}
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <Button
              size="sm"
              variant="principal"
              disabled={pending}
              onClick={() => decide("reject")}
            >
              {pending ? "Envoi…" : "Confirmer le refus"}
            </Button>
            <Button
              size="sm"
              variant="discret"
              disabled={pending}
              onClick={() => setRejecting(false)}
            >
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="principal"
              disabled={pending}
              aria-label={`Valider ${label}`}
              onClick={() => decide("approve")}
            >
              <Check aria-hidden="true" />
              {pending ? "Validation…" : "Valider"}
            </Button>
            <Button
              size="sm"
              variant="contour"
              disabled={pending}
              aria-label={`Refuser ${label}`}
              onClick={() => setRejecting(true)}
            >
              <X aria-hidden="true" />
              Refuser
            </Button>
          </>
        )}
      </div>
      {error ? (
        <p role="alert" className="petit font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

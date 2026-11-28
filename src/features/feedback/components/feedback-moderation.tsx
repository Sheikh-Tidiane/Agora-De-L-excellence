"use client";

import { useState } from "react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import {
  hideFeedbackCommentAction,
  restoreFeedbackCommentAction,
} from "@/features/feedback/actions";

/** Masquer (motif obligatoire, consigné au journal) ou rétablir le commentaire d'un avis. */
export function FeedbackModeration({
  id,
  version,
  hidden,
}: {
  id: string;
  version: string;
  hidden: boolean;
}) {
  const { run, toast, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (hidden) {
    return (
      <div className="mt-3">
        <Button
          variant="contour"
          size="sm"
          disabled={pending}
          onClick={() =>
            void run(() => restoreFeedbackCommentAction({ id, version }), {
              success: "Commentaire rétabli.",
            })
          }
        >
          Rétablir le commentaire
        </Button>
        {toast}
      </div>
    );
  }
  return (
    <div className="mt-3">
      {open ? (
        <form
          noValidate
          className="flex max-w-[32rem] flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(() => hideFeedbackCommentAction({ id, reason, version }), {
              success: "Commentaire masqué. Le masquage est consigné au journal.",
              onSuccess: () => setOpen(false),
            });
          }}
        >
          <Field
            id={`motif-${id}`}
            label="Motif du masquage"
            hint="Par exemple : propos contraires à la charte. Le membre ne pourra plus modifier son commentaire."
          >
            <Input
              id={`motif-${id}`}
              value={reason}
              maxLength={300}
              minLength={3}
              required
              autoFocus
              autoComplete="off"
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Masquer le commentaire
            </Button>
            <Button variant="contour" size="sm" onClick={() => setOpen(false)}>
              Annuler
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="contour" size="sm" onClick={() => setOpen(true)}>
          Masquer ce commentaire
        </Button>
      )}
      {toast}
    </div>
  );
}

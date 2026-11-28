"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { FormError, FormNotice } from "@/features/auth/components/form-parts";
import { saveFeedbackAction } from "@/features/feedback/actions";
import { COMMENT_MAX } from "@/features/feedback/rules";
import { cn } from "@/lib/utils";

const labels = ["Décevante", "Moyenne", "Bien", "Très bien", "Excellente"];

/**
 * Avis sur une rencontre : note de 1 à 5 (boutons radio, utilisables au clavier) et commentaire
 * facultatif. Le même formulaire sert à modifier l'avis tant que la fenêtre est ouverte.
 */
export function FeedbackForm({
  eventId,
  initial,
  commentLocked,
  closesAt,
}: {
  eventId: string;
  initial: { rating: number; comment: string } | null;
  /** Commentaire masqué par un responsable : il ne peut plus être modifié. */
  commentLocked: boolean;
  closesAt: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(initial?.rating ?? null);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [errors, setErrors] = useState<{ rating?: string; comment?: string; form?: string }>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        if (rating === null) {
          setErrors({ rating: "Choisissez une note de 1 à 5." });
          return;
        }
        setErrors({});
        startTransition(async () => {
          const result = await saveFeedbackAction({ eventId, rating, comment });
          if (result.ok) {
            setSaved(true);
            router.refresh();
          } else {
            setErrors({
              rating: result.fieldErrors?.rating,
              comment: result.fieldErrors?.comment,
              form: result.fieldErrors ? undefined : result.message,
            });
          }
        });
      }}
    >
      <FormError message={errors.form} />
      <fieldset
        aria-required="true"
        aria-describedby={errors.rating ? "avis-note-erreur" : undefined}
      >
        <legend className="mb-3 text-[0.9375rem] font-semibold">Votre note</legend>
        <div className="grid grid-cols-5 gap-2">
          {labels.map((label, index) => {
            const value = index + 1;
            const checked = rating === value;
            return (
              <label
                key={value}
                className={cn(
                  "flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-champ border px-1 py-2 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-terracotta-fonce",
                  checked ? "border-indigo bg-indigo text-ivoire" : "border-indigo/25 bg-blanc",
                )}
              >
                <input
                  type="radio"
                  name="note"
                  value={value}
                  checked={checked}
                  onChange={() => {
                    setRating(value);
                    setErrors((current) => ({ ...current, rating: undefined }));
                  }}
                  className="sr-only"
                  aria-label={`${value} sur 5 : ${label}`}
                />
                <span className="font-serif text-[1.75rem] leading-none tabular-nums">{value}</span>
                <span className="text-[0.75rem] leading-tight max-sm:hidden">{label}</span>
              </label>
            );
          })}
        </div>
        {errors.rating ? (
          <p id="avis-note-erreur" role="alert" className="petit mt-2 font-semibold text-erreur">
            {errors.rating}
          </p>
        ) : null}
      </fieldset>

      <Field
        id="avis-commentaire"
        label="Votre commentaire"
        optional
        error={errors.comment}
        hint={
          commentLocked
            ? "Votre commentaire a été masqué par un responsable : il ne peut plus être modifié. Vous pouvez encore changer votre note."
            : `Facultatif, ${COMMENT_MAX} caractères au plus (${comment.length} / ${COMMENT_MAX}). Lu par les seuls responsables, dans le respect de la charte.`
        }
      >
        <Textarea
          id="avis-commentaire"
          rows={5}
          value={comment}
          maxLength={COMMENT_MAX}
          disabled={commentLocked}
          onChange={(event) => setComment(event.target.value)}
        />
      </Field>
      <p className="petit -mt-3 text-gris">
        Dans l’esprit de la{" "}
        <Link href="/charte" className="lien">
          charte du club
        </Link>{" "}
        : critiquer les idées, jamais les personnes.
      </p>

      {saved ? (
        <FormNotice>Merci ! Votre avis est enregistré. Modifiable jusqu’au {closesAt}.</FormNotice>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="action"
          size="lg"
          disabled={pending}
          className="max-sm:w-full"
        >
          {pending ? "Enregistrement…" : initial ? "Modifier mon avis" : "Envoyer mon avis"}
        </Button>
      </div>
    </form>
  );
}

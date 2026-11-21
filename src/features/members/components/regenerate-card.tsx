"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { regenerateMyCardAction } from "@/features/members/card-actions";

/**
 * Remplacer sa carte (téléphone perdu, capture partagée) : en deux temps, car l'ancien QR
 * cesse aussitôt d'être accepté au pointage.
 */
export function RegenerateCard() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "succes" | "erreur"; text: string }>();

  const regenerate = () =>
    start(async () => {
      const result = await regenerateMyCardAction({ confirm: true });
      setConfirming(false);
      if (result.ok) {
        setMessage({
          tone: "succes",
          text: "Nouvelle carte émise. L’ancien code n’est plus accepté.",
        });
        router.refresh();
      } else {
        setMessage({ tone: "erreur", text: result.message });
      }
    });

  return (
    <div>
      {confirming ? (
        <div className="rounded-champ bg-alerte-fond p-4">
          <p className="petit font-semibold text-alerte">
            L’ancien code QR (et ses captures d’écran) ne sera plus accepté. Continuer&nbsp;?
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="principal" disabled={pending} onClick={regenerate}>
              {pending ? "Émission…" : "Oui, remplacer ma carte"}
            </Button>
            <Button
              size="sm"
              variant="discret"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              Annuler
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="contour"
          onClick={() => {
            setMessage(undefined);
            setConfirming(true);
          }}
        >
          Remplacer ma carte
        </Button>
      )}
      <p aria-live="polite" className="petit mt-2 font-semibold">
        {message ? (
          <span className={message.tone === "succes" ? "text-succes" : "text-erreur"}>
            {message.text}
          </span>
        ) : null}
      </p>
    </div>
  );
}

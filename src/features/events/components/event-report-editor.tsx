"use client";

import { useState } from "react";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { saveEventReportAction } from "@/features/events/admin-actions";
import { Markdown } from "@/lib/markdown";

/**
 * Compte rendu d'une rencontre passée : rédaction en Markdown, aperçu tel qu'il paraîtra,
 * enregistrement en brouillon ou publication.
 */
export function EventReportEditor({
  eventId,
  initial,
  published,
}: {
  eventId: string;
  initial: string;
  published: boolean;
}) {
  const { run, pending, toast } = useAdminAction();
  const [content, setContent] = useState(initial);
  const [preview, setPreview] = useState(false);
  const save = (publish: boolean) =>
    void run(() => saveEventReportAction({ eventId, content, publish }), {
      success: (data) =>
        data.published
          ? "Compte rendu publié : il paraît sur la page de la rencontre et dans les archives."
          : "Compte rendu enregistré. Il n’est pas visible du public.",
    });

  return (
    <div className="max-w-[52rem]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <StatusPill tone={published ? "succes" : "neutre"}>
          {published ? "Publié" : initial ? "Brouillon" : "Pas encore rédigé"}
        </StatusPill>
        <div role="tablist" aria-label="Affichage" className="flex rounded-champ bg-sable p-1">
          {[
            ["Rédaction", false],
            ["Aperçu", true],
          ].map(([label, value]) => (
            <button
              key={String(label)}
              type="button"
              role="tab"
              aria-selected={preview === value}
              onClick={() => setPreview(value as boolean)}
              className={
                preview === value
                  ? "h-9 rounded-[7px] bg-blanc px-3.5 text-[0.9375rem] font-semibold"
                  : "h-9 rounded-[7px] px-3.5 text-[0.9375rem] font-semibold text-gris"
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <div className="min-h-64 rounded-champ bg-blanc p-5 text-[1.0625rem]">
          {content.trim() ? (
            <Markdown source={content} lettrine />
          ) : (
            <p className="text-gris">Rien à afficher pour l’instant.</p>
          )}
        </div>
      ) : (
        <>
          <label htmlFor="compte-rendu" className="sr-only">
            Compte rendu
          </label>
          <Textarea
            id="compte-rendu"
            rows={14}
            maxLength={20000}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            aria-describedby="compte-rendu-aide"
          />
          <p id="compte-rendu-aide" className="petit mt-1.5 text-gris">
            Markdown : « ## » pour un intertitre, « - » pour une liste, **gras**, *italique*. Ne
            publiez une photo d’un membre qu’avec son accord.
          </p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="action" disabled={pending || !content.trim()} onClick={() => save(true)}>
          {published ? "Mettre à jour la publication" : "Publier le compte rendu"}
        </Button>
        <Button variant="contour" disabled={pending} onClick={() => save(false)}>
          {published ? "Dépublier (repasser en brouillon)" : "Enregistrer le brouillon"}
        </Button>
      </div>
      {toast}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { BookCover, RECOMMENDED_COVER_SIZE } from "@/components/shared/book-cover";
import { Button } from "@/components/ui/button";
import { uploadUrl, type ImageFolder } from "@/lib/storage-names";

const { width: W, height: H } = RECOMMENDED_COVER_SIZE;

/**
 * Couverture d'un livre (ou portrait du comité) : téléversement immédiat vers le serveur (qui
 * vérifie le type et la taille), aperçu, retrait. L'aperçu d'une couverture utilise le composant
 * du site (`BookCover`) : cadre 2:3, recadrage centré. On voit donc exactement ce qui paraîtra.
 * Sans image, le site affiche la couverture typographique générée.
 */
export function CoverUpload({
  value,
  onChange,
  folder = "covers",
  label = "Couverture",
  emptyLabel = "Générée",
  square = false,
  preview,
}: {
  value: string;
  onChange: (name: string) => void;
  /** Dossier de stockage ; le serveur exige la permission correspondante. */
  folder?: ImageFolder;
  label?: string;
  /** Texte de la vignette quand aucune image n'est choisie (portrait). */
  emptyLabel?: string;
  /** Vignette carrée (portrait du comité) au lieu du format couverture. */
  square?: boolean;
  /** Titre et auteur du livre : l'aperçu montre la couverture générée tant qu'il n'y a pas d'image. */
  preview?: { title: string; author: string; category?: string };
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>();

  const upload = async (file: File) => {
    setError(undefined);
    setDimensions(undefined);
    if (file.size > 2 * 1024 * 1024) {
      setError("L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
      return;
    }
    if (!square && "createImageBitmap" in window) {
      // Proportions lues dans le navigateur, pour prévenir d'un recadrage (rien n'est bloqué).
      const bitmap = await createImageBitmap(file).catch(() => null);
      if (bitmap) {
        setDimensions({ width: bitmap.width, height: bitmap.height });
        bitmap.close();
      }
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/admin/uploads?folder=${folder}`, { method: "POST", body });
      const result = (await response.json()) as { ok: boolean; name?: string; message?: string };
      if (result.ok && result.name) onChange(result.name);
      else setError(result.message ?? "Le téléversement a échoué.");
    } catch {
      setError("Le téléversement a échoué. Vérifiez votre connexion.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  // Écart au ratio 2:3 au-delà de 4 % : l'image sera visiblement rognée en haut et en bas, ou sur les côtés.
  const cropped = dimensions && Math.abs(dimensions.height / dimensions.width / (H / W) - 1) > 0.04;
  const small = dimensions && dimensions.width < W / 2;

  return (
    <div>
      <p className="mb-1.5 text-[0.9375rem] font-semibold">
        {label} <span className="font-normal text-gris">(facultatif)</span>
      </p>
      <div className="flex items-start gap-4">
        {square ? (
          <div className="relative size-20 shrink-0 overflow-hidden rounded-champ bg-sable">
            {value ? (
              <Image
                src={uploadUrl(value)}
                alt="Image téléversée"
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <span className="petit absolute inset-0 grid place-items-center px-1 text-center text-gris">
                {emptyLabel}
              </span>
            )}
          </div>
        ) : (
          <div className="w-24 shrink-0">
            <BookCover
              title={preview?.title || "Titre du livre"}
              author={preview?.author || "Auteur"}
              category={preview?.category}
              image={value || null}
              sizes="96px"
            />
          </div>
        )}
        <div className="min-w-0">
          <input
            ref={input}
            id={`${folder}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="contour"
              size="sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? "Envoi…" : value ? "Remplacer l’image" : "Choisir une image"}
            </Button>
            {value ? (
              <Button
                variant="discret"
                size="sm"
                onClick={() => {
                  setDimensions(undefined);
                  onChange("");
                }}
              >
                Retirer
              </Button>
            ) : null}
          </div>
          <p className="petit mt-2 text-gris">
            {square ? (
              <>JPEG, PNG ou WebP, 2&nbsp;Mo au plus.</>
            ) : (
              <>
                Format 2:3, idéalement {W}&nbsp;×&nbsp;{H}&nbsp;px. JPEG, PNG ou WebP, 2&nbsp;Mo au
                plus. Une autre proportion est recadrée au centre, comme dans l’aperçu.
              </>
            )}{" "}
            Une image dont le club a le droit de se servir.
          </p>
          {dimensions && (cropped || small) ? (
            <p role="status" className="petit mt-1.5 font-semibold text-alerte">
              Image de {dimensions.width}&nbsp;×&nbsp;{dimensions.height}&nbsp;px
              {cropped
                ? " : elle n’est pas au format 2:3, vérifiez le recadrage dans l’aperçu"
                : ""}
              {small
                ? `${cropped ? " ;" : " :"} elle risque d’être floue (${W} px de large conseillés)`
                : ""}
              .
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="petit mt-1.5 font-semibold text-erreur">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

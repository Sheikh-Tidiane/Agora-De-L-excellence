"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/features/members/components/member-avatar";

/**
 * Photo de profil, facultative : envoi immédiat (le serveur vérifie le type, la taille et
 * renomme le fichier), aperçu, retrait. Elle n'est visible que des personnes connectées.
 */
export function PhotoEditor({ firstName, image }: { firstName: string; image: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();

  const send = async (init: RequestInit, success: string) => {
    setError(undefined);
    setDone(undefined);
    setBusy(true);
    try {
      const response = await fetch("/api/member/photo", init);
      const result = (await response.json()) as { ok: boolean; message?: string };
      if (!result.ok) {
        setError(result.message ?? "L’opération a échoué.");
        return;
      }
      setDone(success);
      startRefresh(() => router.refresh());
    } catch {
      setError("L’envoi a échoué. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const upload = (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      setError("L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    void send({ method: "POST", body }, "Photo enregistrée.");
  };

  const pending = busy || refreshing;

  return (
    <div className="flex items-start gap-5">
      <MemberAvatar firstName={firstName} image={image} size={88} />
      <div className="min-w-0">
        <input
          ref={input}
          id="photo-profil"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-describedby="photo-aide"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="contour"
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? "Envoi…" : image ? "Changer de photo" : "Ajouter une photo"}
          </Button>
          {image ? (
            <Button
              variant="discret"
              size="sm"
              disabled={pending}
              onClick={() => void send({ method: "DELETE" }, "Photo retirée.")}
            >
              Retirer
            </Button>
          ) : null}
        </div>
        <p id="photo-aide" className="petit mt-2 text-gris">
          Facultative. JPEG, PNG ou WebP, 2&nbsp;Mo au plus. Visible des seuls membres et
          responsables connectés, jamais sur le site public.
        </p>
        <p aria-live="polite" className="petit mt-1.5 font-semibold">
          {error ? <span className="text-erreur">{error}</span> : null}
          {done && !error ? <span className="text-succes">{done}</span> : null}
        </p>
      </div>
    </div>
  );
}

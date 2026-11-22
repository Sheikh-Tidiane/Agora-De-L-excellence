"use client";

import { useEffect, useId, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { searchRegistrants, type RegistrantMatch } from "@/features/attendance/components/scan-api";
import { cn } from "@/lib/utils";

/**
 * Secours sans caméra : chercher un inscrit (nom, prénom ou numéro), ou coller le texte du QR
 * lu par une autre application. Le code est vérifié par le serveur exactement comme un scan.
 */
export function ManualCheckIn({
  eventId,
  busy,
  refreshKey,
  onPickMember,
  onToken,
}: {
  eventId: string;
  busy: boolean;
  /** Change après chaque pointage : la liste se relit (présences à jour). */
  refreshKey: number;
  onPickMember: (match: RegistrantMatch) => void;
  onToken: (token: string) => void;
}) {
  const searchId = useId();
  const tokenId = useId();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<RegistrantMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchRegistrants(eventId, q, controller.signal)
        .then((result) => {
          if (result.ok) {
            setMatches(result.matches);
            setError(null);
          } else setError(result.message);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [eventId, query, refreshKey]);

  const shown = query.trim().length >= 2 ? matches : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <label htmlFor={searchId} className="font-semibold">
          Chercher un inscrit
        </label>
        <p className="petit mt-0.5 text-gris">Nom, prénom ou numéro de membre.</p>
        <div className="relative mt-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-gris"
          />
          <input
            id={searchId}
            type="search"
            inputMode="search"
            autoComplete="off"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ex. Diallo ou AE-2026-0012"
            className="h-12 w-full rounded-champ border border-indigo/25 bg-blanc pr-3 pl-11 text-base outline-none focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20"
          />
        </div>
        {error ? (
          <p role="alert" className="petit mt-2 text-erreur">
            {error}
          </p>
        ) : null}
        {shown ? (
          shown.length === 0 ? (
            <p role="status" className="petit mt-3 text-gris">
              Aucun inscrit confirmé ne correspond. Un membre non inscrit ne peut pas être pointé.
            </p>
          ) : (
            <ul
              className="mt-3 divide-y divide-trait border-y border-trait"
              aria-label="Inscrits trouvés"
            >
              {shown.map((match) => (
                <li
                  key={match.userId}
                  className="flex min-h-16 items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {match.firstName} {match.lastName}
                    </p>
                    <p className="petit text-gris tabular-nums">
                      {match.memberNumber ?? "Sans numéro"}
                    </p>
                  </div>
                  {match.present ? (
                    <span className="petit inline-flex h-11 items-center gap-1.5 px-2 font-semibold text-succes">
                      <Check aria-hidden="true" className="size-4" /> Présent
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="contour"
                      disabled={busy}
                      onClick={() => onPickMember(match)}
                      aria-label={`Pointer ${match.firstName} ${match.lastName}`}
                    >
                      Pointer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>

      <details className="group border-t border-trait pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
          Coller le code d’une carte
          <span aria-hidden="true" className="text-gris transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <form
          className="mt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (token.trim()) onToken(token.trim());
          }}
        >
          <label htmlFor={tokenId} className="petit text-gris">
            Si cette caméra ne lit pas le QR code, une autre application de lecture peut en extraire
            le texte (il commence par « A1. ») : collez-le ici, il est vérifié comme un scan.
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id={tokenId}
              type="text"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              className={cn(
                "h-12 min-w-0 flex-1 rounded-champ border border-indigo/25 bg-blanc px-3 font-mono text-[0.9375rem] outline-none",
                "focus-visible:border-indigo focus-visible:ring-2 focus-visible:ring-indigo/20",
              )}
            />
            <Button type="submit" variant="principal" disabled={busy || token.trim() === ""}>
              Vérifier et pointer
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}

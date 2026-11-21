"use client";

import { ErrorState } from "@/components/shared/states";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="page flex flex-1 flex-col justify-center py-16">
      <h1 className="titre-1">Un contretemps.</h1>
      <ErrorState className="mt-8 max-w-xl" title="La page n’a pas pu s’afficher">
        Ce n’est pas de votre fait. Réessayez ; si le problème persiste, revenez un peu plus tard.
      </ErrorState>
      <div className="mt-6">
        <Button onClick={reset} className="max-sm:w-full">
          Réessayer
        </Button>
      </div>
    </main>
  );
}

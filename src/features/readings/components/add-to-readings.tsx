"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addReadingAction } from "@/features/readings/actions";
import { readingStatusLabels, type ReadingStatusCode } from "@/features/readings/schemas";

/** Ajoute le livre aux lectures du membre, avec le statut choisi, puis ouvre sa fiche de lecture. */
export function AddToReadings({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const add = (status: ReadingStatusCode) =>
    start(async () => {
      setError(undefined);
      const result = await addReadingAction({ bookId, status });
      if (result.ok) router.push(`/member/readings/${result.data.readingId}`);
      else setError(result.message);
    });

  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <BookmarkPlus aria-hidden="true" className="size-4 text-terracotta-fonce" />
        Ajouter à mes lectures
      </p>
      <div className="flex flex-wrap gap-2">
        {(["READING", "TO_READ", "FINISHED"] as const).map((status) => (
          <Button
            key={status}
            size="sm"
            variant={status === "READING" ? "principal" : "contour"}
            disabled={pending}
            onClick={() => add(status)}
          >
            {readingStatusLabels[status]}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="petit mt-2 font-semibold text-erreur">
          {error}
        </p>
      ) : null}
    </div>
  );
}

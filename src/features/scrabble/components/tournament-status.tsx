"use client";

import { useRouter } from "next/navigation";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { archiveTournamentAction, setTournamentStatusAction } from "@/features/scrabble/actions";
import { canTransition, type TournamentStatusCode } from "@/features/scrabble/rules";

/** Gestes de cycle de vie proposés selon l'état, dans l'ordre naturel d'un tournoi. */
const moves: { to: TournamentStatusCode; label: string; confirm?: string }[] = [
  { to: "REGISTRATION_OPEN", label: "Ouvrir les inscriptions" },
  { to: "IN_PROGRESS", label: "Lancer le tournoi" },
  { to: "COMPLETED", label: "Marquer comme terminé" },
  { to: "DRAFT", label: "Repasser en brouillon" },
  {
    to: "CANCELLED",
    label: "Annuler le tournoi",
    confirm: "Annuler ce tournoi ? Il restera visible comme « annulé ».",
  },
];

export function TournamentStatusActions({
  tournamentId,
  status,
  validated,
}: {
  tournamentId: string;
  status: TournamentStatusCode;
  validated: boolean;
}) {
  const router = useRouter();
  const { run, pending, toast } = useAdminAction();
  const available = moves.filter(
    (move) => canTransition(status, move.to) && !(validated && move.to === "IN_PROGRESS"),
  );
  return (
    <div className="flex flex-wrap gap-2">
      {available.map((move, index) => (
        <Button
          key={move.to}
          size="sm"
          variant={index === 0 && move.to !== "CANCELLED" ? "principal" : "contour"}
          disabled={pending}
          onClick={() => {
            if (move.confirm && !window.confirm(move.confirm)) return;
            void run(() => setTournamentStatusAction({ tournamentId, status: move.to }), {
              success: "État du tournoi mis à jour.",
            });
          }}
        >
          {move.label}
        </Button>
      ))}
      {status === "CANCELLED" || (status === "COMPLETED" && validated) ? (
        <Button
          size="sm"
          variant="contour"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Archiver ce tournoi ? Il disparaît des listes et du site."))
              return;
            void run(() => archiveTournamentAction({ tournamentId }), {
              success: "Tournoi archivé.",
              onSuccess: () => router.push("/admin/scrabble"),
            });
          }}
        >
          Archiver
        </Button>
      ) : null}
      {toast}
    </div>
  );
}

"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { createTeamAction, deleteTeamAction } from "@/features/scrabble/actions";

/** Équipes du tournoi (format équipes) : création et suppression ; l'affectation se fait par joueur. */
export function TeamsEditor({
  tournamentId,
  teams,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
}) {
  const { run, pending, toast } = useAdminAction();
  const [name, setName] = useState("");
  return (
    <div className="mt-4">
      <p className="text-[0.9375rem] font-semibold">Équipes</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {teams.map((team) => (
          <li
            key={team.id}
            className="inline-flex h-11 items-center gap-1 rounded-full bg-sable pr-1 pl-4 font-semibold"
          >
            {team.name}
            <Button
              size="icone"
              variant="discret"
              className="size-9"
              disabled={pending}
              aria-label={`Supprimer l’équipe ${team.name}`}
              onClick={() => {
                if (!window.confirm(`Supprimer l’équipe ${team.name} ?`)) return;
                void run(() => deleteTeamAction({ teamId: team.id }), {
                  success: "Équipe supprimée.",
                });
              }}
            >
              <X aria-hidden="true" />
            </Button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const typed = name;
          setName("");
          void run(() => createTeamAction({ tournamentId, name: typed }), {
            success: "Équipe créée.",
          }).then((ok) => {
            if (!ok) setName(typed);
          });
        }}
      >
        <Input
          aria-label="Nom de la nouvelle équipe"
          placeholder="Nom de l’équipe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="h-11 max-w-xs"
        />
        <Button type="submit" size="sm" variant="contour" disabled={pending || !name.trim()}>
          Créer
        </Button>
      </form>
      {toast}
    </div>
  );
}

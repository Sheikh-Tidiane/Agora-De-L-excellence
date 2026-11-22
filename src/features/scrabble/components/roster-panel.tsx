"use client";

import { useState } from "react";
import { UserMinus } from "lucide-react";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import {
  assignParticipantTeamAction,
  removeParticipantAction,
  setParticipantWithdrawnAction,
} from "@/features/scrabble/actions";
import { AddPlayer } from "@/features/scrabble/components/add-player";
import { TeamsEditor } from "@/features/scrabble/components/teams-editor";
import type { AdminParticipant } from "@/features/scrabble/queries";

/**
 * Joueurs d'un tournoi : membres et participants extérieurs, équipe (format équipes), retrait
 * (le joueur garde ses manches jouées) ou suppression (seulement sans score).
 */
export function RosterPanel({
  tournamentId,
  participants,
  teams,
  teamsFormat,
  editable,
}: {
  tournamentId: string;
  participants: AdminParticipant[];
  teams: { id: string; name: string }[];
  teamsFormat: boolean;
  editable: boolean;
}) {
  const { run, pending, toast } = useAdminAction();
  const [adding, setAdding] = useState(false);

  return (
    <section aria-labelledby="joueurs-titre">
      <div className="flex items-center justify-between gap-3">
        <h2 id="joueurs-titre" className="titre-3">
          Joueurs <span className="text-gris tabular-nums">{participants.length}</span>
        </h2>
        {editable && !adding ? (
          <Button size="sm" variant="contour" onClick={() => setAdding(true)}>
            Inscrire un joueur
          </Button>
        ) : null}
      </div>
      {adding ? (
        <div className="mt-4 rounded-[14px] bg-blanc p-4">
          <AddPlayer
            tournamentId={tournamentId}
            teams={teamsFormat ? teams : []}
            onClose={() => setAdding(false)}
          />
        </div>
      ) : null}
      {teamsFormat && editable ? <TeamsEditor tournamentId={tournamentId} teams={teams} /> : null}

      {participants.length === 0 ? (
        <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
          Aucun joueur inscrit. Inscrivez des membres du club ou des participants extérieurs.
        </p>
      ) : (
        <ul className="mt-4 border-b border-indigo/20">
          {participants.map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-indigo/20 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {player.name}
                  {player.withdrawn ? (
                    <span className="ml-2 align-middle">
                      <StatusPill tone="alerte">Retiré</StatusPill>
                    </span>
                  ) : null}
                </p>
                <p className="petit text-gris">
                  {player.isExternal
                    ? `Extérieur${player.externalClub ? ` · ${player.externalClub}` : ""}`
                    : (player.memberNumber ?? "Membre")}
                </p>
              </div>
              {teamsFormat ? (
                <Select
                  aria-label={`Équipe de ${player.name}`}
                  value={player.teamId ?? ""}
                  disabled={!editable || pending}
                  className="h-11 w-40"
                  onChange={(e) =>
                    void run(() =>
                      assignParticipantTeamAction({
                        participantId: player.id,
                        teamId: e.target.value || null,
                      }),
                    )
                  }
                >
                  <option value="">Sans équipe</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              {editable ? (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="discret"
                    disabled={pending}
                    onClick={() =>
                      void run(
                        () =>
                          setParticipantWithdrawnAction({
                            participantId: player.id,
                            withdrawn: !player.withdrawn,
                          }),
                        { success: player.withdrawn ? "Joueur réintégré." : "Joueur retiré." },
                      )
                    }
                  >
                    {player.withdrawn ? "Réintégrer" : "Retirer"}
                  </Button>
                  <Button
                    size="icone"
                    variant="discret"
                    disabled={pending}
                    aria-label={`Désinscrire ${player.name}`}
                    onClick={() => {
                      if (!window.confirm(`Désinscrire ${player.name} ?`)) return;
                      void run(() => removeParticipantAction({ participantId: player.id }), {
                        success: "Joueur désinscrit.",
                      });
                    }}
                  >
                    <UserMinus aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {toast}
    </section>
  );
}

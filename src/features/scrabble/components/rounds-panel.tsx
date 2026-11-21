"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Trash2 } from "lucide-react";
import { StatusPill } from "@/components/admin/page-header";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  createMatchAction,
  createRoundAction,
  deleteMatchAction,
  deleteRoundAction,
  setRoundStatusAction,
} from "@/features/scrabble/actions";
import { roundStatusLabels } from "@/features/scrabble/components/labels";
import type { AdminTournament } from "@/features/scrabble/queries";

type Round = AdminTournament["rounds"][number];

function MatchForm({
  roundId,
  players,
}: {
  roundId: string;
  players: { id: string; name: string }[];
}) {
  const { run, pending, toast } = useAdminAction();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [table, setTable] = useState("");
  return (
    <form
      className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        void run(
          () =>
            createMatchAction({
              roundId,
              participantAId: a,
              participantBId: b,
              tableNumber: table ? Number(table) : null,
            }),
          {
            success: "Partie ajoutée.",
            onSuccess: () => {
              setA("");
              setB("");
              setTable("");
            },
          },
        );
      }}
    >
      {(
        [
          [a, setA, "Joueur A"],
          [b, setB, "Joueur B"],
        ] as const
      ).map(([value, setValue, label]) => (
        <Select
          key={label}
          aria-label={label}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-11"
        >
          <option value="">{label}</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </Select>
      ))}
      <Input
        aria-label="Table"
        placeholder="Table"
        inputMode="numeric"
        value={table}
        onChange={(e) => setTable(e.target.value.replace(/\D/g, ""))}
        className="h-11"
      />
      <Button type="submit" size="sm" variant="contour" disabled={pending || !a || !b || a === b}>
        Apparier
      </Button>
      {toast}
    </form>
  );
}

/**
 * Manches du tournoi : état, avancée de la saisie, lien vers la saisie des scores (utilisable sur
 * téléphone). En classique, les appariements sont saisis à la main pour chaque manche.
 */
export function RoundsPanel({
  tournamentId,
  rounds,
  entry,
  classic,
  players,
  canPlay,
  locked,
}: {
  tournamentId: string;
  rounds: Round[];
  entry: AdminTournament["entry"];
  classic: boolean;
  players: { id: string; name: string }[];
  /** État du tournoi qui permet de préparer manches et scores. */
  canPlay: boolean;
  /** Résultats validés : plus rien ne bouge avant dévalidation. */
  locked: boolean;
}) {
  const { run, pending, toast } = useAdminAction();
  const nameOf = new Map(players.map((player) => [player.id, player.name]));

  return (
    <section aria-labelledby="manches-titre">
      <div className="flex items-center justify-between gap-3">
        <h2 id="manches-titre" className="titre-3">
          Manches
        </h2>
        {canPlay && !locked ? (
          <Button
            size="sm"
            variant="contour"
            disabled={pending}
            onClick={() =>
              void run(() => createRoundAction({ tournamentId }), {
                success: (data) => `Manche ${data.number} créée.`,
              })
            }
          >
            Nouvelle manche
          </Button>
        ) : null}
      </div>
      {!canPlay ? (
        <p className="petit mt-2 text-gris">
          Ouvrez les inscriptions ou lancez le tournoi pour préparer les manches.
        </p>
      ) : null}
      {rounds.length === 0 ? (
        <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
          Aucune manche pour l’instant.
        </p>
      ) : (
        <ol className="mt-4 border-b border-indigo/20">
          {rounds.map((round) => {
            const progress = entry.find((item) => item.roundId === round.id);
            return (
              <li key={round.id} className="border-t border-indigo/20 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="font-serif text-xl">Manche {round.number}</p>
                  <StatusPill tone={round.status === "COMPLETED" ? "succes" : "neutre"}>
                    {roundStatusLabels[round.status]}
                  </StatusPill>
                  {progress ? (
                    <span className="petit text-gris tabular-nums">
                      {progress.entered}/{progress.expected} scores
                    </span>
                  ) : null}
                  <div className="ml-auto flex flex-wrap items-center gap-1">
                    {!locked && round.status !== "COMPLETED" ? (
                      <Button
                        size="sm"
                        variant="discret"
                        disabled={pending}
                        onClick={() =>
                          void run(() =>
                            setRoundStatusAction({
                              roundId: round.id,
                              status: round.status === "PLANNED" ? "IN_PROGRESS" : "COMPLETED",
                            }),
                          )
                        }
                      >
                        {round.status === "PLANNED" ? "Commencer" : "Clore la manche"}
                      </Button>
                    ) : null}
                    <Link
                      href={`/admin/scrabble/${tournamentId}/rounds/${round.id}`}
                      className="lien inline-flex min-h-11 items-center gap-1 px-2"
                    >
                      Scores
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                    {!locked && round.scores.length === 0 ? (
                      <Button
                        size="icone"
                        variant="discret"
                        disabled={pending}
                        aria-label={`Supprimer la manche ${round.number}`}
                        onClick={() => {
                          if (!window.confirm(`Supprimer la manche ${round.number} ?`)) return;
                          void run(() => deleteRoundAction({ roundId: round.id }), {
                            success: "Manche supprimée.",
                          });
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {classic ? (
                  <div className="mt-2">
                    {round.matches.length > 0 ? (
                      <ul className="petit space-y-1">
                        {round.matches.map((match) => (
                          <li key={match.id} className="flex items-center gap-2">
                            <span className="w-16 text-gris tabular-nums">
                              {match.tableNumber ? `Table ${match.tableNumber}` : "—"}
                            </span>
                            <span className="min-w-0 flex-1">
                              {nameOf.get(match.participantAId)} contre{" "}
                              {nameOf.get(match.participantBId)}
                            </span>
                            {!locked && match.status === "SCHEDULED" ? (
                              <Button
                                size="sm"
                                variant="discret"
                                disabled={pending}
                                onClick={() =>
                                  void run(() => deleteMatchAction({ matchId: match.id }), {
                                    success: "Partie retirée.",
                                  })
                                }
                              >
                                Retirer
                              </Button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="petit text-gris">Aucune partie appariée.</p>
                    )}
                    {!locked && round.status !== "COMPLETED" ? (
                      <MatchForm roundId={round.id} players={players} />
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {toast}
    </section>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import {
  addParticipantAction,
  searchMembersForTournamentAction,
} from "@/features/scrabble/actions";
import { cn } from "@/lib/utils";

type Found = { id: string; name: string; memberNumber: string };

/**
 * Inscription d'un joueur : recherche d'un membre (nom ou numéro), ou participant extérieur
 * (nom et club). Un extérieur ne reçoit ni compte ni points.
 */
export function AddPlayer({
  tournamentId,
  teams,
  onClose,
}: {
  tournamentId: string;
  teams: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { run, pending, toast } = useAdminAction();
  const [kind, setKind] = useState<"member" | "external">("member");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, startSearch] = useTransition();
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [teamId, setTeamId] = useState("");

  useEffect(() => {
    if (kind !== "member" || query.trim().length < 2) return;
    const timer = setTimeout(
      () =>
        startSearch(async () => {
          const result = await searchMembersForTournamentAction({ tournamentId, q: query });
          setFound(result.ok ? result.data : []);
        }),
      250,
    );
    return () => clearTimeout(timer);
  }, [kind, query, tournamentId]);

  const add = (input: { userId?: string; externalName?: string; externalClub?: string }) =>
    run(() => addParticipantAction({ tournamentId, teamId: teamId || null, ...input }), {
      success: (data) =>
        data.eventRegistered ? "Joueur inscrit, et à la rencontre liée." : "Joueur inscrit.",
    });

  const shown = query.trim().length < 2 ? [] : found;

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Type de joueur" className="flex gap-2">
        {(
          [
            ["member", "Membre du club"],
            ["external", "Participant extérieur"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors",
              kind === value ? "border-indigo bg-indigo text-ivoire" : "border-indigo/20",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {teams.length > 0 ? (
        <Field id="add-team" label="Équipe" optional>
          <Select id="add-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            <option value="">Sans équipe</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {kind === "member" ? (
        <div>
          <Field id="add-search" label="Rechercher un membre" hint="Nom, prénom ou numéro.">
            <Input
              id="add-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
          </Field>
          <ul aria-live="polite" className="mt-2">
            {shown.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 border-t border-indigo/15 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{member.name}</span>
                  <span className="petit ml-2 text-gris">{member.memberNumber}</span>
                </span>
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    setFound((current) => current.filter((item) => item.id !== member.id));
                    void add({ userId: member.id });
                  }}
                >
                  Inscrire
                </Button>
              </li>
            ))}
            {query.trim().length >= 2 && !searching && shown.length === 0 ? (
              <li className="petit py-2 text-gris">Aucun membre trouvé (ou déjà inscrit).</li>
            ) : null}
          </ul>
        </div>
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            // Vidé tout de suite, rétabli en cas de refus : une saisie suivante n'est jamais effacée.
            const typed = { name, club };
            setName("");
            setClub("");
            void add({ externalName: typed.name, externalClub: typed.club }).then((ok) => {
              if (!ok) {
                setName(typed.name);
                setClub(typed.club);
              }
            });
          }}
        >
          <Field id="add-name" label="Nom">
            <Input
              id="add-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Field id="add-club" label="Club" optional>
            <Input
              id="add-club"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Button
            type="submit"
            size="sm"
            disabled={pending || name.trim() === ""}
            className="w-fit"
          >
            Inscrire
          </Button>
        </form>
      )}
      <Button size="sm" variant="discret" onClick={onClose}>
        Fermer
      </Button>
      {toast}
    </div>
  );
}

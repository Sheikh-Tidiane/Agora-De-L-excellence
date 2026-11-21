"use client";

import { useMemo, useState } from "react";
import { useAdminAction } from "@/components/admin/use-admin-action";
import { Button } from "@/components/ui/button";
import { saveScoresAction } from "@/features/scrabble/actions";
import { MAX_SCORE } from "@/features/scrabble/schemas";
import { cn } from "@/lib/utils";

export type EntryRow = {
  participantId: string;
  name: string;
  detail: string | null;
  points: number | null;
  isForfeit: boolean;
};

export type EntryGroup = { key: string; label: string | null; rows: EntryRow[] };

type Draft = { points: string; isForfeit: boolean };

/**
 * Saisie des scores d'une manche, pensée pour le téléphone : clavier numérique, un joueur par
 * ligne, forfait d'un geste, bouton d'enregistrement collé en bas. Les lignes modifiées sont
 * marquées ; seules elles partent au serveur. Un champ vidé efface le score.
 */
export function ScoreEntry({
  roundId,
  groups,
  locked,
}: {
  roundId: string;
  groups: EntryGroup[];
  locked: boolean;
}) {
  const { run, pending, toast } = useAdminAction();
  const initial = useMemo(() => {
    const map: Record<string, Draft> = {};
    for (const row of groups.flatMap((group) => group.rows)) {
      map[row.participantId] = {
        points: row.isForfeit || row.points === null ? "" : String(row.points),
        isForfeit: row.isForfeit,
      };
    }
    return map;
  }, [groups]);
  const [drafts, setDrafts] = useState(initial);
  const [saved, setSaved] = useState(initial);

  const changed = Object.keys(drafts).filter(
    (id) =>
      drafts[id]!.points !== saved[id]!.points || drafts[id]!.isForfeit !== saved[id]!.isForfeit,
  );
  const invalid = Object.entries(drafts).filter(
    ([, draft]) => draft.points !== "" && Number(draft.points) > MAX_SCORE,
  );

  const update = (id: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));

  const save = () =>
    run(
      () =>
        saveScoresAction({
          roundId,
          entries: changed.map((id) => ({
            participantId: id,
            points:
              drafts[id]!.isForfeit || drafts[id]!.points === ""
                ? drafts[id]!.isForfeit
                  ? 0
                  : null
                : Number(drafts[id]!.points),
            isForfeit: drafts[id]!.isForfeit,
          })),
        }),
      {
        success: (data) =>
          `${data.saved} score${data.saved > 1 ? "s" : ""} enregistré${data.saved > 1 ? "s" : ""}${data.removed ? `, ${data.removed} effacé${data.removed > 1 ? "s" : ""}` : ""}.`,
        onSuccess: () => setSaved(drafts),
      },
    );

  return (
    <div>
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label ?? undefined} className="mb-6">
          {group.label ? <p className="surtitre mb-2">{group.label}</p> : null}
          <ul className="border-b border-indigo/20">
            {group.rows.map((row) => {
              const draft = drafts[row.participantId]!;
              const dirty = changed.includes(row.participantId);
              const inputId = `score-${row.participantId}`;
              return (
                <li
                  key={row.participantId}
                  className={cn(
                    "flex items-center gap-3 border-t border-indigo/20 py-3 pl-3 transition-colors",
                    dirty && "border-l-[3px] border-l-terracotta bg-blanc",
                  )}
                >
                  <label htmlFor={inputId} className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{row.name}</span>
                    {row.detail ? (
                      <span className="petit block truncate text-gris">{row.detail}</span>
                    ) : null}
                  </label>
                  <input
                    id={inputId}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="off"
                    enterKeyHint="next"
                    disabled={locked || draft.isForfeit}
                    value={draft.isForfeit ? "" : draft.points}
                    placeholder={draft.isForfeit ? "0" : "—"}
                    onChange={(e) =>
                      update(row.participantId, {
                        points: e.target.value.replace(/\D/g, "").slice(0, 4),
                      })
                    }
                    aria-invalid={Number(draft.points) > MAX_SCORE ? true : undefined}
                    className="h-12 w-24 rounded-champ border border-indigo/25 bg-blanc text-center font-serif text-xl tabular-nums focus:border-indigo focus:outline-none disabled:bg-sable"
                  />
                  <label className="flex min-h-11 items-center gap-2 pr-1 text-[0.875rem] font-semibold">
                    <input
                      type="checkbox"
                      checked={draft.isForfeit}
                      disabled={locked}
                      onChange={(e) => update(row.participantId, { isForfeit: e.target.checked })}
                      className="size-5 accent-terracotta-fonce"
                    />
                    Forfait
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {invalid.length > 0 ? (
        <p role="alert" className="petit mb-3 font-semibold text-erreur">
          Un score ne dépasse pas {MAX_SCORE.toLocaleString("fr-FR")} points.
        </p>
      ) : null}
      {locked ? (
        <p className="rounded-champ bg-sable px-4 py-3 font-semibold">
          Résultats validés : dévalidez depuis la feuille du tournoi pour corriger un score.
        </p>
      ) : (
        <div className="sticky bottom-0 -mx-4 border-t border-indigo/15 bg-ivoire/95 px-4 py-3 md:static md:mx-0 md:border-0 md:bg-transparent md:px-0">
          <Button
            variant="action"
            largeur="pleine"
            className="md:w-auto"
            disabled={pending || changed.length === 0 || invalid.length > 0}
            onClick={() => void save()}
          >
            {pending
              ? "Enregistrement…"
              : changed.length === 0
                ? "Rien à enregistrer"
                : `Enregistrer ${changed.length} score${changed.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
      {toast}
    </div>
  );
}

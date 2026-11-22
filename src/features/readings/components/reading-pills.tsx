import { Tag } from "@/components/shared/event-row";

type Completion = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

/** État de la validation « livre terminé », dit au membre sans jargon. */
export function CompletionTag({ status }: { status: Completion }) {
  if (status === "PENDING") return <Tag tone="alerte">En attente de validation</Tag>;
  if (status === "APPROVED") return <Tag tone="succes">Validée par le club</Tag>;
  if (status === "REJECTED") return <Tag tone="erreur">Validation refusée</Tag>;
  return null;
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const width = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-sable"
      >
        <div className="h-full rounded-full bg-terracotta" style={{ width: `${width}%` }} />
      </div>
      <span className="petit w-11 text-right font-semibold tabular-nums">{width}&nbsp;%</span>
    </div>
  );
}

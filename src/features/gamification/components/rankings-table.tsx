import Link from "next/link";
import { LetterTile } from "@/components/shared/letter-tile";
import type { PointRankings } from "@/features/gamification/rewards-service";
import { cn } from "@/lib/utils";

/**
 * Classement des points : dix premiers, rangs en tuiles (le podium en terracotta), le membre
 * connecté souligné ; sa propre position en bas s'il n'est pas dans les dix.
 */
export function RankingsTable({
  rankings,
  period,
}: {
  rankings: PointRankings;
  period: "month" | "all";
}) {
  const { top, viewer } = rankings;
  const viewerInTop = top.some((row) => row.isViewer);
  return (
    <div>
      <nav aria-label="Période du classement" className="flex gap-2">
        {(
          [
            ["month", "Ce mois-ci", "?classement=mois#classement"],
            ["all", "Depuis le début", "?classement=general#classement"],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href}
            scroll={false}
            aria-current={period === key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-semibold transition-colors",
              period === key
                ? "border-indigo bg-indigo text-ivoire"
                : "border-indigo/20 hover:border-indigo",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {top.length === 0 ? (
        <p className="mt-5 border-t border-indigo/20 pt-4 text-gris">
          {period === "month"
            ? "Personne n’a encore de points ce mois-ci."
            : "Personne n’a encore de points."}
        </p>
      ) : (
        <ol className="mt-5 border-b border-indigo/20">
          {top.map((row) => (
            <li
              key={row.userId}
              className={cn(
                "flex items-center gap-4 border-t border-indigo/20 px-2 py-3",
                row.isViewer && "bg-blanc",
              )}
            >
              <LetterTile
                letter={String(row.rank)}
                value={null}
                tone={row.rank <= 3 ? "terracotta" : "sable"}
                label={`Rang ${row.rank}`}
                className="text-[40px]"
              />
              <span className="min-w-0 flex-1 truncate font-semibold">
                {row.firstName} {row.lastNameInitial}
                {row.isViewer ? <span className="font-normal text-gris"> (vous)</span> : null}
              </span>
              <span className="font-serif text-xl tabular-nums">
                {row.points.toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ol>
      )}

      {viewer && !viewerInTop ? (
        <p className="petit mt-4 rounded-champ bg-sable px-4 py-3">
          {viewer.hidden
            ? "Vous avez choisi de ne pas apparaître dans les classements (réglable dans votre profil)."
            : viewer.rank
              ? `Votre position : ${viewer.rank}e, avec ${viewer.points.toLocaleString("fr-FR")} points.`
              : "Vous n’avez pas encore de points sur cette période."}
        </p>
      ) : null}
      <p className="petit mt-3 text-gris">
        Visible des seuls membres connectés : prénom et initiale du nom.
      </p>
    </div>
  );
}

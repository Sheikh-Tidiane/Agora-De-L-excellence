import { Suspense } from "react";
import type { Metadata } from "next";
import { LetterTile } from "@/components/shared/letter-tile";
import { RankingsTable } from "@/features/gamification/components/rankings-table";
import { getMemberRewards, getPointRankings } from "@/features/gamification/service";
import { authRoutes } from "@/config/auth";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mes récompenses" };

const plural = (n: number) => (Math.abs(n) > 1 ? "points" : "point");

async function Rewards({
  searchParams,
}: {
  searchParams: PageProps<"/member/rewards">["searchParams"];
}) {
  const user = await requirePageAccess("member.access", `${authRoutes.member}/rewards`);
  const { classement } = await searchParams;
  const period = classement === "general" ? "all" : "month";
  const [rewards, rankings] = await Promise.all([
    getMemberRewards(user.id),
    getPointRankings({ period, viewerId: user.id, now: new Date() }),
  ]);
  const { current, next, remaining, progress } = rewards.level;

  return (
    <div className="mt-8 grid gap-12 lg:grid-cols-9 lg:gap-x-10">
      <div className="space-y-12 lg:col-span-5">
        <section
          aria-labelledby="niveau-titre"
          className="rounded-[18px] bg-indigo p-6 text-ivoire sm:p-7"
        >
          <h2
            id="niveau-titre"
            className="text-[0.75rem] font-bold tracking-[0.16em] text-terracotta-clair uppercase"
          >
            Mon niveau
          </h2>
          <p className="mt-3 font-serif text-[2rem] leading-tight">{current?.name ?? "—"}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-serif text-[2.75rem] leading-none tabular-nums">
              {rewards.total.toLocaleString("fr-FR")}
            </span>
            <span className="text-ivoire/75">{plural(rewards.total)} au total</span>
          </p>
          {next ? (
            <>
              <div
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression vers le niveau ${next.name}`}
                className="mt-5 h-1.5 overflow-hidden rounded-full bg-ivoire/15"
              >
                <div
                  className="h-full rounded-full bg-terracotta-clair"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="petit mt-2 text-ivoire/80">
                Encore {remaining.toLocaleString("fr-FR")}&nbsp;{plural(remaining)} pour «&nbsp;
                {next.name}&nbsp;».
              </p>
            </>
          ) : (
            <p className="petit mt-3 text-ivoire/80">Le plus haut niveau du club.</p>
          )}
        </section>

        <section aria-labelledby="badges-titre">
          <h2 id="badges-titre" className="titre-3">
            Mes badges
          </h2>
          {rewards.earned.length === 0 ? (
            <p className="mt-3 text-gris">
              Pas encore de badge : ils viennent avec les livres terminés, les rencontres, les
              tournois et les quiz.
            </p>
          ) : (
            <ul className="mt-4 border-b border-indigo/20">
              {rewards.earned.map((badge) => (
                <li key={badge.code} className="flex gap-4 border-t border-indigo/20 py-4">
                  <LetterTile
                    letter={badge.name.charAt(0)}
                    value={null}
                    tone="terracotta"
                    label={`Badge ${badge.name}`}
                    className="text-[44px]"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-lg leading-snug">{badge.name}</p>
                    <p className="petit mt-0.5 text-gris">{badge.description}</p>
                    {badge.reason ? (
                      <p className="petit mt-1">«&nbsp;{badge.reason}&nbsp;»</p>
                    ) : null}
                    <p className="petit mt-1 font-semibold text-succes">
                      Obtenu le {formatDate(badge.awardedAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {rewards.toEarn.length > 0 ? (
            <>
              <h3 className="surtitre mt-8">À obtenir</h3>
              <ul className="mt-2 border-b border-indigo/20">
                {rewards.toEarn.map((badge) => (
                  <li key={badge.code} className="flex gap-4 border-t border-indigo/20 py-4">
                    <LetterTile
                      letter={badge.name.charAt(0)}
                      value={null}
                      tone="sable"
                      label={`Badge ${badge.name}, pas encore obtenu`}
                      className="text-[44px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-lg leading-snug text-indigo/80">{badge.name}</p>
                      <p className="petit mt-0.5 text-gris">{badge.description}</p>
                      {badge.progress ? (
                        <div className="mt-2 flex items-center gap-3">
                          <div
                            className="h-1.5 flex-1 overflow-hidden rounded-full bg-sable"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full bg-terracotta"
                              style={{ width: `${Math.round(badge.progress.ratio * 100)}%` }}
                            />
                          </div>
                          <p className="petit shrink-0 font-semibold tabular-nums">
                            {badge.progress.current} sur {badge.progress.threshold}
                          </p>
                        </div>
                      ) : badge.manual ? (
                        <p className="petit mt-1 text-gris">Décerné par le club.</p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section aria-labelledby="historique-titre">
          <h2 id="historique-titre" className="titre-3">
            Historique des points
          </h2>
          {rewards.history.length === 0 ? (
            <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
              Les présences aux rencontres, les livres terminés et validés et les critiques
              approuvées rapportent des points. Ils s’inscriront ici, un par un.
            </p>
          ) : (
            <ul className="mt-4 border-b border-indigo/20">
              {rewards.history.map((line) => (
                <li
                  key={line.id}
                  className="flex items-start justify-between gap-4 border-t border-indigo/20 py-3"
                >
                  <div className="min-w-0">
                    <p className={cn("font-semibold", line.reversed && "text-gris line-through")}>
                      {line.label}
                    </p>
                    <p className="petit text-gris">
                      {formatDate(line.createdAt)}
                      {line.isCorrection && line.reason ? ` · ${line.reason}` : null}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 font-serif text-lg tabular-nums",
                      line.points < 0 ? "text-erreur" : "text-indigo",
                      line.reversed && "text-gris line-through",
                    )}
                  >
                    {line.points > 0 ? "+" : ""}
                    {line.points}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section
        id="classement"
        aria-labelledby="classement-titre"
        className="scroll-mt-28 lg:col-span-4"
      >
        <h2 id="classement-titre" className="titre-3">
          Classement
        </h2>
        <div className="mt-4">
          <RankingsTable rankings={rankings} period={period} />
        </div>
      </section>
    </div>
  );
}

export default function RewardsPage({ searchParams }: PageProps<"/member/rewards">) {
  return (
    <>
      <p className="surtitre">Récompenses</p>
      <h1 className="titre-1 mt-3">Mes récompenses</h1>
      <Suspense
        fallback={
          <div aria-hidden="true" className="mt-8 grid gap-10 lg:grid-cols-9">
            <div className="skeleton h-56 w-full lg:col-span-5" />
            <div className="skeleton h-80 w-full lg:col-span-4" />
          </div>
        }
      >
        <Rewards searchParams={searchParams} />
      </Suspense>
    </>
  );
}

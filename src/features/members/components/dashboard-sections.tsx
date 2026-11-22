import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MyRegistrationsList } from "@/features/events/components/my-registrations";
import type { getMemberDashboard } from "@/features/members/dashboard-queries";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

type Dashboard = Awaited<ReturnType<typeof getMemberDashboard>>;

/** Titre de section du tableau de bord, avec un lien « tout voir » facultatif à droite. */
export function SectionTitle({
  id,
  children,
  more,
}: {
  id: string;
  children: ReactNode;
  more?: { href: string; label: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 id={id} className="titre-3">
        {children}
      </h2>
      {more ? (
        <Link
          href={more.href}
          className="lien inline-flex min-h-11 shrink-0 items-center gap-1 text-[0.9375rem]"
        >
          {more.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

export function UpcomingSection({
  registrations,
  now,
  cancellationDeadlineHours,
}: {
  registrations: Dashboard["registrations"];
  now: Date;
  cancellationDeadlineHours: number;
}) {
  return (
    <section aria-labelledby="rencontres-titre">
      <SectionTitle
        id="rencontres-titre"
        more={
          registrations.length > 2
            ? { href: "/member/events", label: `Les ${registrations.length}` }
            : undefined
        }
      >
        Mes prochaines rencontres
      </SectionTitle>
      {registrations.length === 0 ? (
        <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
          Aucune inscription pour l’instant.{" "}
          <Link href="/events" className="lien">
            Voir l’agenda du club
          </Link>
        </p>
      ) : (
        <div className="mt-2">
          <MyRegistrationsList
            registrations={registrations.slice(0, 2)}
            now={now}
            cancellationDeadlineHours={cancellationDeadlineHours}
          />
        </div>
      )}
    </section>
  );
}

/** Points cumulés, niveau et badges. Rien n'est inventé : 0 point s'affiche tel quel. */
export function RewardsSection({
  points,
  level,
  badges,
}: {
  points: number;
  level: Dashboard["level"];
  badges: Dashboard["badges"];
}) {
  const { current, next, remaining, progress } = level;
  return (
    <section aria-labelledby="points-titre" className="rounded-[14px] bg-blanc p-5 sm:p-6">
      <h2 id="points-titre" className="surtitre">
        Mes points
      </h2>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="font-serif text-[3rem] leading-none tabular-nums">
          {points.toLocaleString("fr-FR")}
        </span>
        <span className="font-semibold text-gris">{Math.abs(points) > 1 ? "points" : "point"}</span>
      </p>
      {current ? (
        <div className="mt-4">
          <p className="font-serif text-xl leading-snug text-terracotta-fonce">{current.name}</p>
          {next ? (
            <>
              <div
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression vers le niveau ${next.name}`}
                className="mt-3 h-1.5 overflow-hidden rounded-full bg-sable"
              >
                <div
                  className="h-full rounded-full bg-terracotta"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <p className="petit mt-2 text-gris">
                Encore {remaining.toLocaleString("fr-FR")}&nbsp;{remaining > 1 ? "points" : "point"}{" "}
                pour devenir «&nbsp;{next.name}&nbsp;».
              </p>
            </>
          ) : (
            <p className="petit mt-2 text-gris">Le plus haut niveau du club.</p>
          )}
        </div>
      ) : null}
      <h3 className="surtitre mt-6 border-t border-indigo/15 pt-5">Mes badges</h3>
      {badges.length === 0 ? (
        <p className="petit mt-2 text-gris">
          Pas encore de badge. Ils s’obtiennent au fil des livres terminés, des débats et des
          tournois.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {badges.map(({ id, badge, awardedAt }) => (
            <li key={id}>
              <p className="font-semibold">{badge.name}</p>
              <p className="petit text-gris">
                {badge.description} · {formatDate(awardedAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/member/rewards"
        className="lien mt-4 inline-flex min-h-11 items-center gap-1 text-[0.9375rem]"
      >
        Récompenses et classement
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

export function ReadingsSection({ readings }: { readings: Dashboard["readings"] }) {
  return (
    <section aria-labelledby="lectures-titre">
      <SectionTitle id="lectures-titre">Mes lectures en cours</SectionTitle>
      {readings.length === 0 ? (
        <p className="mt-4 border-t border-indigo/20 pt-4 text-gris">
          Aucune lecture en cours.{" "}
          <Link href="/library" className="lien">
            Parcourir la bibliothèque
          </Link>
        </p>
      ) : (
        <ul className="mt-2 border-b border-indigo/20">
          {readings.map(({ id, progress, book }) => (
            <li key={id} className="border-t border-indigo/20 py-4">
              <Link
                href={`/library/${book.slug}`}
                className="font-serif text-lg leading-snug decoration-terracotta underline-offset-4 hover:underline"
              >
                {book.title}
              </Link>
              {book.authors.length > 0 ? (
                <p className="petit text-gris">{book.authors.map((a) => a.name).join(", ")}</p>
              ) : null}
              <div className="mt-3 flex items-center gap-3">
                <div
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Progression de ${book.title}`}
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-sable"
                >
                  <div
                    className={cn("h-full rounded-full bg-terracotta")}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>
                <span className="petit w-10 text-right font-semibold tabular-nums">
                  {progress}&nbsp;%
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

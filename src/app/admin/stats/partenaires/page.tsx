import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton } from "@/components/admin/page-header";
import { site } from "@/config/site";
import { BarList, ChartFigure, ColumnChart } from "@/features/stats/components/charts";
import { PrintButton } from "@/features/stats/components/print-button";
import { getEventStats, getMemberStats } from "@/features/stats/queries";
import { monthLabel, parseStatsPeriod, partnerView, SMALL_COUNT } from "@/features/stats/rules";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Statistiques · version partenaires" };

const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);
const decimal = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
/** Pour les graphiques : un effectif masqué (« < 3 ») est tracé à 0, sa valeur n'est jamais dite. */
const plotted = (value: number | string) => (typeof value === "number" ? value : 0);

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-t border-indigo py-5 print:break-inside-avoid">
      <p className="petit text-gris">{label}</p>
      <p className="mt-1.5 font-serif text-[2.25rem] leading-none tabular-nums">{value}</p>
      <p className="petit mt-2 text-gris">{hint}</p>
    </div>
  );
}

/**
 * Version « à présenter aux partenaires » : chiffres agrégés seulement (src/features/stats/rules.ts,
 * `partnerView`), sans aucun nom, titre de rencontre ni coordonnée. Imprimable.
 */
async function Partners({
  searchParams,
}: Pick<PageProps<"/admin/stats/partenaires">, "searchParams">) {
  await requirePageAccess("stats.read", "/admin/stats/partenaires");
  const query = await searchParams;
  const now = new Date();
  const period = parseStatsPeriod(query, now);
  const mode = query.mode === "principale" ? "primary" : "all";
  const [events, members] = await Promise.all([
    getEventStats(period, mode, now),
    getMemberStats(period, now),
  ]);
  const stats = partnerView({
    summary: events.summary,
    byMonth: events.byMonth,
    activities: events.activities,
    waitlists: events.waitlists,
    newMembers: members.newByMonth.reduce((t, m) => t + m.count, 0),
    currentMembers: members.current,
  });

  return (
    <article className="rapport-partenaires max-w-[60rem]">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/admin/stats?du=${period.du}&au=${period.au}&mode=${mode === "primary" ? "principale" : "toutes"}`}
          className="lien inline-flex min-h-11 items-center"
        >
          Retour aux statistiques
        </Link>
        <PrintButton />
      </div>
      <p className="surtitre mt-6">{site.name}</p>
      <h1 className="titre-1 mt-3">Le club en chiffres</h1>
      <p className="mt-3 text-gris">
        Du {formatDate(period.from)} au {formatDate(new Date(period.toExcl.getTime() - 1))}.
        Chiffres agrégés, sans aucune donnée personnelle ; les effectifs inférieurs à {SMALL_COUNT}{" "}
        sont masqués.
      </p>

      <div className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-4">
        <Figure label="Rencontres" value={String(stats.events)} hint="sur la période" />
        <Figure label="Présences" value={String(stats.present)} hint="membres et invités" />
        <Figure label="Taux de présence" value={percent(stats.rate)} hint="présents / inscrits" />
        <Figure
          label="Présents par rencontre"
          value={decimal(stats.averagePresent)}
          hint="en moyenne"
        />
        <Figure label="Nouveaux membres" value={String(stats.newMembers)} hint="sur la période" />
        <Figure
          label="Adhérents"
          value={String(stats.currentMembers)}
          hint="à la fin de la période"
        />
        <Figure
          label="Rencontres complètes"
          value={String(stats.waitlists.full)}
          hint="places toutes prises, ou liste d’attente ouverte"
        />
        <Figure
          label="Places obtenues sur liste d’attente"
          value={String(stats.waitlists.promoted)}
          hint={`sur ${stats.waitlists.waited} personnes en attente`}
        />
      </div>

      <div className="mt-10 grid gap-12 print:block">
        <ChartFigure
          id="p-mois"
          title="Présences par mois"
          description={`Toutes rencontres confondues. Un mois de moins de ${SMALL_COUNT} présences n’est pas tracé.`}
          columns={["Mois", "Rencontres", "Présences"]}
          rows={stats.byMonth.map((m) => [monthLabel(m.month), m.events, m.present])}
        >
          <ColumnChart
            id="p-mois"
            unit="présences"
            points={stats.byMonth.map((m) => ({
              label: monthLabel(m.month),
              value: plotted(m.present),
            }))}
          />
        </ChartFigure>
        <ChartFigure
          id="p-activites"
          title="Présences par activité"
          description={
            mode === "all"
              ? "Une rencontre à plusieurs activités compte pour chacune."
              : "Chaque rencontre compte pour son activité principale."
          }
          columns={["Activité", "Rencontres", "Présences", "Note moyenne"]}
          rows={stats.activities.map((a) => [
            a.label,
            a.events,
            a.present,
            a.averageRating === null ? "—" : `${decimal(a.averageRating)} / 5`,
          ])}
        >
          <BarList
            id="p-activites"
            unit="présences"
            items={stats.activities.map((a) => ({
              label: a.label,
              value: plotted(a.present),
              display: String(a.present),
            }))}
          />
        </ChartFigure>
      </div>
    </article>
  );
}

export default function PartnersPage({ searchParams }: PageProps<"/admin/stats/partenaires">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Partners searchParams={searchParams} />
    </Suspense>
  );
}

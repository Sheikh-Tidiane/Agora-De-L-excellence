import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Download, Printer } from "lucide-react";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { BarList, ChartFigure, ColumnChart } from "@/features/stats/components/charts";
import { getEventStats, getInactiveMembers, getMemberStats } from "@/features/stats/queries";
import {
  INACTIVITY_WEEKS_MAX,
  INACTIVITY_WEEKS_MIN,
  monthLabel,
  parseStatsPeriod,
  parseThreshold,
} from "@/features/stats/rules";
import { formatDate, formatShortDate } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statistiques" };

const th = "petit py-2.5 pr-4 text-left font-semibold text-gris";
const td = "py-3 pr-4 align-top";
const num = "text-right tabular-nums";
const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)} %`);
const decimal = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-t border-indigo py-5">
      <p className="petit text-gris">{label}</p>
      <p className="mt-1.5 font-serif text-[2.25rem] leading-none tabular-nums">{value}</p>
      <p className="petit mt-2 text-gris">{hint}</p>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-14 border-t border-indigo/30 pt-8">
      <h2 id={id} className="titre-3 mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Stats({ searchParams }: Pick<PageProps<"/admin/stats">, "searchParams">) {
  const user = await requirePageAccess("stats.read", "/admin/stats");
  const query = await searchParams;
  const now = new Date();
  const period = parseStatsPeriod(query, now);
  const mode = query.mode === "principale" ? "primary" : "all";
  const weeks = parseThreshold(query.seuil);
  const canSeePeople = can(user, "members.read");
  const canExport = can(user, "data.export");
  const [events, members, inactive] = await Promise.all([
    getEventStats(period, mode, now),
    getMemberStats(period, now),
    canSeePeople ? getInactiveMembers(weeks, now) : Promise.resolve(null),
  ]);
  const { summary } = events;
  const params = new URLSearchParams({
    du: period.du,
    au: period.au,
    mode: mode === "primary" ? "principale" : "toutes",
    seuil: String(weeks),
  });
  const csv = (jeu: string) => `/api/admin/stats?jeu=${jeu}&${params.toString()}`;
  const presetLink = (preset: string, label: string) => (
    <Link
      href={`/admin/stats?periode=${preset}&mode=${params.get("mode")}&seuil=${weeks}`}
      aria-current={period.preset === preset ? "true" : undefined}
      className={cn(
        "inline-flex min-h-10 items-center rounded-pastille border px-3.5 text-[0.875rem] font-semibold",
        period.preset === preset
          ? "border-indigo bg-indigo text-ivoire"
          : "border-indigo/25 text-indigo hover:border-indigo",
      )}
    >
      {label}
    </Link>
  );
  const exportLink = (jeu: string, label: string) =>
    canExport ? (
      <a href={csv(jeu)} className={cn(buttonVariants({ variant: "contour", size: "sm" }))}>
        <Download aria-hidden="true" />
        {label}
      </a>
    ) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {presetLink("3m", "3 derniers mois")}
        {presetLink("12m", "12 derniers mois")}
        {presetLink("annee", "Année en cours")}
        <Link
          href={`/admin/stats/partenaires?${params.toString()}`}
          className={cn(buttonVariants({ variant: "contour", size: "sm" }), "ml-auto max-sm:ml-0")}
        >
          <Printer aria-hidden="true" />
          Version partenaires
        </Link>
      </div>
      <form className="mt-4 flex flex-wrap items-end gap-3" aria-label="Période et options">
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Du</span>
          <Input type="date" name="du" defaultValue={period.du} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Au</span>
          <Input type="date" name="au" defaultValue={period.au} className="w-auto" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Rencontres à plusieurs activités</span>
          <Select name="mode" defaultValue={mode === "primary" ? "principale" : "toutes"}>
            <option value="toutes">Comptées pour chaque activité</option>
            <option value="principale">Activité principale seulement</option>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Sans présence depuis (semaines)</span>
          <Input
            type="number"
            name="seuil"
            min={INACTIVITY_WEEKS_MIN}
            max={INACTIVITY_WEEKS_MAX}
            defaultValue={weeks}
            className="w-28"
          />
        </label>
        <button type="submit" className={buttonVariants({ variant: "contour" })}>
          Afficher
        </button>
      </form>
      {period.fallback ? (
        <p
          role="alert"
          className="mt-3 rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte"
        >
          Dates invalides (jour inexistant, ou début après la fin) : les 12 derniers mois sont
          affichés.
        </p>
      ) : null}
      <p className="petit mt-3 text-gris">
        Du {formatDate(period.from)} au {formatDate(new Date(period.toExcl.getTime() - 1))} ·
        rencontres publiées ou clôturées déjà passées (annulées exclues).
      </p>

      <Section id="presence-titre" title="Présence">
        <div className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-4">
          <Figure label="Rencontres" value={String(summary.events)} hint="sur la période" />
          <Figure
            label="Taux de présence"
            value={percent(summary.rate)}
            hint={`${summary.present} présent${summary.present > 1 ? "s" : ""} sur ${summary.registered} inscrit${summary.registered > 1 ? "s" : ""}`}
          />
          <Figure
            label="Taux moyen par rencontre"
            value={percent(summary.averageRate)}
            hint="moyenne des taux de chaque rencontre"
          />
          <Figure
            label="Présents par rencontre"
            value={decimal(summary.averagePresent)}
            hint="en moyenne, invités compris"
          />
        </div>
        <div className="mt-8 grid gap-10 xl:grid-cols-2">
          <ChartFigure
            id="presence-mois"
            title="Présents par mois"
            description="Nombre de présences pointées chaque mois, toutes rencontres confondues."
            columns={["Mois", "Rencontres", "Présents"]}
            rows={events.byMonth.map((m) => [monthLabel(m.month), m.events, m.present])}
          >
            <ColumnChart
              id="presence-mois"
              unit="présents"
              points={events.byMonth.map((m) => ({ label: monthLabel(m.month), value: m.present }))}
            />
          </ChartFigure>
          <div className="min-w-0">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-semibold">Par rencontre</p>
              {exportLink("presence", "CSV")}
            </div>
            <div className="mt-3 max-h-[26rem] overflow-auto">
              <table className="w-full min-w-[28rem] border-collapse">
                <thead className="sticky top-0 border-b border-indigo/30 bg-ivoire">
                  <tr>
                    <th className={th}>Rencontre</th>
                    <th className={`${th} ${num}`}>Inscrits</th>
                    <th className={`${th} ${num}`}>Présents</th>
                    <th className={`${th} ${num}`}>Taux</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trait">
                  {[...events.attendance].reverse().map((row) => (
                    <tr key={row.id}>
                      <td className={td}>
                        {row.title}
                        <span className="petit block text-gris">
                          {formatShortDate(row.startsAt)}
                        </span>
                      </td>
                      <td className={`${td} ${num}`}>{row.registered}</td>
                      <td className={`${td} ${num}`}>{row.present}</td>
                      <td className={`${td} ${num} font-semibold`}>{percent(row.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <p className="petit mt-3 text-gris">
          Inscrits : inscriptions confirmées (annulées et liste d’attente exclues). Une annulation
          saisie après la rencontre en change le compte.
        </p>
      </Section>

      <Section id="activites-titre" title="Activités les plus suivies">
        <div className="mb-4 flex justify-end">{exportLink("activites", "CSV")}</div>
        {events.activities.length === 0 ? (
          <p className="text-gris">Aucune rencontre sur la période.</p>
        ) : (
          <ChartFigure
            id="activites"
            title="Présences par activité"
            description={
              mode === "all"
                ? "Une rencontre à plusieurs activités compte pour chacune : la somme peut dépasser le total. Note moyenne des avis à partir de 3 avis."
                : "Chaque rencontre compte pour sa seule activité principale. Note moyenne des avis à partir de 3 avis."
            }
            columns={[
              "Activité",
              "Rencontres",
              "Présents",
              "Présents / rencontre",
              "Avis",
              "Note moyenne",
            ]}
            rows={events.activities.map((a) => [
              a.label,
              a.events,
              a.present,
              decimal(a.averagePresent),
              a.ratings,
              a.averageRating === null ? "—" : `${decimal(a.averageRating)} / 5`,
            ])}
          >
            <BarList
              id="activites"
              unit="présents"
              items={events.activities.map((a) => ({
                label: a.label,
                value: a.present,
                note: a.averageRating === null ? undefined : `${decimal(a.averageRating)} / 5`,
              }))}
            />
          </ChartFigure>
        )}
      </Section>

      <Section id="membres-titre" title="Membres">
        <div className="grid gap-x-10 sm:grid-cols-3">
          <Figure
            label="Nouveaux membres"
            value={String(members.newByMonth.reduce((t, m) => t + m.count, 0))}
            hint="première adhésion validée sur la période"
          />
          <Figure
            label="Adhérents à jour"
            value={String(members.current)}
            hint="à la fin de la période"
          />
          <Figure
            label="Membres actifs"
            value={String(members.active)}
            hint={`venus au moins une fois (${percent(members.current ? members.active / members.current : null)} des adhérents)`}
          />
        </div>
        <div className="mt-8 max-w-[48rem]">
          <ChartFigure
            id="nouveaux-mois"
            title="Nouveaux membres par mois"
            description="Date de la première adhésion validée de chaque membre."
            columns={["Mois", "Nouveaux membres"]}
            rows={members.newByMonth.map((m) => [monthLabel(m.month), m.count])}
          >
            <ColumnChart
              id="nouveaux-mois"
              unit="nouveaux membres"
              points={members.newByMonth.map((m) => ({
                label: monthLabel(m.month),
                value: m.count,
              }))}
            />
          </ChartFigure>
          <div className="mt-3">{exportLink("membres", "CSV")}</div>
        </div>
      </Section>

      {inactive ? (
        <Section id="relances-titre" title={`Membres qui ne reviennent plus (${inactive.length})`}>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-gris">
              Adhérents à jour sans présence depuis {weeks} semaines (ou jamais venus depuis leur
              adhésion), à relancer. Données personnelles : réservé aux responsables.
            </p>
            {exportLink("relances", "CSV")}
          </div>
          {inactive.length === 0 ? (
            <p className="text-gris">Tous les adhérents sont venus récemment.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead className="border-b border-indigo/30">
                  <tr>
                    <th className={th}>Membre</th>
                    <th className={th}>Contact</th>
                    <th className={th}>Dernière présence</th>
                    <th className={th}>Adhérent depuis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-trait">
                  {inactive.map((member) => (
                    <tr key={member.id}>
                      <td className={td}>
                        <span className="font-semibold">{member.name}</span>
                        <span className="petit block text-gris">{member.memberNumber}</span>
                      </td>
                      <td className={`${td} break-all`}>
                        {member.email}
                        {member.phone ? (
                          <span className="petit block text-gris">{member.phone}</span>
                        ) : null}
                      </td>
                      <td className={td}>
                        {member.lastAttended ? formatShortDate(member.lastAttended) : "Jamais venu"}
                      </td>
                      <td className={td}>{formatShortDate(member.memberSince)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : null}

      <Section id="attente-titre" title="Listes d’attente">
        <div className="grid gap-x-10 sm:grid-cols-2 xl:grid-cols-4">
          <Figure
            label="Rencontres complètes"
            value={String(events.waitlists.full)}
            hint="places toutes prises, ou liste d’attente ouverte"
          />
          <Figure
            label="Personnes en attente"
            value={String(events.waitlists.waited)}
            hint="au total"
          />
          <Figure
            label="Inscrites depuis la liste"
            value={String(events.waitlists.promoted)}
            hint="une place s’est libérée"
          />
          <Figure
            label="Restées en attente"
            value={String(events.waitlists.stayed)}
            hint="sans place à la fin"
          />
        </div>
        {events.waitlists.rows.length > 0 ? (
          <div className="mt-6 overflow-x-auto">
            <div className="mb-3 flex justify-end">{exportLink("attente", "CSV")}</div>
            <table className="w-full min-w-[36rem] border-collapse">
              <thead className="border-b border-indigo/30">
                <tr>
                  <th className={th}>Rencontre complète</th>
                  <th className={`${th} ${num}`}>Places</th>
                  <th className={`${th} ${num}`}>En attente</th>
                  <th className={`${th} ${num}`}>Inscrites</th>
                  <th className={`${th} ${num}`}>Restées</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trait">
                {events.waitlists.rows.map((row) => (
                  <tr key={row.id}>
                    <td className={td}>
                      {row.title}
                      <span className="petit block text-gris">{formatShortDate(row.startsAt)}</span>
                    </td>
                    <td className={`${td} ${num}`}>{row.capacity}</td>
                    <td className={`${td} ${num}`}>{row.waited}</td>
                    <td className={`${td} ${num}`}>{row.promoted}</td>
                    <td className={`${td} ${num}`}>{row.stayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>
    </>
  );
}

export default function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  return (
    <>
      <AdminPageHeader title="Statistiques">
        Fréquentation des rencontres, activités, membres et listes d’attente, sur la période de
        votre choix. Heure de Dakar.
      </AdminPageHeader>
      <Suspense fallback={<AdminListSkeleton />}>
        <Stats searchParams={searchParams} />
      </Suspense>
    </>
  );
}

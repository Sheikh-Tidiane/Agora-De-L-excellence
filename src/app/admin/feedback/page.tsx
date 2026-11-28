import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { buttonVariants } from "@/components/ui/button";
import { eventTypeCodes, eventTypeLabels } from "@/config/activities";
import { Select } from "@/components/ui/field";
import { getFeedbackOverview } from "@/features/feedback/queries";
import { MIN_RATINGS_FOR_AVERAGE } from "@/features/feedback/rules";
import { formatShortDate } from "@/lib/dates";
import { requirePageAccess } from "@/lib/permissions";

export const metadata: Metadata = { title: "Avis des rencontres" };

const periods = { "3": "3 derniers mois", "12": "12 derniers mois", "36": "3 dernières années" };
const th = "petit py-2.5 pr-4 text-left font-semibold text-gris";
const td = "py-3 pr-4 align-top";
const num = "text-right tabular-nums";
const average = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("fr-FR", { minimumFractionDigits: 1 });
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function Feedback({ searchParams }: Pick<PageProps<"/admin/feedback">, "searchParams">) {
  await requirePageAccess("feedback.read", "/admin/feedback");
  const query = await searchParams;
  const period = (one(query.periode) ?? "12") as keyof typeof periods;
  const months = Number(period in periods ? period : "12");
  const activity = eventTypeCodes.find((code) => code === one(query.activite)) ?? null;
  const mode = one(query.mode) === "principale" ? "primary" : "all";
  const from = new Date();
  from.setUTCMonth(from.getUTCMonth() - months);
  const { rows, activities, total } = await getFeedbackOverview({ from, activity, mode });

  return (
    <>
      <form className="mb-8 flex flex-wrap items-end gap-3" aria-label="Filtres">
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Période</span>
          <Select name="periode" defaultValue={String(months)}>
            {Object.entries(periods).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Activité</span>
          <Select name="activite" defaultValue={activity ?? ""}>
            <option value="">Toutes</option>
            {eventTypeCodes.map((code) => (
              <option key={code} value={code}>
                {eventTypeLabels[code]}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="petit font-semibold">Rencontres à plusieurs activités</span>
          <Select name="mode" defaultValue={mode === "primary" ? "principale" : "toutes"}>
            <option value="toutes">Comptées pour chaque activité</option>
            <option value="principale">Activité principale seulement</option>
          </Select>
        </label>
        <button type="submit" className={buttonVariants({ variant: "contour" })}>
          Afficher
        </button>
      </form>

      <div className="grid gap-x-10 sm:grid-cols-3">
        {[
          ["Avis reçus", String(total.count), "sur la période"],
          ["Note moyenne", average(total.average), "sur 5"],
          [
            "Taux de réponse",
            total.responseRate === null ? "—" : `${Math.round(total.responseRate * 100)} %`,
            "avis / membres présents",
          ],
        ].map(([label, value, hint]) => (
          <div key={label} className="border-t border-indigo py-5">
            <p className="petit text-gris">{label}</p>
            <p className="mt-1.5 font-serif text-[2.25rem] leading-none tabular-nums">{value}</p>
            <p className="petit mt-2 text-gris">{hint}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="activites-titre" className="mt-10">
        <h2 id="activites-titre" className="titre-3">
          Par activité
        </h2>
        {activities.length === 0 ? (
          <p className="mt-3 text-gris">Aucun avis sur la période.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse">
              <thead className="border-b border-indigo/30">
                <tr>
                  <th className={th}>Activité</th>
                  <th className={`${th} ${num}`}>Rencontres</th>
                  <th className={`${th} ${num}`}>Avis</th>
                  <th className={`${th} ${num}`}>Moyenne</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trait">
                {activities.map((row) => (
                  <tr key={row.code}>
                    <td className={td}>{row.label}</td>
                    <td className={`${td} ${num}`}>{row.events}</td>
                    <td className={`${td} ${num}`}>{row.count}</td>
                    <td className={`${td} ${num} font-semibold`}>{average(row.average)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="petit mt-3 text-gris">
          {mode === "all"
            ? "Une rencontre à plusieurs activités compte pour chacune : la somme par activité peut dépasser le total."
            : "Chaque rencontre ne compte que pour son activité principale."}{" "}
          Moyenne affichée à partir de {MIN_RATINGS_FOR_AVERAGE} avis.
        </p>
      </section>

      <section aria-labelledby="rencontres-titre" className="mt-12">
        <h2 id="rencontres-titre" className="titre-3">
          Par rencontre
        </h2>
        {rows.length === 0 ? (
          <EmptyState title="Aucune rencontre sur la période" className="pt-4">
            Les avis arrivent le lendemain de chaque rencontre, de la part des membres pointés
            présents.
          </EmptyState>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[46rem] border-collapse">
              <thead className="border-b border-indigo/30">
                <tr>
                  <th className={th}>Rencontre</th>
                  <th className={`${th} ${num}`}>Présents</th>
                  <th className={`${th} ${num}`}>Avis</th>
                  <th className={`${th} ${num}`}>Moyenne</th>
                  <th className={th}>Répartition (1 → 5)</th>
                  <th className={`${th} ${num}`}>Commentaires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-trait">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className={td}>
                      <Link href={`/admin/feedback/${row.id}`} className="lien font-semibold">
                        {row.title}
                      </Link>
                      <span className="petit block text-gris">
                        {formatShortDate(row.startsAt)} · {row.activities.join(", ")}
                      </span>
                    </td>
                    <td className={`${td} ${num}`}>{row.present}</td>
                    <td className={`${td} ${num}`}>
                      {row.count}
                      {row.present > 0 ? (
                        <span className="petit block text-gris">
                          {Math.min(100, Math.round((row.count / row.present) * 100))} %
                        </span>
                      ) : null}
                    </td>
                    <td className={`${td} ${num} font-semibold`}>{average(row.average)}</td>
                    <td className={`${td} tabular-nums`}>{row.distribution.join(" · ")}</td>
                    <td className={`${td} ${num}`}>
                      {row.comments}
                      {row.hidden > 0 ? (
                        <span className="petit block text-gris">{row.hidden} masqué(s)</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default function FeedbackPage({ searchParams }: PageProps<"/admin/feedback">) {
  return (
    <>
      <AdminPageHeader title="Avis des rencontres">
        Notes et commentaires des membres présents, le lendemain de chaque rencontre. Jamais publiés
        : réservés aux responsables.
      </AdminPageHeader>
      <Suspense fallback={<AdminListSkeleton />}>
        <Feedback searchParams={searchParams} />
      </Suspense>
    </>
  );
}

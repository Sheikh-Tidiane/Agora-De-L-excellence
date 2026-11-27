import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminListSkeleton, AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import {
  AttendanceModeEditor,
  GrantPointsForm,
  ManualBadgeForm,
  MemberPicker,
  ReverseLine,
  RuleEditor,
} from "@/features/gamification/components/points-admin";
import {
  listMemberTransactions,
  listPointRules,
  memberPointsTotal,
} from "@/features/gamification/queries";
import { getAttendancePointMode } from "@/features/gamification/service";
import { formatDate } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Points et badges" };

async function Points({
  searchParams,
}: {
  searchParams: PageProps<"/admin/points">["searchParams"];
}) {
  const actor = await requirePageAccess("points.grant", "/admin/points");
  const { membre } = await searchParams;
  const memberId = typeof membre === "string" ? membre : null;
  const [rules, members, manualBadges, attendanceMode] = await Promise.all([
    listPointRules(),
    prisma.user.findMany({
      where: { memberNumber: { not: null }, archivedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 2000,
      select: { id: true, firstName: true, lastName: true, memberNumber: true },
    }),
    prisma.badge.findMany({
      where: { criterion: "MANUAL", isActive: true },
      select: { code: true, name: true },
    }),
    getAttendancePointMode(),
  ]);
  const member = memberId ? members.find((m) => m.id === memberId) : undefined;
  const history = member ? await listMemberTransactions(member.id) : [];
  // Le total vient du grand livre entier : l'historique affiché s'arrête aux 200 dernières lignes.
  const total = member ? await memberPointsTotal(member.id) : 0;
  const isSelf = member?.id === actor.id;

  return (
    <>
      <AdminPageHeader title="Points et badges">
        Les points s’attribuent d’eux-mêmes (présences, lectures validées, critiques approuvées).
        Ici : le barème, les ajustements motivés et les corrections, toujours inscrits au journal.
      </AdminPageHeader>

      <div className="grid gap-x-12 gap-y-12 xl:grid-cols-12">
        <section aria-labelledby="membre-titre" className="xl:col-span-7">
          <h2 id="membre-titre" className="titre-3 border-b border-indigo/30 pb-2">
            Points d’un membre
          </h2>
          <div className="mt-5 max-w-md">
            <MemberPicker
              selected={member?.id ?? null}
              members={members.map((m) => ({
                id: m.id,
                label: `${m.lastName} ${m.firstName} · ${m.memberNumber}`,
              }))}
            />
          </div>

          {member ? (
            <div className="mt-8">
              <p className="flex items-baseline gap-2">
                <span className="font-serif text-[2.5rem] leading-none tabular-nums">{total}</span>
                <span className="text-gris">
                  points · {member.firstName} {member.lastName}
                </span>
              </p>
              {isSelf ? (
                <p className="petit mt-3 rounded-champ bg-alerte-fond px-4 py-3 font-semibold text-alerte">
                  Un responsable n’ajuste pas ses propres points : demandez à un autre responsable.
                </p>
              ) : (
                <div className="mt-6 grid gap-8 lg:grid-cols-2">
                  <div>
                    <h3 className="surtitre mb-3">Ajustement</h3>
                    <GrantPointsForm userId={member.id} />
                  </div>
                  {can(actor, "badges.award") && manualBadges.length > 0 ? (
                    <div>
                      <h3 className="surtitre mb-3">Badge décerné</h3>
                      <ManualBadgeForm userId={member.id} badges={manualBadges} />
                    </div>
                  ) : null}
                </div>
              )}

              <h3 className="surtitre mt-10">Historique</h3>
              {history.length === 0 ? (
                <p className="mt-3 text-gris">Aucun point pour l’instant.</p>
              ) : (
                <ul className="mt-3 border-b border-indigo/15">
                  {history.map((line) => (
                    <li
                      key={line.id}
                      className="flex flex-wrap items-start gap-x-4 gap-y-1 border-t border-indigo/15 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn("font-semibold", line.reversed && "text-gris line-through")}
                        >
                          {line.label}
                        </p>
                        <p className="petit text-gris">
                          {formatDate(line.createdAt)}
                          {line.createdByName ? ` · ${line.createdByName}` : " · automatique"}
                          {line.reason ? ` · ${line.reason}` : null}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "font-serif text-lg tabular-nums",
                          line.points < 0 && "text-erreur",
                        )}
                      >
                        {line.points > 0 ? "+" : ""}
                        {line.points}
                      </span>
                      {line.reversed ? (
                        <StatusPill tone="neutre">Corrigée</StatusPill>
                      ) : line.isCorrection ? (
                        <StatusPill tone="alerte">Correction</StatusPill>
                      ) : !isSelf ? (
                        <ReverseLine transactionId={line.id} />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="mt-6 text-gris">Choisissez un membre pour voir son historique.</p>
          )}
        </section>

        <section aria-labelledby="bareme-titre" className="xl:col-span-5">
          <h2 id="bareme-titre" className="titre-3 border-b border-indigo/30 pb-2">
            Barème
          </h2>
          <p className="petit mt-3 text-gris">
            Un changement vaut pour les points attribués ensuite ; le passé n’est pas recalculé. Une
            règle désactivée ne rapporte plus rien.
          </p>
          <div className="mt-5 border-b border-indigo/15 pb-5">
            {can(actor, "points.rules.manage") ? (
              <AttendanceModeEditor mode={attendanceMode} />
            ) : (
              <p>
                <span className="font-semibold">
                  Présence à une rencontre à plusieurs activités :{" "}
                </span>
                {attendanceMode === "PRIMARY_ONLY"
                  ? "points de l’activité principale seulement."
                  : "points de chaque activité."}
              </p>
            )}
          </div>
          <ul className="mt-4">
            {rules.map((rule) => (
              <li key={rule.id} className="border-b border-indigo/15 py-4">
                <p className="font-semibold">{rule.label}</p>
                {rule.description ? <p className="petit text-gris">{rule.description}</p> : null}
                <div className="mt-3">
                  {can(actor, "points.rules.manage") ? (
                    <RuleEditor rule={rule} />
                  ) : (
                    <p className="tabular-nums">
                      {rule.points} points{rule.isActive ? "" : " · désactivée"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export default function AdminPointsPage({ searchParams }: PageProps<"/admin/points">) {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Points searchParams={searchParams} />
    </Suspense>
  );
}

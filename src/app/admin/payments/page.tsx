import { paymentMethodText } from "@/features/payments/methods";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminListSkeleton, AdminPageHeader, StatusPill } from "@/components/admin/page-header";
import { EmptyState } from "@/components/shared/states";
import { sum, totalsByMonth, totalsBySession } from "@/features/payments/summary";
import { loadClubSettings } from "@/features/settings/club";
import { formatDate, formatMonthYear, formatShortDate } from "@/lib/dates";
import { formatFcfa } from "@/lib/money";
import { requirePageAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Encaissements" };

const kindLabels = { MEMBERSHIP_CARD: "Carte de membre", SESSION_FEE: "Participation" } as const;

const th = "petit py-2.5 pr-4 text-left font-semibold text-gris";
const td = "py-3 pr-4 align-top";
const num = "text-right tabular-nums";

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-t border-indigo py-5">
      <p className="petit text-gris">{label}</p>
      <p className="mt-1.5 font-serif text-[2.25rem] leading-none tabular-nums xl:text-[2.75rem]">
        {value}
      </p>
      <p className="petit mt-2 text-gris">{hint}</p>
    </div>
  );
}

async function Payments() {
  await requirePageAccess("payments.read", "/admin/payments");
  const now = new Date();
  const [settings, active, recent, unpaid, memberCount] = await Promise.all([
    loadClubSettings(),
    prisma.payment.findMany({
      where: { cancelledAt: null },
      select: { kind: true, amount: true, paidAt: true, eventId: true },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        amount: true,
        paidAt: true,
        method: true,
        reference: true,
        cancelledAt: true,
        cancelReason: true,
        user: { select: { name: true } },
        registration: { select: { guestName: true } },
        event: { select: { title: true } },
        receivedBy: { select: { name: true } },
      },
    }),
    prisma.user.findMany({
      where: {
        memberNumber: { not: null },
        status: { not: "ARCHIVED" },
        payments: { none: { kind: "MEMBERSHIP_CARD", cancelledAt: null } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
      select: { id: true, name: true, memberNumber: true, createdAt: true },
    }),
    prisma.user.count({ where: { memberNumber: { not: null }, status: { not: "ARCHIVED" } } }),
  ]);

  const months = totalsByMonth(active);
  const bySession = totalsBySession(active);
  const sessions = bySession.size
    ? await prisma.event.findMany({
        where: { id: { in: [...bySession.keys()] } },
        orderBy: { startsAt: "desc" },
        select: {
          id: true,
          title: true,
          startsAt: true,
          _count: { select: { registrations: { where: { attendedAt: { not: null } } } } },
        },
      })
    : [];
  const thisMonth = months.find(
    (month) =>
      month.month.getUTCFullYear() === now.getUTCFullYear() &&
      month.month.getUTCMonth() === now.getUTCMonth(),
  );

  return (
    <>
      <AdminPageHeader title="Encaissements">
        Pas de paiement en ligne : la carte se règle en espèces, ou à distance par Wave ou Orange
        Money (référence de la transaction obligatoire), et s’encaisse depuis la fiche d’un membre ;
        la participation, en espèces, en pointant les présents d’une rencontre. Montants en vigueur
        : carte {formatFcfa(settings.membershipCardFee)}, séance {formatFcfa(settings.sessionFee)}.
      </AdminPageHeader>

      <div className="grid gap-x-8 sm:grid-cols-3">
        <Figure
          label="Total encaissé"
          value={formatFcfa(sum(active))}
          hint={`${active.length} encaissement${active.length > 1 ? "s" : ""}, annulations exclues`}
        />
        <Figure
          label={`Ce mois-ci (${formatMonthYear(now)})`}
          value={formatFcfa(thisMonth?.total ?? 0)}
          hint={
            thisMonth
              ? `Cartes ${formatFcfa(thisMonth.cards)} · séances ${formatFcfa(thisMonth.sessions)}`
              : "Aucun encaissement ce mois-ci"
          }
        />
        <Figure
          label="Cartes non réglées"
          value={String(unpaid.length)}
          hint={`sur ${memberCount} membre${memberCount > 1 ? "s" : ""}`}
        />
      </div>

      {active.length === 0 && recent.length === 0 ? (
        <EmptyState title="Aucun encaissement pour l’instant" className="mt-6">
          Le premier apparaîtra ici dès qu’une carte de membre ou une participation aura été
          enregistrée.
        </EmptyState>
      ) : (
        <div className="mt-10 grid gap-x-12 gap-y-12 xl:grid-cols-2">
          <section aria-labelledby="mois-titre">
            <h2 id="mois-titre" className="titre-3">
              Par mois
            </h2>
            <table className="mt-3 w-full border-collapse text-[0.9375rem]">
              <thead>
                <tr className="border-b border-indigo/30">
                  <th scope="col" className={th}>
                    Mois
                  </th>
                  <th scope="col" className={`${th} ${num} max-sm:hidden`}>
                    Cartes
                  </th>
                  <th scope="col" className={`${th} ${num} max-sm:hidden`}>
                    Séances
                  </th>
                  <th scope="col" className={`${th} ${num} pr-0`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month.toISOString()} className="border-b border-trait">
                    <th scope="row" className={`${td} text-left font-semibold capitalize`}>
                      {formatMonthYear(month.month)}
                    </th>
                    <td className={`${td} ${num} max-sm:hidden`}>{formatFcfa(month.cards)}</td>
                    <td className={`${td} ${num} max-sm:hidden`}>{formatFcfa(month.sessions)}</td>
                    <td className={`${td} ${num} pr-0 font-semibold`}>{formatFcfa(month.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section aria-labelledby="seances-titre">
            <h2 id="seances-titre" className="titre-3">
              Par séance
            </h2>
            {sessions.length === 0 ? (
              <p className="mt-3 border-t border-indigo/30 py-4 text-gris">
                Aucune participation encaissée pour l’instant.
              </p>
            ) : (
              <table className="mt-3 w-full border-collapse text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-indigo/30">
                    <th scope="col" className={th}>
                      Rencontre
                    </th>
                    <th scope="col" className={`${th} ${num} max-sm:hidden`}>
                      Présents
                    </th>
                    <th scope="col" className={`${th} ${num}`}>
                      Payants
                    </th>
                    <th scope="col" className={`${th} ${num} pr-0`}>
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => {
                    const totals = bySession.get(session.id)!;
                    return (
                      <tr key={session.id} className="border-b border-trait">
                        <th scope="row" className={`${td} text-left font-normal`}>
                          <Link href={`/admin/events/${session.id}`} className="lien">
                            {session.title}
                          </Link>
                          <span className="petit block text-gris tabular-nums">
                            {formatShortDate(session.startsAt)}
                          </span>
                        </th>
                        <td className={`${td} ${num} max-sm:hidden`}>
                          {session._count.registrations}
                        </td>
                        <td className={`${td} ${num}`}>{totals.count}</td>
                        <td className={`${td} ${num} pr-0 font-semibold`}>
                          {formatFcfa(totals.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      <div className="mt-12 grid gap-x-12 gap-y-12 xl:grid-cols-2">
        <section aria-labelledby="impayes-titre">
          <h2 id="impayes-titre" className="titre-3">
            Cartes non réglées
          </h2>
          {unpaid.length === 0 ? (
            <p className="mt-3 border-t border-indigo/30 py-4 text-gris">
              {memberCount === 0
                ? "Aucun membre pour l’instant."
                : "Toutes les cartes sont réglées."}
            </p>
          ) : (
            <ul className="mt-3 border-t border-indigo/30">
              {unpaid.map((member) => (
                <li key={member.id} className="border-b border-trait">
                  <Link
                    href={`/admin/members?open=${member.id}`}
                    className="group flex min-h-12 items-center justify-between gap-4 py-2.5"
                  >
                    <span>
                      <span className="font-semibold decoration-terracotta underline-offset-4 group-hover:underline">
                        {member.name}
                      </span>
                      <span className="petit block text-gris tabular-nums">
                        {member.memberNumber} · membre depuis le {formatShortDate(member.createdAt)}
                      </span>
                    </span>
                    <span className="petit shrink-0 font-semibold text-terracotta-fonce">
                      Encaisser
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="derniers-titre">
          <h2 id="derniers-titre" className="titre-3">
            Derniers encaissements
          </h2>
          {recent.length === 0 ? (
            <p className="mt-3 border-t border-indigo/30 py-4 text-gris">Rien à afficher.</p>
          ) : (
            <ul className="mt-3 border-t border-indigo/30">
              {recent.map((payment) => (
                <li
                  key={payment.id}
                  className="flex items-start justify-between gap-4 border-b border-trait py-3"
                >
                  <span className="min-w-0">
                    <span className="font-semibold">
                      {payment.user?.name ?? payment.registration?.guestName ?? "Invité"}
                    </span>
                    <span className="petit block text-gris">
                      {kindLabels[payment.kind]}
                      {payment.event ? ` · ${payment.event.title}` : ""} ·{" "}
                      {paymentMethodText(payment.method, payment.reference)} ·{" "}
                      {formatDate(payment.paidAt)}
                      {payment.receivedBy ? ` · reçu par ${payment.receivedBy.name}` : ""}
                    </span>
                    {payment.cancelledAt ? (
                      <span className="petit mt-1 block text-erreur">
                        Annulé{payment.cancelReason ? ` : ${payment.cancelReason}` : ""}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={
                        payment.cancelledAt
                          ? "text-gris tabular-nums line-through"
                          : "font-semibold tabular-nums"
                      }
                    >
                      {formatFcfa(payment.amount)}
                    </span>
                    {payment.cancelledAt ? <StatusPill tone="erreur">Annulé</StatusPill> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Payments />
    </Suspense>
  );
}

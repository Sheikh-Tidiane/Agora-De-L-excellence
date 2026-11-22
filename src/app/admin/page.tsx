import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AdminListSkeleton } from "@/components/admin/page-header";
import { authRoutes } from "@/config/auth";
import { getDashboard } from "@/features/admin/queries";
import { ageRangeLabels } from "@/features/memberships/schemas";
import { getRecentAuditLogs } from "@/features/settings/queries";
import { eventDateParts, formatDateTime, formatFullDate } from "@/lib/dates";
import { can, requirePageAccess } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type Figure = { value: number; label: string; hint?: string; href: string; accent?: boolean };

/** Un chiffre clé : grand corps serif, posé comme une tuile. */
function FigureTile({ figure }: { figure: Figure }) {
  return (
    <Link
      href={figure.href}
      className={cn(
        "group relative flex h-full min-h-[148px] flex-col justify-between rounded-[14px] p-5 transition-transform duration-200 ease-agora hover:-translate-y-0.5",
        figure.accent ? "bg-indigo text-ivoire" : "bg-blanc shadow-posee",
      )}
    >
      <span className="font-serif text-[3.5rem] leading-none tabular-nums">{figure.value}</span>
      <span>
        <span className="block text-[0.9375rem] font-semibold">{figure.label}</span>
        {figure.hint ? (
          <span className={cn("petit block", figure.accent ? "text-ivoire/75" : "text-gris")}>
            {figure.hint}
          </span>
        ) : null}
      </span>
      <ArrowRight
        aria-hidden="true"
        className="absolute top-5 right-5 size-5 opacity-0 transition-opacity group-hover:opacity-100"
      />
    </Link>
  );
}

async function Dashboard() {
  const user = await requirePageAccess("admin.access", authRoutes.admin);
  const now = new Date();
  const [data, logs] = await Promise.all([
    getDashboard(user, now),
    can(user, "audit.read") ? getRecentAuditLogs(6) : [],
  ]);

  const candidates: (Figure | null)[] = [
    data.pendingRequests !== null
      ? {
          value: data.pendingRequests,
          label: data.pendingRequests > 1 ? "Demandes à traiter" : "Demande à traiter",
          hint: "Adhésions en attente",
          href: "/admin/memberships",
          accent: data.pendingRequests > 0,
        }
      : null,
    data.activeMembers !== null
      ? {
          value: data.activeMembers,
          label: data.activeMembers > 1 ? "Membres à jour" : "Membre à jour",
          hint:
            data.pendingActivation! > 0
              ? `${data.pendingActivation} compte${data.pendingActivation! > 1 ? "s" : ""} à activer`
              : data.expiringSoon! > 0
                ? `${data.expiringSoon} échéance${data.expiringSoon! > 1 ? "s" : ""} sous 30 jours`
                : "Adhésion en cours de validité",
          href: "/admin/members",
        }
      : null,
    data.registrations30d !== null
      ? {
          value: data.registrations30d,
          label: data.registrations30d > 1 ? "Inscriptions" : "Inscription",
          hint: "Confirmées sur 30 jours",
          href: "/admin/events",
        }
      : null,
    data.publishedBooks !== null
      ? {
          value: data.publishedBooks,
          label: data.publishedBooks > 1 ? "Livres au catalogue" : "Livre au catalogue",
          href: "/admin/books",
        }
      : null,
    data.publishedArticles !== null
      ? {
          value: data.publishedArticles,
          label: data.publishedArticles > 1 ? "Articles en ligne" : "Article en ligne",
          hint:
            data.draftArticles! > 0
              ? `${data.draftArticles} brouillon${data.draftArticles! > 1 ? "s" : ""}`
              : undefined,
          href: "/admin/articles",
        }
      : null,
  ];
  const figures = candidates.filter((figure): figure is Figure => figure !== null);

  return (
    <>
      <div className="mb-7 lg:mb-9">
        <p className="surtitre">{formatFullDate(now)}</p>
        <h1 className="mt-2 font-serif text-[2rem] leading-tight lg:text-[2.75rem]">
          Bonjour, {user.firstName}.
        </h1>
      </div>

      {figures.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4 xl:grid-cols-5">
          {figures.map((figure) => (
            <li key={figure.label}>
              <FigureTile figure={figure} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gris">
          Utilisez le menu pour ouvrir les rubriques dont vous avez la charge.
        </p>
      )}

      <div className="mt-10 grid gap-x-12 gap-y-10 xl:grid-cols-12">
        {data.pendingRequests !== null ? (
          <section aria-labelledby="demandes-titre" className="xl:col-span-6">
            <div className="flex items-baseline justify-between gap-4 border-b border-indigo/30 pb-2">
              <h2 id="demandes-titre" className="titre-3">
                Demandes en attente
              </h2>
              <Link href="/admin/memberships" className="lien text-[0.9375rem]">
                Tout voir
              </Link>
            </div>
            {data.latestRequests.length === 0 ? (
              <p className="py-5 text-gris">Aucune demande en attente. Tout est traité.</p>
            ) : (
              <ul>
                {data.latestRequests.map((request) => (
                  <li key={request.id} className="border-b border-trait">
                    <Link
                      href={`/admin/memberships?open=${request.id}`}
                      className="flex min-h-12 items-center justify-between gap-4 py-2.5 hover:bg-sable/50"
                    >
                      <span className="font-semibold">
                        {request.firstName} {request.lastName}
                      </span>
                      <span className="petit shrink-0 text-gris">
                        {ageRangeLabels[request.ageRange]} · {formatDateTime(request.createdAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {can(user, "events.manage") ? (
          <section aria-labelledby="rencontres-titre" className="xl:col-span-6">
            <div className="flex items-baseline justify-between gap-4 border-b border-indigo/30 pb-2">
              <h2 id="rencontres-titre" className="titre-3">
                Prochaines rencontres
              </h2>
              <Link href="/admin/events" className="lien text-[0.9375rem]">
                Tout voir
              </Link>
            </div>
            {data.upcomingEvents.length === 0 ? (
              <p className="py-5 text-gris">
                Aucune rencontre publiée à venir.{" "}
                <Link href="/admin/events/new" className="lien">
                  En créer une
                </Link>
              </p>
            ) : (
              <ul>
                {data.upcomingEvents.map((event) => {
                  const date = eventDateParts(event.startsAt);
                  const ratio = event.capacity ? Math.min(1, event.taken / event.capacity) : null;
                  return (
                    <li key={event.id} className="border-b border-trait">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="grid grid-cols-[3.25rem_1fr_auto] items-center gap-3 py-2.5 hover:bg-sable/50"
                      >
                        <span className="font-serif text-[1.375rem] leading-none tabular-nums">
                          {date.day}
                          <span className="surtitre mt-0.5 block text-[0.625rem]!">
                            {date.month}
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{event.title}</span>
                          {ratio !== null ? (
                            <span
                              aria-hidden="true"
                              className="mt-1.5 block h-1 w-full max-w-[220px] rounded-full bg-trait"
                            >
                              <span
                                className={cn(
                                  "block h-1 rounded-full",
                                  ratio >= 1 ? "bg-terracotta" : "bg-indigo",
                                )}
                                style={{ width: `${Math.round(ratio * 100)}%` }}
                              />
                            </span>
                          ) : null}
                        </span>
                        <span className="petit text-right text-gris tabular-nums">
                          {event.capacity
                            ? `${event.taken} / ${event.capacity}`
                            : `${event.taken} inscrit${event.taken > 1 ? "s" : ""}`}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ) : null}

        {can(user, "audit.read") ? (
          <section aria-labelledby="journal-titre" className="xl:col-span-12">
            <div className="flex items-baseline justify-between gap-4 border-b border-indigo/30 pb-2">
              <h2 id="journal-titre" className="titre-3">
                Dernières actions sensibles
              </h2>
              <Link href="/admin/audit" className="lien text-[0.9375rem]">
                Ouvrir le journal
              </Link>
            </div>
            {logs.length === 0 ? (
              <p className="py-5 text-gris">Rien à signaler.</p>
            ) : (
              <ul className="xl:columns-2 xl:gap-x-12">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex break-inside-avoid items-baseline justify-between gap-4 border-b border-trait py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="font-semibold">{log.label}</span>{" "}
                      <span className="text-gris">
                        · {log.target} · par {log.actor}
                      </span>
                    </span>
                    <time
                      dateTime={log.createdAt.toISOString()}
                      className="petit shrink-0 text-gris tabular-nums"
                    >
                      {formatDateTime(log.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </div>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminListSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

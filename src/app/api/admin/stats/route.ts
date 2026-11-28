import { connection } from "next/server";
import { z } from "zod";
import { getEventStats, getInactiveMembers, getMemberStats } from "@/features/stats/queries";
import {
  day as validDay,
  monthLabel,
  parseStatsPeriod,
  parseThreshold,
  partnerView,
} from "@/features/stats/rules";
import { audit } from "@/lib/audit";
import { toCsv, type CsvCell } from "@/lib/csv";
import { AppError, toFailure } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";

const date = z.string().refine((value) => validDay(value) !== null, "Date invalide.");
const querySchema = z.object({
  jeu: z.enum(["presence", "activites", "membres", "attente", "relances", "partenaires"]),
  du: date.optional(),
  au: date.optional(),
  mode: z.enum(["toutes", "principale"]).optional(),
  seuil: z
    .string()
    .regex(/^\d{1,2}$/)
    .optional(),
});

const day = (value: Date) => value.toISOString().slice(0, 10);
const rate = (value: number | null) => (value === null ? "" : Math.round(value * 100));

/**
 * Export CSV des statistiques. Exige `data.export` ET `stats.read` ; la liste des membres à
 * relancer (données personnelles) exige en plus `members.read`. Chaque export est consigné au
 * journal (jeu de données, période, nombre de lignes).
 */
export async function GET(request: Request) {
  // Toujours à la requête : jamais pré-rendue au build (données personnelles, droits).
  await connection();
  try {
    const user = await requirePermission("data.export");
    if (!can(user, "stats.read")) throw new AppError("FORBIDDEN");
    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsed.success) throw new AppError("VALIDATION", "Paramètres invalides.");
    const query = parsed.data;
    if (query.du && query.au && query.du > query.au) {
      throw new AppError("VALIDATION", "La date de début est après la date de fin.");
    }
    if (query.jeu === "relances" && !can(user, "members.read")) throw new AppError("FORBIDDEN");
    const now = new Date();
    const period = parseStatsPeriod({ du: query.du, au: query.au }, now);
    const mode = query.mode === "principale" ? "primary" : "all";

    let headers: string[];
    let rows: CsvCell[][];
    if (query.jeu === "relances") {
      const weeks = parseThreshold(query.seuil);
      const members = await getInactiveMembers(weeks, now);
      headers = [
        "Nom",
        "N° de membre",
        "E-mail",
        "Téléphone",
        "Dernière présence",
        "Adhérent depuis",
      ];
      rows = members.map((m) => [
        m.name,
        m.memberNumber,
        m.email,
        m.phone,
        m.lastAttended ? day(m.lastAttended) : "jamais venu",
        day(m.memberSince),
      ]);
    } else if (query.jeu === "membres") {
      const members = await getMemberStats(period, now);
      headers = ["Mois", "Nouveaux membres"];
      rows = members.newByMonth.map((m) => [m.month, m.count]);
    } else {
      const events = await getEventStats(period, mode, now);
      if (query.jeu === "presence") {
        headers = ["Date", "Rencontre", "Inscrits", "Présents", "Taux de présence (%)"];
        rows = events.attendance.map((r) => [
          day(r.startsAt),
          r.title,
          r.registered,
          r.present,
          rate(r.rate),
        ]);
      } else if (query.jeu === "activites") {
        headers = ["Activité", "Rencontres", "Présents", "Avis", "Note moyenne"];
        rows = events.activities.map((a) => [
          a.label,
          a.events,
          a.present,
          a.ratings,
          a.averageRating,
        ]);
      } else if (query.jeu === "attente") {
        headers = [
          "Date",
          "Rencontre",
          "Places",
          "Confirmés",
          "En attente",
          "Inscrites depuis la liste",
          "Restées en attente",
        ];
        rows = events.waitlists.rows.map((r) => [
          day(r.startsAt),
          r.title,
          r.capacity,
          r.confirmed,
          r.waited,
          r.promoted,
          r.stayed,
        ]);
      } else {
        const members = await getMemberStats(period, now);
        const stats = partnerView({
          summary: events.summary,
          byMonth: events.byMonth,
          activities: events.activities,
          waitlists: events.waitlists,
          newMembers: members.newByMonth.reduce((t, m) => t + m.count, 0),
          currentMembers: members.current,
        });
        headers = ["Indicateur", "Valeur"];
        rows = [
          ["Rencontres", stats.events],
          ["Présences", stats.present],
          ["Taux de présence (%)", rate(stats.rate)],
          ["Nouveaux membres", stats.newMembers],
          ["Adhérents", stats.currentMembers],
          ["Rencontres complètes", stats.waitlists.full],
          ["Personnes en attente", stats.waitlists.waited],
          ["Places obtenues sur liste d'attente", stats.waitlists.promoted],
          ...stats.byMonth.map((m): CsvCell[] => [`Présences · ${monthLabel(m.month)}`, m.present]),
          ...stats.activities.map((a): CsvCell[] => [`Présences · ${a.label}`, a.present]),
        ];
      }
    }

    await audit({
      actorId: user.id,
      action: "data.exported",
      entityType: "Stats",
      entityId: query.jeu,
      metadata: {
        dataset: query.jeu,
        from: period.du,
        to: period.au,
        mode,
        rows: rows.length,
        ...(query.jeu === "relances" ? { weeks: parseThreshold(query.seuil) } : {}),
      },
    });
    return new Response(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="statistiques-${query.jeu}-${period.du}_${period.au}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const failure = toFailure(error, "stats.export");
    const status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400 }[
      failure.code as string
    ];
    return new Response(failure.message, { status: status ?? 500 });
  }
}

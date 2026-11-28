import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";
import { formatDateTime } from "@/lib/dates";
import { AppError, toFailure } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const statusLabels = {
  CONFIRMED: "Confirmée",
  PENDING: "À confirmer",
  CANCELLED: "Annulée",
  WAITLISTED: "Liste d’attente",
};

/**
 * Export CSV des inscrits à un événement. Exige `data.export` ET `events.manage` ;
 * chaque export est tracé dans le journal (qui, quel événement, combien de lignes).
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/events/[id]/registrations">,
) {
  try {
    const user = await requirePermission("data.export");
    if (!can(user, "events.manage")) throw new AppError("FORBIDDEN");
    const { id } = await params;
    if (!/^[a-z0-9]{1,40}$/i.test(id)) throw new AppError("NOT_FOUND");
    const event = await prisma.event.findUnique({
      where: { id },
      select: {
        title: true,
        registrations: {
          orderBy: { createdAt: "asc" },
          include: {
            user: { select: { name: true, email: true, memberNumber: true, phone: true } },
          },
        },
      },
    });
    if (!event) throw new AppError("NOT_FOUND");

    const csv = toCsv(
      ["Nom", "E-mail", "Qualité", "N° de membre", "Téléphone", "Statut", "Inscrit le", "Présence"],
      event.registrations.map((r) => [
        r.user?.name ?? r.guestName,
        r.user?.email ?? r.guestEmail,
        r.userId ? "Membre" : "Invité",
        r.user?.memberNumber,
        r.user?.phone,
        statusLabels[r.status],
        formatDateTime(r.createdAt),
        r.attendedAt ? "oui" : "",
      ]),
    );
    await audit({
      actorId: user.id,
      action: "data.exported",
      entityType: "Event",
      entityId: id,
      metadata: { rows: event.registrations.length },
    });
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inscrits-${slugify(event.title) || "evenement"}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const failure = toFailure(error, "events.export");
    const status = { UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404 }[failure.code as string];
    return new Response(failure.message, { status: status ?? 500 });
  }
}

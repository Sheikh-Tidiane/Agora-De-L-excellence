import { eventIcs } from "@/features/events/calendar";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * « Ajouter à mon agenda » : la rencontre au format iCalendar. Publique comme la page de la
 * rencontre (ni brouillon ni archive) ; aucune donnée personnelle, jamais le lien de visio.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/events/[slug]/agenda.ics">,
) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response("Introuvable", { status: 404 });
  const event = await prisma.event.findFirst({
    where: { slug, status: { not: "DRAFT" }, archivedAt: null },
    select: {
      id: true,
      slug: true,
      title: true,
      summary: true,
      location: true,
      startsAt: true,
      endsAt: true,
      status: true,
      updatedAt: true,
    },
  });
  if (!event) return new Response("Introuvable", { status: 404 });
  return new Response(eventIcs(event, env.APP_URL), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

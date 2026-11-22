"use server";

import { z } from "zod";
import { placeLabel } from "@/features/events/rules";
import { parseInput, runAction, type ActionResult } from "@/lib/errors";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export type SearchHit = { group: string; label: string; hint: string; href: string };

const searchSchema = z.object({ q: z.string().trim().min(2).max(60) });

/**
 * Recherche globale de l'administration. Chaque famille de résultats n'est interrogée
 * que si l'utilisateur détient la permission de la rubrique correspondante.
 */
export async function adminSearchAction(input: { q: string }): Promise<ActionResult<SearchHit[]>> {
  return runAction("admin.search", async () => {
    const user = await requirePermission("admin.access");
    const { q } = parseInput(searchSchema, input);
    const contains = { contains: q, mode: "insensitive" as const };
    const take = 5;

    const [members, requests, books, events, articles] = await Promise.all([
      can(user, "members.read")
        ? prisma.user.findMany({
            where: {
              archivedAt: null,
              OR: [{ name: contains }, { email: contains }, { memberNumber: contains }],
            },
            take,
            orderBy: { lastName: "asc" },
            select: { id: true, name: true, email: true, memberNumber: true },
          })
        : [],
      can(user, "memberships.review")
        ? prisma.membershipRequest.findMany({
            where: {
              status: "PENDING",
              OR: [{ firstName: contains }, { lastName: contains }, { email: contains }],
            },
            take,
            orderBy: { createdAt: "desc" },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [],
      can(user, "books.manage")
        ? prisma.book.findMany({
            where: {
              archivedAt: null,
              OR: [{ title: contains }, { authors: { some: { name: contains } } }],
            },
            take,
            orderBy: { title: "asc" },
            select: { id: true, title: true, authors: { select: { name: true } } },
          })
        : [],
      can(user, "events.manage")
        ? prisma.event.findMany({
            where: { archivedAt: null, title: contains },
            take,
            orderBy: { startsAt: "desc" },
            select: { id: true, title: true, location: true },
          })
        : [],
      can(user, "articles.manage")
        ? prisma.article.findMany({
            where: { archivedAt: null, title: contains },
            take,
            orderBy: { updatedAt: "desc" },
            select: { id: true, title: true, category: true },
          })
        : [],
    ]);

    return [
      ...members.map((m) => ({
        group: "Membres",
        label: m.name,
        hint: m.memberNumber ? `${m.memberNumber} · ${m.email}` : m.email,
        href: `/admin/members?open=${m.id}`,
      })),
      ...requests.map((r) => ({
        group: "Demandes d’adhésion",
        label: `${r.firstName} ${r.lastName}`,
        hint: r.email,
        href: `/admin/memberships?open=${r.id}`,
      })),
      ...books.map((b) => ({
        group: "Livres",
        label: b.title,
        hint: b.authors.map((a) => a.name).join(", "),
        href: `/admin/books?open=${b.id}`,
      })),
      ...events.map((e) => ({
        group: "Événements",
        label: e.title,
        hint: placeLabel(e.location),
        href: `/admin/events/${e.id}`,
      })),
      ...articles.map((a) => ({
        group: "Articles",
        label: a.title,
        hint: a.category,
        href: `/admin/articles/${a.id}`,
      })),
    ];
  });
}

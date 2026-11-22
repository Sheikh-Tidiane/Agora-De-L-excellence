import { cacheLife, cacheTag } from "next/cache";
import type { z } from "zod";
import { audit } from "@/lib/audit";
import { cacheTags, publicCacheLife } from "@/lib/cache-tags";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { committeeMemberSchema, type CommitteeMemberView } from "@/features/committee/schemas";

/**
 * Comité de pilotage (docs/CONTENUS-CLUB.md, section 2). Seul le nom est obligatoire :
 * rôle, photo et biographie n'ont pas été fournis et restent vides tant que le club ne les saisit pas.
 */
const select = { id: true, name: true, role: true, photo: true, bio: true, position: true };

export { committeeMemberSchema, initials } from "@/features/committee/schemas";
export type { CommitteeMemberInput, CommitteeMemberView } from "@/features/committee/schemas";

export async function loadCommittee(): Promise<CommitteeMemberView[]> {
  return prisma.committeeMember.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select,
  });
}

/** Comité pour la page publique « Le club » (en cache). */
export async function getCommittee(): Promise<CommitteeMemberView[]> {
  "use cache";
  cacheLife(publicCacheLife);
  cacheTag(cacheTags.committee);
  return loadCommittee();
}

export async function saveCommitteeMember(
  data: z.output<typeof committeeMemberSchema>,
  actorId: string,
): Promise<{ id: string }> {
  const values = {
    name: data.name,
    role: data.role || null,
    bio: data.bio || null,
    photo: data.photo || null,
  };
  const duplicate = await prisma.committeeMember.findFirst({
    where: { name: data.name, ...(data.id ? { id: { not: data.id } } : {}) },
    select: { id: true },
  });
  if (duplicate) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: { name: "Cette personne figure déjà dans le comité." },
    });
  }
  return prisma.$transaction(async (tx) => {
    let id = data.id;
    if (id) {
      const found = await tx.committeeMember.findUnique({ where: { id }, select: { id: true } });
      if (!found) throw new AppError("NOT_FOUND", "Membre du comité introuvable.");
      await tx.committeeMember.update({ where: { id }, data: values });
    } else {
      const last = await tx.committeeMember.aggregate({ _max: { position: true } });
      const created = await tx.committeeMember.create({
        data: { ...values, position: (last._max.position ?? -1) + 1 },
        select: { id: true },
      });
      id = created.id;
    }
    await audit(
      {
        actorId,
        action: "committee.updated",
        entityType: "CommitteeMember",
        entityId: id,
        metadata: { operation: data.id ? "update" : "create" },
      },
      tx,
    );
    return { id };
  });
}

export async function removeCommitteeMember(id: string, actorId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const found = await tx.committeeMember.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new AppError("NOT_FOUND", "Membre du comité introuvable.");
    await tx.committeeMember.delete({ where: { id } });
    await audit(
      {
        actorId,
        action: "committee.updated",
        entityType: "CommitteeMember",
        entityId: id,
        metadata: { operation: "delete" },
      },
      tx,
    );
  });
}

/** Déplace un membre d'un cran vers le haut ou le bas de la liste. */
export async function moveCommitteeMember(
  id: string,
  direction: "up" | "down",
  actorId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const members = await tx.committeeMember.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const index = members.findIndex((member) => member.id === id);
    if (index === -1) throw new AppError("NOT_FOUND", "Membre du comité introuvable.");
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= members.length) return;
    [members[index], members[target]] = [members[target]!, members[index]!];
    for (const [position, member] of members.entries()) {
      await tx.committeeMember.update({ where: { id: member.id }, data: { position } });
    }
    await audit(
      {
        actorId,
        action: "committee.updated",
        entityType: "CommitteeMember",
        entityId: id,
        metadata: { operation: "reorder" },
      },
      tx,
    );
  });
}

import { loadClubSettings } from "@/features/settings/club";
import { audit } from "@/lib/audit";
import { addMonths } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { can, type CurrentUser } from "@/lib/permissions/can";
import { prisma, type Db } from "@/lib/prisma";
import { storage, type StorageService } from "@/lib/storage";

/**
 * Gestion des membres par un administrateur : modification, suspension, renouvellement, archivage.
 * Toutes les actions sensibles sont tracées dans `AuditLog`, dans la même transaction.
 */
const ADMIN_PERMISSION = "admin.access";

/** Début d'un renouvellement : à la suite de la période en cours, ou aujourd'hui si elle est échue. */
export function renewalStart(lastEndsAt: Date | null, now: Date): Date {
  return lastEndsAt && lastEndsAt.getTime() > now.getTime() ? lastEndsAt : now;
}

async function loadTarget(db: Db, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      status: true,
      roles: {
        select: {
          role: { select: { permissions: { select: { permission: { select: { code: true } } } } } },
        },
      },
    },
  });
  if (!user || user.status === "ARCHIVED") throw new AppError("NOT_FOUND", "Membre introuvable.");
  const isStaff = user.roles.some(({ role }) =>
    role.permissions.some(({ permission }) => permission.code === ADMIN_PERMISSION),
  );
  return { ...user, isStaff };
}

/** Un compte de responsable ne se suspend ni ne s'archive qu'avec la permission de gérer les rôles. */
function assertMayRestrict(actor: CurrentUser, target: { id: string; isStaff: boolean }) {
  if (target.id === actor.id) {
    throw new AppError(
      "FORBIDDEN",
      "Vous ne pouvez pas appliquer cette action à votre propre compte.",
    );
  }
  if (target.isStaff && !can(actor, "roles.manage")) {
    throw new AppError(
      "FORBIDDEN",
      "Ce compte est celui d’un responsable : seul un super-administrateur peut le suspendre ou l’archiver.",
    );
  }
}

export async function updateMember(
  userId: string,
  data: { firstName: string; lastName: string; phone: string | null },
  actor: CurrentUser,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await loadTarget(tx, userId);
    await tx.user.update({
      where: { id: userId },
      data: { ...data, name: `${data.firstName} ${data.lastName}`.trim() },
    });
    await audit(
      { actorId: actor.id, action: "member.updated", entityType: "User", entityId: userId },
      tx,
    );
  });
}

/** Suspension : le compte ne peut plus se connecter, ses sessions sont fermées tout de suite. */
export async function suspendMember(userId: string, reason: string, actor: CurrentUser) {
  await prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, userId);
    assertMayRestrict(actor, target);
    if (target.status === "SUSPENDED")
      throw new AppError("CONFLICT", "Ce compte est déjà suspendu.");
    if (target.status !== "ACTIVE") {
      throw new AppError("CONFLICT", "Ce compte n’est pas encore activé : rien à suspendre.");
    }
    await tx.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
    await tx.session.deleteMany({ where: { userId } });
    await tx.membership.updateMany({
      where: { userId, status: "ACTIVE" },
      data: { status: "SUSPENDED" },
    });
    await audit(
      {
        actorId: actor.id,
        action: "member.suspended",
        entityType: "User",
        entityId: userId,
        metadata: { reason: reason || null },
      },
      tx,
    );
  });
}

export async function reactivateMember(userId: string, actor: CurrentUser) {
  await prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, userId);
    if (target.status !== "SUSPENDED")
      throw new AppError("CONFLICT", "Ce compte n’est pas suspendu.");
    await tx.user.update({ where: { id: userId }, data: { status: "ACTIVE" } });
    await tx.membership.updateMany({
      where: { userId, status: "SUSPENDED" },
      data: { status: "ACTIVE" },
    });
    await audit(
      { actorId: actor.id, action: "member.reactivated", entityType: "User", entityId: userId },
      tx,
    );
  });
}

/** Renouvellement : une nouvelle période s'ajoute, l'historique reste intact. */
export async function renewMembership(
  userId: string,
  actor: CurrentUser,
): Promise<{ endsAt: Date }> {
  const now = new Date();
  const { membershipDurationMonths } = await loadClubSettings();
  return prisma.$transaction(async (tx) => {
    await loadTarget(tx, userId);
    const last = await tx.membership.findFirst({ where: { userId }, orderBy: { endsAt: "desc" } });
    if (last?.status === "SUSPENDED") {
      throw new AppError(
        "CONFLICT",
        "Réactivez d’abord ce compte avant de renouveler son adhésion.",
      );
    }
    const startsAt = renewalStart(last?.endsAt ?? null, now);
    const endsAt = addMonths(startsAt, membershipDurationMonths);
    await tx.membership.updateMany({
      where: { userId, status: "ACTIVE", endsAt: { lte: now } },
      data: { status: "EXPIRED" },
    });
    const membership = await tx.membership.create({
      data: { userId, status: "ACTIVE", startsAt, endsAt },
    });
    await audit(
      {
        actorId: actor.id,
        action: "membership.renewed",
        entityType: "Membership",
        entityId: membership.id,
        metadata: { userId, endsAt: endsAt.toISOString() },
      },
      tx,
    );
    return { endsAt };
  });
}

/**
 * Archivage : anonymisation, jamais de suppression physique (l'historique est conservé).
 * Nom, e-mail et téléphone sont effacés ; le compte ne peut plus se connecter. Irréversible.
 */
export async function archiveMember(
  userId: string,
  actor: CurrentUser,
  store: Pick<StorageService, "remove"> = storage,
) {
  const photo = await prisma.$transaction(async (tx) => {
    const target = await loadTarget(tx, userId);
    assertMayRestrict(actor, target);
    const { image } = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { image: true },
    });
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.verification.deleteMany({ where: { value: userId } });
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.membership.updateMany({
      where: { userId, status: { in: ["ACTIVE", "SUSPENDED"] } },
      data: { status: "ENDED" },
    });
    // Avis : le commentaire libre peut contenir des données personnelles ; la note reste, sans auteur.
    await tx.eventFeedback.updateMany({
      where: { registration: { userId }, anonymizedAt: null },
      data: {
        registrationId: null,
        comment: null,
        hiddenAt: null,
        hiddenById: null,
        hiddenReason: null,
        anonymizedAt: new Date(),
      },
    });
    await tx.membershipRequest.updateMany({
      where: { userId },
      data: {
        firstName: "Membre",
        lastName: "archivé",
        email: `archive-${userId}@archive.invalid`,
        phone: null,
        motivation: null,
        guardianName: null,
        guardianPhone: null,
      },
    });
    await tx.user.update({
      where: { id: userId },
      data: {
        status: "ARCHIVED",
        archivedAt: new Date(),
        firstName: "Membre",
        lastName: "archivé",
        name: "Membre archivé",
        email: `archive-${userId}@archive.invalid`,
        phone: null,
        image: null,
      },
    });
    await audit(
      { actorId: actor.id, action: "member.archived", entityType: "User", entityId: userId },
      tx,
    );
    return image;
  });
  // Anonymisation : la photo de profil quitte aussi le disque, une fois l'archivage validé.
  if (photo) await store.remove(photo);
}

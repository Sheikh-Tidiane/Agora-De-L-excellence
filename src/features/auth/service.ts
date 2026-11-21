import { createHash, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { authConfig, authRoutes } from "@/config/auth";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { activationEmail } from "@/lib/mail/templates";
import type { RoleCode } from "@/lib/permissions/catalog";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Cycle de vie d'un compte : création (par un responsable ou un script), lien d'activation,
 * définition du mot de passe. Il n'existe pas d'inscription publique.
 * Logique pure côté serveur, sans React : appelée par les actions, les scripts et les tests.
 */
const ACTIVATION_PREFIX = "activation:";
const DAY = 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function displayName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

export type NewAccount = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  roles: RoleCode[];
  isDemo?: boolean;
};

/**
 * Crée un compte en attente d'activation, avec ses rôles. N'envoie rien.
 * `actorId` : le responsable qui crée le compte (`null` pour un script).
 * `db` : transaction en cours, quand le compte doit naître avec autre chose (validation d'une adhésion).
 */
export async function createPendingUser(input: NewAccount, actorId: string | null, db?: Db) {
  const reader = db ?? prisma;
  const email = input.email.trim().toLowerCase();
  if (await reader.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new AppError("CONFLICT", "Un compte existe déjà avec cette adresse e-mail.");
  }
  const roles = await reader.role.findMany({ where: { code: { in: input.roles } } });
  if (roles.length !== new Set(input.roles).size) {
    throw new AppError("NOT_FOUND", "Rôle inconnu. Lancez `pnpm db:seed` pour créer les rôles.");
  }
  const create = async (tx: Db) => {
    const user = await tx.user.create({
      data: {
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        name: displayName(input.firstName, input.lastName),
        email,
        phone: input.phone ?? null,
        status: "PENDING_ACTIVATION",
        isDemo: input.isDemo ?? false,
        roles: { create: roles.map((role) => ({ roleId: role.id, assignedById: actorId })) },
      },
    });
    await audit(
      {
        actorId,
        action: "auth.account_created",
        entityType: "User",
        entityId: user.id,
        metadata: { roles: input.roles },
      },
      tx,
    );
    return user;
  };
  return db ? create(db) : prisma.$transaction(create);
}

/**
 * Génère un lien d'activation à usage unique. Seul le SHA-256 du jeton est stocké ;
 * les liens précédents du même compte sont invalidés.
 */
export async function issueActivationLink(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: { identifier: { startsWith: ACTIVATION_PREFIX }, value: userId },
    }),
    prisma.verification.create({
      data: {
        identifier: ACTIVATION_PREFIX + hashToken(token),
        value: userId,
        expiresAt: new Date(Date.now() + authConfig.activationLinkDays * DAY),
      },
    }),
  ]);
  return `${env.APP_URL}${authRoutes.activate}?token=${token}`;
}

/** Envoie (ou renvoie) l'e-mail d'activation à un compte qui n'a pas encore de mot de passe. */
export async function sendActivationEmail(userId: string, actorId: string | null): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, email: true, status: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Compte introuvable.");
  if (user.status !== "PENDING_ACTIVATION") {
    throw new AppError("CONFLICT", "Ce compte est déjà activé.");
  }
  const url = await issueActivationLink(user.id);
  await sendMail(
    activationEmail({
      to: user.email,
      firstName: user.firstName,
      url,
      validDays: authConfig.activationLinkDays,
    }),
  );
  await audit({
    actorId,
    action: "auth.activation_link_sent",
    entityType: "User",
    entityId: user.id,
  });
}

async function findActivation(token: string) {
  const record = await prisma.verification.findFirst({
    where: { identifier: ACTIVATION_PREFIX + hashToken(token) },
  });
  if (!record || record.expiresAt.getTime() < Date.now()) return null;
  const user = await prisma.user.findUnique({
    where: { id: record.value },
    select: { id: true, firstName: true, status: true },
  });
  if (!user || user.status !== "PENDING_ACTIVATION") return null;
  return { record, user };
}

/** Pour la page d'activation : le prénom à saluer, ou `null` si le lien n'est plus valable. */
export async function getActivationInvite(token: string): Promise<{ firstName: string } | null> {
  if (!token) return null;
  const activation = await findActivation(token);
  return activation ? { firstName: activation.user.firstName } : null;
}

/**
 * Active un compte : enregistre le mot de passe (haché par Better Auth, scrypt),
 * marque l'e-mail comme vérifié, passe le compte à ACTIVE et consomme le jeton.
 */
export async function activateAccount(token: string, password: string): Promise<void> {
  const activation = await findActivation(token);
  if (!activation) {
    throw new AppError(
      "INVALID_TOKEN",
      "Ce lien d’activation n’est plus valable. Demandez-en un nouveau au club.",
    );
  }
  const { record, user } = activation;
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    // Le jeton est consommé en premier : deux activations simultanées ne peuvent pas réussir toutes les deux.
    const consumed = await tx.verification.deleteMany({ where: { id: record.id } });
    if (consumed.count !== 1) throw new AppError("INVALID_TOKEN");
    await tx.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      create: {
        providerId: "credential",
        accountId: user.id,
        userId: user.id,
        password: passwordHash,
      },
      update: { password: passwordHash },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { status: "ACTIVE", emailVerified: true },
    });
    await audit(
      {
        actorId: user.id,
        action: "auth.account_activated",
        entityType: "User",
        entityId: user.id,
      },
      tx,
    );
  });
}

/** Supprime les jetons expirés (activation et réinitialisation). */
export async function purgeExpiredVerifications(): Promise<number> {
  const { count } = await prisma.verification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

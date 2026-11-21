import "server-only";
import QRCode from "qrcode";
import {
  checkCardToken,
  deriveCardKey,
  newCardSerial,
  signCardToken,
} from "@/features/members/card-token";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";

/**
 * Carte de membre : émission, vérification et révocation du jeton du QR code.
 * Le jeton n'expire pas (la carte s'affiche hors ligne, parfois longtemps après son dernier
 * chargement) ; il est révocable (version) et n'est accepté que pour un compte actif.
 * Voir docs/DECISIONS.md, section 10, et docs/REGLES-METIER.md, « Carte de membre ».
 */

let cachedKey: { secret: string; key: Buffer } | undefined;

/** Clé des cartes, dérivée de BETTER_AUTH_SECRET (recalculée seulement si le secret change). */
function cardKey(): Buffer {
  const secret = env.BETTER_AUTH_SECRET;
  if (cachedKey?.secret !== secret) cachedKey = { secret, key: deriveCardKey(secret) };
  return cachedKey.key;
}

/**
 * Jeton de la carte d'un membre actif. Crée le numéro de série à la première émission.
 * Appelé à chaque affichage de la carte : il renvoie le même jeton tant que la carte n'est pas révoquée.
 */
export async function issueCardToken(userId: string, db: Db = prisma): Promise<string> {
  let user = await db.user.findUnique({
    where: { id: userId },
    select: { status: true, cardSerial: true, cardVersion: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Membre introuvable.");
  if (user.status !== "ACTIVE") {
    throw new AppError("FORBIDDEN", "La carte n’est disponible que pour un compte actif.");
  }
  if (!user.cardSerial) {
    // `cardSerial: null` dans la condition : deux affichages simultanés ne créent qu'une série.
    await db.user.updateMany({
      where: { id: userId, cardSerial: null },
      data: { cardSerial: newCardSerial(), cardIssuedAt: new Date() },
    });
    user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { status: true, cardSerial: true, cardVersion: true },
    });
  }
  return signCardToken({ serial: user.cardSerial!, version: user.cardVersion }, cardKey());
}

/** Ce qu'un responsable voit au scan : de quoi reconnaître la personne, rien de plus. */
export type ScannedMember = {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  image: string | null;
};

export type CardRejection =
  | "malformed" // pas un jeton de carte (autre QR, texte tronqué)
  | "bad_signature" // jeton falsifié ou signé avec un autre secret
  | "unknown_card" // signature valide mais aucune carte en base (base restaurée, compte supprimé)
  | "revoked" // carte remplacée par une plus récente
  | "not_activated"
  | "suspended"
  | "archived";

export type CardVerification =
  { ok: true; member: ScannedMember } | { ok: false; reason: CardRejection };

/** Messages destinés au responsable qui scanne. */
export const cardRejectionMessages: Record<CardRejection, string> = {
  malformed: "Ce QR code n’est pas une carte de membre du club.",
  bad_signature: "Carte non reconnue : ce QR code n’a pas été émis par le club.",
  unknown_card: "Carte inconnue : demandez au membre d’ouvrir sa carte à jour.",
  revoked: "Cette carte a été remplacée : demandez au membre d’ouvrir sa carte à jour.",
  not_activated: "Ce compte n’est pas encore activé.",
  suspended: "Ce compte est suspendu.",
  archived: "Ce compte est archivé.",
};

/**
 * Vérifie un jeton scanné. Signature contrôlée d'abord, en temps constant et sans base ;
 * puis carte, version et statut du compte. Ne lève pas : renvoie une raison typée.
 */
export async function verifyCardToken(raw: unknown, db: Db = prisma): Promise<CardVerification> {
  const check = checkCardToken(raw, cardKey());
  if (!check.ok) return check;
  const user = await db.user.findUnique({
    where: { cardSerial: check.payload.serial },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      memberNumber: true,
      image: true,
      status: true,
      cardVersion: true,
    },
  });
  if (!user) return { ok: false, reason: "unknown_card" };
  if (user.cardVersion !== check.payload.version) return { ok: false, reason: "revoked" };
  if (user.status === "SUSPENDED") return { ok: false, reason: "suspended" };
  if (user.status === "ARCHIVED") return { ok: false, reason: "archived" };
  if (user.status !== "ACTIVE") return { ok: false, reason: "not_activated" };
  const { id, firstName, lastName, memberNumber, image } = user;
  return { ok: true, member: { id, firstName, lastName, memberNumber, image } };
}

/**
 * Révoque la carte d'un membre : toutes les cartes affichées ou capturées avant cessent d'être
 * acceptées ; la prochaine ouverture de la carte affiche un nouveau QR. Tracé dans `AuditLog`.
 * `actorId` : le membre lui-même ou le responsable ; `null` pour un script.
 */
export async function revokeCardToken(
  userId: string,
  actorId: string | null,
  reason: string,
): Promise<{ version: number; issuedAt: Date }> {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw new AppError("NOT_FOUND", "Membre introuvable.");
    const issuedAt = new Date();
    const updated = await tx.user.update({
      where: { id: userId },
      data: { cardVersion: { increment: 1 }, cardIssuedAt: issuedAt },
      select: { cardVersion: true },
    });
    await audit(
      {
        actorId,
        action: "member.card_revoked",
        entityType: "User",
        entityId: userId,
        metadata: {
          reason: reason || null,
          version: updated.cardVersion,
          byMember: actorId === userId,
        },
      },
      tx,
    );
    return { version: updated.cardVersion, issuedAt };
  });
}

export type CardQrOptions = {
  /** Marge blanche autour du code, en modules. 2 au moins pour une lecture sur écran. */
  margin?: number;
};

/**
 * Image SVG du QR code d'un jeton (indigo sur blanc), à insérer dans un Server Component :
 * aucun JavaScript côté client. Correction d'erreur « M » : lisible malgré un écran rayé.
 */
export async function cardQrSvg(token: string, options: CardQrOptions = {}): Promise<string> {
  return QRCode.toString(token, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: options.margin ?? 2,
    color: { dark: "#1F2A55", light: "#FFFFFF" },
  });
}

/** Raccourci pour la page de la carte : jeton du membre puis son QR en SVG. */
export async function memberCardQr(
  userId: string,
  options?: CardQrOptions,
): Promise<{ token: string; svg: string }> {
  const token = await issueCardToken(userId);
  return { token, svg: await cardQrSvg(token, options) };
}

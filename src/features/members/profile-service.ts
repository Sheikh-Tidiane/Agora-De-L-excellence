import type { z } from "zod";
import type { ownProfileSchema } from "@/features/members/profile-schemas";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { storage, type StorageService } from "@/lib/storage";

/**
 * Profil du membre par lui-même. Chaque fonction ne touche qu'au compte `userId`, que l'appelant
 * tient de la session (jamais de la saisie) : un membre ne modifie que son propre profil.
 */

export async function getOwnProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      image: true,
      memberNumber: true,
      hiddenFromRankings: true,
    },
  });
}

export async function updateOwnProfile(
  userId: string,
  data: z.output<typeof ownProfileSchema>,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { phone: data.phone, hiddenFromRankings: data.hiddenFromRankings },
  });
}

/**
 * Remplace la photo de profil : l'image est vérifiée et renommée par le stockage, puis l'ancienne
 * est effacée du disque une fois la nouvelle enregistrée en base.
 */
export async function setOwnPhoto(
  userId: string,
  bytes: Uint8Array,
  store: StorageService = storage,
): Promise<string> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!current) throw new AppError("NOT_FOUND", "Compte introuvable.");
  const name = await store.saveImage("avatars", bytes);
  // Écriture conditionnelle : si un autre envoi a changé la photo entre-temps, on n'écrase pas
  // sa référence (son fichier resterait sur le disque, orphelin, impossible à effacer ensuite).
  let replaced: number;
  try {
    ({ count: replaced } = await prisma.user.updateMany({
      where: { id: userId, image: current.image },
      data: { image: name },
    }));
  } catch (error) {
    await store.remove(name);
    throw error;
  }
  if (replaced === 0) {
    await store.remove(name);
    throw new AppError("CONFLICT", "Votre photo vient de changer. Réessayez.");
  }
  if (current.image) await store.remove(current.image);
  return name;
}

export async function removeOwnPhoto(
  userId: string,
  store: StorageService = storage,
): Promise<void> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  if (!current?.image) return;
  const { count } = await prisma.user.updateMany({
    where: { id: userId, image: current.image },
    data: { image: null },
  });
  // Photo déjà remplacée par un envoi simultané : on ne touche ni à la base ni au nouveau fichier.
  if (count === 0) return;
  await store.remove(current.image);
}

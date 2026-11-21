import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { isStoredImage, type ImageFolder } from "@/lib/storage-names";

/**
 * Stockage des images téléversées (CLAUDE.md §4) : type vérifié sur le contenu du fichier
 * (pas sur son nom ni sur l'en-tête envoyé), taille plafonnée, nom régénéré.
 * Implémentation disque local (`UPLOAD_DIR`, hors dépôt). Voir docs/DECISIONS.md :
 * un hébergement sans disque persistant demandera une autre implémentation de `StorageService`.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp"; extension: string };

/** Reconnaît JPEG, PNG et WebP à leur signature. `null` pour tout le reste (SVG compris). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", extension: "jpg" };
  }
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && png.every((byte, i) => bytes[i] === byte)) {
    return { mime: "image/png", extension: "png" };
  }
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

const mimeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function uploadRoot(): string {
  return path.resolve(env.UPLOAD_DIR);
}

export interface StorageService {
  saveImage(folder: ImageFolder, bytes: Uint8Array): Promise<string>;
  read(name: string): Promise<{ bytes: Buffer; mime: string } | null>;
  remove(name: string): Promise<void>;
}

export const storage: StorageService = {
  /** Enregistre une image vérifiée et renvoie son nom (`covers/<aléatoire>.jpg`). */
  async saveImage(folder, bytes) {
    if (bytes.length === 0) throw new AppError("VALIDATION", "Le fichier est vide.");
    if (bytes.length > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION", "L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
    }
    const kind = sniffImage(bytes);
    if (!kind) {
      throw new AppError("VALIDATION", "Format non accepté. Envoyez une image JPEG, PNG ou WebP.");
    }
    const name = `${folder}/${randomBytes(16).toString("hex")}.${kind.extension}`;
    const target = path.join(uploadRoot(), name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
    return name;
  },

  async read(name) {
    if (!isStoredImage(name)) return null;
    try {
      const bytes = await readFile(path.join(uploadRoot(), name));
      return { bytes, mime: mimeByExtension[name.split(".").pop()!]! };
    } catch {
      return null;
    }
  },

  async remove(name) {
    if (!isStoredImage(name)) return;
    await unlink(path.join(uploadRoot(), name)).catch(() => undefined);
  },
};

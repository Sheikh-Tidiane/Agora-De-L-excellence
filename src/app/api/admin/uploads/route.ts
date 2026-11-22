import { NextResponse } from "next/server";
import { toFailure, AppError } from "@/lib/errors";
import { requirePermission, requireUser } from "@/lib/permissions";
import { assertSameOrigin } from "@/lib/same-origin";
import { MAX_IMAGE_BYTES, storage } from "@/lib/storage";
import { imageFolders, uploadUrl, type ImageFolder } from "@/lib/storage-names";
import type { PermissionCode } from "@/lib/permissions";

/**
 * Chaque dossier a sa permission : couvertures (bibliothèque), photos du comité (paramètres).
 * Les photos de profil ont leur propre route (`/api/member/photo`), réservée au membre lui-même.
 */
const folderPermissions: Partial<Record<ImageFolder, PermissionCode>> = {
  covers: "books.manage",
  committee: "settings.manage",
};

const statusByCode: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION: 422,
};

/**
 * Téléversement d'une image : couverture de livre ou photo d'un membre du comité.
 * Le dossier demandé (`?folder=`) fixe la permission exigée.
 * Le type est vérifié sur le contenu du fichier, la taille est plafonnée à 2 Mo
 * et le nom d'origine n'est jamais conservé.
 */
export async function POST(request: Request) {
  try {
    // Le contrôle d'accès passe avant tout examen de la requête : sans session, 401 quoi qu'on envoie.
    await requireUser();
    const asked = new URL(request.url).searchParams.get("folder") ?? "covers";
    const folder = imageFolders.find((name) => name === asked);
    const permission = folder ? folderPermissions[folder] : undefined;
    if (!folder || !permission) throw new AppError("VALIDATION", "Dossier inconnu.");
    await requirePermission(permission);
    // Envoi déclenché depuis un autre site (ou un sous-domaine) : refusé avant toute lecture.
    assertSameOrigin(request);
    // Refus avant lecture si l'en-tête annonce déjà un envoi trop gros.
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new AppError("VALIDATION", "L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
    }
    // Un corps qui n'est pas un formulaire (JSON, texte…) est une saisie invalide, pas une panne.
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Aucun fichier reçu.");
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION", "L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
    }
    const name = await storage.saveImage(folder, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, name, url: uploadUrl(name) });
  } catch (error) {
    const failure = toFailure(error, "uploads.cover");
    return NextResponse.json(failure, { status: statusByCode[failure.code] ?? 500 });
  }
}

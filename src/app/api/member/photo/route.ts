import { NextResponse } from "next/server";
import { removeOwnPhoto, setOwnPhoto } from "@/features/members/profile-service";
import { AppError, toFailure } from "@/lib/errors";
import { requirePermission } from "@/lib/permissions";
import { enforceRateLimit } from "@/lib/rate-limit";
import { assertSameOrigin } from "@/lib/same-origin";
import { MAX_IMAGE_BYTES } from "@/lib/storage";
import { avatarUrl } from "@/lib/storage-names";

const statusByCode: Record<string, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  RATE_LIMITED: 429,
};

/**
 * Photo de profil du membre connecté (Route Handler : un envoi de 2 Mo dépasse la limite
 * de corps des Server Actions). Le compte visé vient toujours de la session, jamais de la requête.
 * Type vérifié sur le contenu, taille plafonnée, nom régénéré (CLAUDE.md §4).
 */
export async function POST(request: Request) {
  try {
    const user = await requirePermission("member.access");
    assertSameOrigin(request);
    await enforceRateLimit("member.photo.user", user.id);
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
      throw new AppError("VALIDATION", "L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
    }
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION", "Aucun fichier reçu.");
    if (file.size > MAX_IMAGE_BYTES) {
      throw new AppError("VALIDATION", "L’image dépasse 2 Mo. Réduisez-la avant de l’envoyer.");
    }
    const name = await setOwnPhoto(user.id, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ ok: true, url: avatarUrl(name) });
  } catch (error) {
    const failure = toFailure(error, "member.photo.upload");
    return NextResponse.json(failure, { status: statusByCode[failure.code] ?? 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requirePermission("member.access");
    assertSameOrigin(request);
    await enforceRateLimit("member.photo.user", user.id);
    await removeOwnPhoto(user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const failure = toFailure(error, "member.photo.remove");
    return NextResponse.json(failure, { status: statusByCode[failure.code] ?? 500 });
  }
}

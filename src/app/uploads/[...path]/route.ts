import { storage } from "@/lib/storage";
import { isPrivateImage } from "@/lib/storage-names";

/**
 * Sert les images téléversées (couvertures). Seuls les noms produits par le stockage sont acceptés :
 * aucun chemin libre n'atteint le disque. Les noms étant aléatoires et jamais réutilisés,
 * la réponse peut être mise en cache longtemps.
 */
export async function GET(_request: Request, { params }: RouteContext<"/uploads/[...path]">) {
  const { path } = await params;
  const name = path.join("/");
  // Les photos de profil ne passent jamais par cette adresse publique (voir /api/member/photo).
  if (isPrivateImage(name)) return new Response("Introuvable", { status: 404 });
  const file = await storage.read(name);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

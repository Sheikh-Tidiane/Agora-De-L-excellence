import { getCurrentUser } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import { isPrivateImage } from "@/lib/storage-names";

/**
 * Sert une photo de profil aux seules personnes connectées (membres, responsables) :
 * jamais au public, jamais en cache partagé. Seuls les noms produits par le stockage sont acceptés.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/member/photo/[...path]">,
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Connexion requise", { status: 401 });
  const { path } = await params;
  const name = path.join("/");
  if (!isPrivateImage(name)) return new Response("Introuvable", { status: 404 });
  const file = await storage.read(name);
  if (!file) return new Response("Introuvable", { status: 404 });
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(file.bytes.length),
      // Nom aléatoire jamais réutilisé : cache long, mais privé au navigateur.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

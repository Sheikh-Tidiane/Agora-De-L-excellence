import "dotenv/config";
import type { EventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Décision du comité (communiquée le 21/11/2026) : le lancement a lieu le samedi 16 janvier 2027,
 * de 16 h à 19 h, au Foyer des jeunes de Yeumbeul Nord. Date et lieu sont confirmés.
 *
 *   pnpm exec tsx scripts/lancement-16-janvier.ts             → affiche l'état actuel, ne modifie rien
 *   pnpm exec tsx scripts/lancement-16-janvier.ts --appliquer  → met à jour l'événement de lancement
 *
 * Seuls la date, l'heure de fin, le lieu, le statut « provisoire » et les activités changent
 * (présentation du club en activité principale, Rendez-vous lecture et Génies du soir, comme au
 * déroulé). Relancé, il ne fait rien.
 */
const SLUG = "lancement-de-l-agora";
const cible = {
  startsAt: new Date("2027-01-16T16:00:00Z"), // Dakar = UTC+0
  endsAt: new Date("2027-01-16T19:00:00Z"),
  location: "Foyer des jeunes de Yeumbeul Nord",
  isTentative: false,
  type: "LANCEMENT_AUTRE" as const,
  activities: ["LANCEMENT_AUTRE", "RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"] as EventType[],
};

async function main() {
  const appliquer = process.argv.includes("--appliquer");
  const event = await prisma.event.findUnique({ where: { slug: SLUG } });
  if (!event) throw new Error(`Événement « ${SLUG} » introuvable.`);
  console.log("Actuel :", {
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt?.toISOString() ?? null,
    location: event.location,
    isTentative: event.isTentative,
    type: event.type,
    activities: event.activities,
  });
  const aJour =
    event.startsAt.getTime() === cible.startsAt.getTime() &&
    event.endsAt?.getTime() === cible.endsAt.getTime() &&
    event.location === cible.location &&
    event.isTentative === cible.isTentative &&
    event.type === cible.type &&
    event.activities.join() === cible.activities.join();
  if (aJour) return console.log("Déjà à jour : rien à faire.");
  if (!appliquer)
    return console.log("Cible :", cible, "\nRelancer avec --appliquer pour mettre à jour.");
  await prisma.event.update({ where: { slug: SLUG }, data: cible });
  console.log(
    "Lancement mis à jour : samedi 16 janvier 2027, 16 h – 19 h, Foyer des jeunes de Yeumbeul Nord ; présentation du club, Rendez-vous lecture et Génies du soir.",
  );
}

main().finally(() => prisma.$disconnect());

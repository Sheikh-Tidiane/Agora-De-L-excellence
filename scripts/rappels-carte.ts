import "dotenv/config";
import { runDueTasks } from "@/features/tasks/registry";
import { prisma } from "@/lib/prisma";

/**
 * Ancien lanceur des rappels « carte à régler », gardé le temps qu'un serveur déjà installé passe à
 * la minuterie commune agora-taches.timer (docs/DEPLOIEMENT.md). Équivaut à :
 *   pnpm taches lancer rappels-carte
 */
async function main() {
  const [outcome] = await runDueTasks(new Date(), { only: "rappels-carte", force: true });
  console.log(outcome!.summary);
  if (!outcome!.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

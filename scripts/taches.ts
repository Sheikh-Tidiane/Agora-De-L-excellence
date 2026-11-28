import "dotenv/config";
import { runDueTasks, tasks } from "@/features/tasks/registry";
import { prisma } from "@/lib/prisma";

/**
 * Tâches planifiées du club (src/features/tasks/registry.ts). Sans doublon : relancées, elles
 * n'envoient rien deux fois.
 *
 *   pnpm taches                       les tâches dont c'est l'heure
 *   pnpm taches liste                 la liste des tâches
 *   pnpm taches lancer <nom>          une tâche, tout de suite (même hors de son heure)
 *
 * En production, chaque heure, par la minuterie deploy/systemd/agora-taches.timer :
 *   bash scripts/prod-compose.sh run --rm -T tools pnpm exec tsx scripts/taches.ts
 */
async function main() {
  const [command, name] = process.argv.slice(2);
  if (command === "liste") {
    for (const task of tasks) console.log(`${task.name} : ${task.description}`);
    return;
  }
  if (command && command !== "lancer") {
    throw new Error("Usage : taches.ts [liste | lancer <nom>]");
  }
  if (command === "lancer" && !name) throw new Error("Usage : taches.ts lancer <nom>");
  const outcomes = await runDueTasks(
    new Date(),
    command === "lancer" ? { only: name, force: true } : {},
  );
  if (outcomes.length === 0) console.log("Aucune tâche à lancer à cette heure.");
  for (const outcome of outcomes) {
    console.log(`${outcome.ok ? "✓" : "✗"} ${outcome.name} : ${outcome.summary}`);
  }
  if (outcomes.some((outcome) => !outcome.ok)) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { sendCardReminders } from "@/features/members/card-reminders";
import { prisma } from "@/lib/prisma";

/**
 * Rappels « carte à régler » : à lancer une fois par jour (relancé, il n'envoie rien en double).
 *
 *   pnpm exec tsx scripts/rappels-carte.ts
 *
 * En production, par la minuterie deploy/systemd/agora-rappels-carte.timer :
 *   bash scripts/prod-compose.sh run --rm -T tools pnpm exec tsx scripts/rappels-carte.ts
 */
async function main() {
  const run = await sendCardReminders();
  console.log(
    `${run.checked} membre(s) avec une carte à régler ; ${run.sent.length} rappel(s) envoyé(s).`,
  );
}

main()
  .catch((error) => {
    console.error(`Échec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { clearDemoData } from "@/lib/demo-data";
import { prisma } from "@/lib/prisma";

// pnpm db:clear-demo — supprime toutes les données marquées `isDemo`.
// Les données de référence (rôles, permissions, barème, badges, catégories) et les vrais contenus restent.
async function main() {
  const counts = await clearDemoData();
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    console.log("Aucune donnée de démonstration en base : rien à supprimer.");
    return;
  }
  console.log("Données de démonstration supprimées :");
  for (const [table, count] of Object.entries(counts)) {
    if (count > 0) console.log(`  - ${table} : ${count}`);
  }
  console.log(
    "Le bandeau « Données de démonstration » disparaît dans les minutes qui suivent (cache).",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

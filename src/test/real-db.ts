import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Base réelle pour les tests d'intégration du moteur de points et du scan (contrainte unique,
 * `ON CONFLICT`, verrous : rien de cela ne se simule honnêtement). L'adresse vient de `.env`
 * (la base Docker de développement). Sans base joignable, ces tests sont sautés et le disent.
 * Les tests écrivent dans une transaction annulée à la fin, ou nettoient ce qu'ils ont créé.
 */
function databaseUrl(): string | null {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  try {
    const line = readFileSync(".env", "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("DATABASE_URL="));
    return line ? line.slice("DATABASE_URL=".length).replace(/^"|"$/g, "") : null;
  } catch {
    return null;
  }
}

const url = databaseUrl();
export const realPrisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: url ?? "postgresql://absent:absent@localhost:1/absent",
  }),
});

export async function databaseReachable(): Promise<boolean> {
  if (!url) return false;
  try {
    await realPrisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    console.warn("Base de données injoignable : tests d'intégration sautés.");
    return false;
  }
}

class Rollback extends Error {}

/** Exécute `fn` dans une transaction toujours annulée : la base reste intacte. */
export async function inRollback(
  fn: (tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0]) => Promise<void>,
): Promise<void> {
  try {
    await realPrisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 60_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** Suffixe unique pour les données d'un test (e-mails, numéros, slugs). */
export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

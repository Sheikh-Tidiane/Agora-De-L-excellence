import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Client Prisma unique (Prisma 7 : adaptateur `pg` obligatoire).
 * En développement, il est conservé sur `globalThis` pour survivre au rechargement à chaud.
 * Jamais importé par un composant client.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type { PrismaClient };
/** Client ou transaction : pour les services qui acceptent d'être appelés dans une transaction. */
export type Db = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0] | PrismaClient;

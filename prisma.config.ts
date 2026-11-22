import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 : l'URL de connexion n'est plus dans schema.prisma mais ici.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

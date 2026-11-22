import { defineConfig, devices } from "@playwright/test";

// Par défaut, les parcours tournent sur un build de production servi sur un port dédié :
// c'est ce que verront les membres, et le serveur de dev (compilation à la demande) est trop lent
// et trop gourmand en mémoire pour des délais fiables. PW_DEV=1 pour tester le serveur de dev.
const dev = !!process.env.PW_DEV;
const port = Number(process.env.PORT ?? (dev ? 3000 : 3210));

/** Parcours critiques. Mobile d'abord : c'est la cible principale. */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  fullyParallel: true,
  // Un seul worker par défaut (PW_WORKERS pour en changer) : les parcours de compte partagent
  // la base et la boîte Mailpit, et la machine de développement a peu de mémoire.
  workers: Number(process.env.PW_WORKERS ?? 1),
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "fr-FR",
    trace: "retain-on-failure",
    // Edge est déjà présent sur Windows : rien à télécharger. PW_CHANNEL=chromium pour l'intégration continue.
    channel: process.env.PW_CHANNEL ?? "msedge",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: dev
      ? `pnpm exec next dev -p ${port}`
      : `pnpm exec next build && pnpm exec next start -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
    timeout: 300_000,
  },
});

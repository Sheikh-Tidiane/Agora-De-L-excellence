import { defineConfig, devices } from "@playwright/test";

/**
 * Essai de bout en bout de la configuration de PRODUCTION (Docker + Caddy + HTTPS), lancée en local
 * sur un faux domaine. Rien n'est démarré ici : la pile tourne déjà (docs/DEPLOIEMENT.md, « Essai
 * en local »). Le navigateur résout le faux domaine vers 127.0.0.1 et accepte le certificat de
 * l'autorité interne de Caddy.
 *
 *   PROD_DOMAIN=agora.test pnpm exec playwright test -c playwright.prod.config.ts
 */
const domain = process.env.PROD_DOMAIN ?? "agora.test";

export default defineConfig({
  testDir: "./e2e-prod",
  outputDir: "./test-results/prod",
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: `https://${domain}`,
    locale: "fr-FR",
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    channel: process.env.PW_CHANNEL ?? "chromium",
    // CHROME_PATH : navigateur déjà installé à utiliser (facultatif).
    launchOptions: {
      executablePath: process.env.CHROME_PATH || undefined,
      args: [
        "--no-proxy-server",
        `--host-resolver-rules=MAP ${domain} 127.0.0.1, MAP www.${domain} 127.0.0.1`,
      ],
    },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});

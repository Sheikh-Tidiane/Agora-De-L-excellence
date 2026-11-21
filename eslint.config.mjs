import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Client Prisma généré
    "src/generated/**",
    // Rapports et profil de navigateur jetable de scripts/lighthouse.mjs
    ".lighthouse/**",
    // Sorties de Playwright, écrites pendant les parcours
    "test-results/**",
    "playwright-report/**",
    // Projet de communication (Remotion), indépendant de l’application
    "communication/**",
  ]),
]);

export default eslintConfig;

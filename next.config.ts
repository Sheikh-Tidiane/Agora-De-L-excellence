import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Adresses de ce poste sur le réseau local : en développement, Next refuse par défaut les
// requêtes venues d'une autre origine que localhost. Les autoriser permet d'ouvrir le serveur de
// dev depuis un téléphone sur le même Wi-Fi (`pnpm dev:lan`). Sans effet en production.
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === "IPv4" && !address.internal)
  .map((address) => address!.address);

const nextConfig: NextConfig = {
  // Production (Docker) : `.next/standalone` contient un serveur `server.js` et le strict
  // nécessaire de node_modules. Voir Dockerfile et docs/DEPLOIEMENT.md. Sans effet en dev.
  output: "standalone",
  cacheComponents: true,
  allowedDevOrigins: lanAddresses,
  // Next journalise par défaut les arguments des Server Actions en développement :
  // ils contiennent des mots de passe et des jetons (ne jamais les logger).
  logging: { serverFunctions: false },
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Toutes les pages : aucune ne peut être affichée dans le cadre d'un autre site (pas de
        // « clickjacking » sur un bouton de l'administration), pas de type deviné par le navigateur,
        // et l'adresse complète (jetons d'activation ou d'annulation) ne part jamais vers un autre site.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Le service worker doit toujours être relu : une mise à jour ne reste pas bloquée par un cache.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

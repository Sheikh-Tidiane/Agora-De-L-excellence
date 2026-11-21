import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * En-têtes de sécurité posés sur toutes les réponses (docs/REVUE-SECURITE.md, constat S2).
 * Sans eux, une page de l'administration pouvait être affichée dans le cadre invisible d'un
 * autre site, qui fait cliquer un responsable connecté sur « Valider » sans qu'il le voie.
 */
describe("en-têtes de sécurité (next.config.ts)", () => {
  it("toutes les adresses : cadre interdit, type non deviné, référent réduit à l'origine", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((rule) => rule.source === "/:path*");
    expect(all).toBeDefined();
    const headers = Object.fromEntries(all!.headers.map(({ key, value }) => [key, value]));
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("le service worker garde ses propres en-têtes", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const sw = rules.find((rule) => rule.source === "/sw.js");
    expect(sw?.headers.map((h) => h.key)).toContain("Service-Worker-Allowed");
  });
});

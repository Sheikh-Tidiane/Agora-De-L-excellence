import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/json-ld";

/**
 * Données structurées (docs/REVUE-SECURITE.md, constat S3) : l'échappement de « < » de l'accueil
 * était sans effet (`"\u003c"` dans une chaîne JS vaut « < » lui-même). Toutes les pages passent
 * maintenant par `serializeJsonLd`.
 */
describe("serializeJsonLd", () => {
  it("un titre qui tente de fermer la balise ne la ferme pas", () => {
    const out = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(out).not.toContain("<");
    expect(out).toContain("\\u003c/script>");
    // Le JSON reste valide et rend la valeur d'origine.
    expect(JSON.parse(out)).toEqual({ name: "</script><script>alert(1)</script>" });
  });

  it("chaque `application/ld+json` de src/app passe par serializeJsonLd", () => {
    const offenders: string[] = [];
    const scan = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(full);
        else if (/\.tsx$/.test(entry.name)) {
          const source = readFileSync(full, "utf8");
          const blocks = source.split("application/ld+json").length - 1;
          const safe = source.split("__html: serializeJsonLd(").length - 1;
          if (blocks > safe) offenders.push(full);
        }
      }
    };
    scan("src/app");
    expect(offenders).toEqual([]);
  });
});

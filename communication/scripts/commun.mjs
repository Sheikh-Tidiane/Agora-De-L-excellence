import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Prépare le projet Remotion une seule fois par commande. */
export const preparer = async () => {
  console.log("Préparation du projet…");
  return bundle({
    entryPoint: path.join(RACINE, "src", "index.ts"),
    publicDir: path.join(RACINE, "assets"),
  });
};

/** Lit les options « --nom valeur » et les arguments positionnels. */
export const lireArguments = (argv) => {
  const positionnels = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const suivant = argv[i + 1];
      if (suivant === undefined || suivant.startsWith("--")) options[a.slice(2)] = true;
      else {
        options[a.slice(2)] = suivant;
        i++;
      }
    } else positionnels.push(a);
  }
  return { positionnels, options };
};

// Lighthouse mobile sur les pages clés : émulation d'un Android milieu de gamme
// (Moto G Power), 4G lente simulée, processeur ralenti 4 fois : les réglages mobiles par défaut
// de Lighthouse. À lancer sur un build de production déjà servi :
//   pnpm exec next build && pnpm exec next start -p 3210
//   node scripts/lighthouse.mjs [http://localhost:3210] [/chemin ...]
// Depuis Git Bash, les chemins se passent sans conversion : MSYS_NO_PATHCONV=1 node scripts/…
// Les rapports JSON vont dans .lighthouse/ (ignoré par Git). Le navigateur est l'Edge déjà présent
// (CHROME_PATH pour un autre), ouvert ici sans fenêtre avec un profil jetable et un port de
// débogage auquel Lighthouse se raccorde.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const base = args.find((arg) => arg.startsWith("http")) ?? "http://localhost:3210";
const asked = args.filter((arg) => arg.startsWith("/"));
const paths = asked.length
  ? asked
  : ["/", "/membership", "/charte", "/archives", "/events/lancement-de-l-agora"];

const port = 9333;
const executable =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].find((path) => existsSync(path));
if (!executable) throw new Error("Navigateur introuvable : renseignez CHROME_PATH.");
const profile = resolve(`.lighthouse/profil-${process.pid}`);
mkdirSync(profile, { recursive: true });
const browser = spawn(
  executable,
  [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: "ignore" },
);
// Le port de débogage met un instant à s'ouvrir.
for (let attempt = 0; attempt < 40; attempt++) {
  const ready = await fetch(`http://127.0.0.1:${port}/json/version`).then(
    (response) => response.ok,
    () => false,
  );
  if (ready) break;
  await new Promise((done) => setTimeout(done, 500));
}

const runs = Number(process.env.LH_RUNS ?? 3);
const rows = [];
try {
  for (const path of paths) {
    const url = base + path;
    // Une requête à blanc : la première réponse après le démarrage du serveur fausse la mesure.
    await fetch(url).then(
      (response) => response.text(),
      () => undefined,
    );
    const name = path === "/" ? "accueil" : path.slice(1).replaceAll("/", "_");
    // Plusieurs passes (LH_RUNS, 3 par défaut) : on garde la médiane, la charge du poste varie.
    const reports = [];
    for (let run = 1; run <= runs; run++) {
      const output = `.lighthouse/${name}-${run}.json`;
      execFileSync(
        "pnpm",
        [
          "dlx",
          "lighthouse",
          url,
          "--quiet",
          "--output=json",
          `--output-path=${output}`,
          "--only-categories=performance,accessibility",
          `--port=${port}`,
        ],
        { stdio: ["ignore", "ignore", "inherit"], shell: true },
      );
      reports.push(JSON.parse(readFileSync(output, "utf8")));
    }
    const score = (item) => item.categories.performance.score;
    reports.sort((a, b) => score(a) - score(b));
    const report = reports[Math.floor(reports.length / 2)];
    const audit = (id) => report.audits[id];
    rows.push({
      page: path,
      performance: Math.round(score(report) * 100),
      passes: reports.map((item) => Math.round(score(item) * 100)).join(" / "),
      accessibilite: Math.round(report.categories.accessibility.score * 100),
      LCP: audit("largest-contentful-paint").displayValue,
      CLS: audit("cumulative-layout-shift").displayValue,
      TBT: audit("total-blocking-time").displayValue,
      poids: `${Math.round(audit("total-byte-weight").numericValue / 1024)} Ko`,
      // Indice de puissance du poste pendant la passe : sous 1 000, Lighthouse sous-note.
      poste: Math.round(report.environment.benchmarkIndex),
    });
    const failed = Object.values(report.categories.accessibility.auditRefs)
      .map((ref) => audit(ref.id))
      .filter((item) => item.score !== null && item.score < 1);
    for (const item of failed) {
      console.log(`  ${path} · accessibilité : ${item.id} — ${item.title}`);
      for (const node of item.details?.items?.slice(0, 5) ?? []) {
        console.log(`      ${node.node?.snippet ?? ""}`);
      }
    }
  }
} finally {
  // Le navigateur est fermé même si une mesure échoue ; son profil part avec lui.
  // Sous Windows, tuer le seul processus parent laisse ses enfants tenir le profil.
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/pid", String(browser.pid), "/T", "/F"], { stdio: "ignore" });
    } else browser.kill();
    await new Promise((done) => setTimeout(done, 1500));
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    // Profil jetable resté sur le disque : sans conséquence, .lighthouse/ est ignoré par Git.
  }
}
console.table(rows);

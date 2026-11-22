// Captures du contrôle qualité visuel.
// Usage : node scripts/captures.mjs [dossier] [chemin...]   (serveur lancé sur le port 3000)
// Mobile d'abord : 375 px, puis 768 px et 1440 px. VIEWPORTS=1440,1280,375 pour l'administration.
// Pages protégées : CAPTURE_EMAIL et CAPTURE_PASSWORD (compte de test local) ouvrent une session avant les captures.
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const out = process.argv[2] ?? "docs/captures";
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ["/"];
const allViewports = {
  375: {
    name: "375",
    width: 375,
    height: 812,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  768: {
    name: "768",
    width: 768,
    height: 1024,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  },
  1280: { name: "1280", width: 1280, height: 800, deviceScaleFactor: 1 },
  1440: { name: "1440", width: 1440, height: 900, deviceScaleFactor: 1 },
};
const viewports = (process.env.VIEWPORTS ?? "375,768,1440")
  .split(",")
  .map((v) => allViewports[v.trim()]);

await mkdir(out, { recursive: true });
// Edge est présent sur Windows : pas de navigateur à télécharger.
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });

// Session facultative, réutilisée par toutes les captures.
let storageState;
if (process.env.CAPTURE_EMAIL && process.env.CAPTURE_PASSWORD) {
  const context = await browser.newContext({ locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.getByLabel("Adresse e-mail").fill(process.env.CAPTURE_EMAIL);
  await page.getByLabel("Mot de passe", { exact: true }).fill(process.env.CAPTURE_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/(member|admin)$/, { timeout: 60_000 });
  storageState = await context.storageState();
  await context.close();
}

for (const entry of paths) {
  // « /chemin?x=1#nom » : capture /chemin?x=1 sous le nom « nom ». Sans #nom, le nom vient du chemin
  // (sans ses paramètres : un jeton ne doit pas finir dans un nom de fichier).
  const [path, label] = entry.split("#");
  const slug =
    label ??
    (path === "/"
      ? "accueil"
      : path
          .split("?")[0]
          .replace(/^\//, "")
          .replace(/[^a-z0-9]+/gi, "-"));
  for (const { name, ...vp } of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
      isMobile: vp.isMobile ?? false,
      hasTouch: vp.hasTouch ?? false,
      locale: "fr-FR",
      storageState,
      // Les apparitions au défilement masqueraient les sections dans une capture pleine page.
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Fait défiler toute la page pour déclencher les images en chargement différé.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `${out}/${slug}-${name}-ecran.png` });
    await page.screenshot({ path: `${out}/${slug}-${name}-page.png`, fullPage: true });
    // SEGMENTS=1 : découpe aussi la page en tranches lisibles pour la revue section par section.
    if (process.env.SEGMENTS) {
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const step = vp.width < 700 ? 1500 : 1300;
      for (let y = 0, i = 1; y < total; y += step, i++) {
        await page.screenshot({
          path: `${out}/${slug}-${name}-tranche-${String(i).padStart(2, "0")}.png`,
          fullPage: true,
          clip: { x: 0, y, width: vp.width, height: Math.min(step, total - y) },
        });
      }
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(
      `${slug} ${name}px : capturé${overflow > 0 ? ` — DÉBORDEMENT horizontal de ${overflow}px` : ""}`,
    );
    await context.close();
  }
}
await browser.close();

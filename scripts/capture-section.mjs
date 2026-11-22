// Capture d'une section précise, pour le contrôle qualité visuel.
// Usage : node scripts/capture-section.mjs <largeur> <chemin> <sélecteur CSS> <fichier.png>
// Le serveur est celui de BASE_URL (défaut : http://localhost:3000).
// CAPTURE_EMAIL et CAPTURE_PASSWORD ouvrent une session avant la capture (pages protégées).
import { chromium } from "@playwright/test";

const [width, path, selector, out] = process.argv.slice(2);
const base = process.env.BASE_URL ?? "http://localhost:3000";
const mobile = Number(width) < 1024;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? "msedge" });
const context = await browser.newContext({
  locale: "fr-FR",
  viewport: { width: Number(width), height: mobile ? 812 : 900 },
  isMobile: mobile,
  hasTouch: mobile,
  reducedMotion: "reduce",
});
const page = await context.newPage();
if (process.env.CAPTURE_EMAIL && process.env.CAPTURE_PASSWORD) {
  await page.goto(base + "/login", { waitUntil: "networkidle" });
  await page.getByLabel("Adresse e-mail").fill(process.env.CAPTURE_EMAIL);
  await page.getByLabel("Mot de passe", { exact: true }).fill(process.env.CAPTURE_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.waitForURL(/\/(member|admin)$/, { timeout: 60_000 });
}
await page.goto(base + path, { waitUntil: "networkidle" });
const target = page.locator(selector).first();
await target.scrollIntoViewIfNeeded();
await target.screenshot({ path: out });
console.log(`${out} : capturé`);
await browser.close();

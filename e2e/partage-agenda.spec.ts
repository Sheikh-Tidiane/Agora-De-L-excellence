import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { emailFor, linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Agenda et partage d'une rencontre, à 375 px et 1440 px :
 * - « Fichier agenda (.ics) » (téléchargé : fuseau Africa/Dakar, lieu, adresse de la page, jamais
 *   le lien de visio) et « Google Agenda » ;
 * - « Partager sur WhatsApp » (wa.me, message : titre, date, heure, lieu, adresse) ; partage natif
 *   du téléphone quand le navigateur le propose (simulé ici), absent sinon ;
 * - aperçu du lien partagé : og:title, og:description, og:url, og:image (PNG 1200 × 630) ;
 * - e-mail de confirmation d'un invité : liens d'agenda.
 */
test.use({ extraHTTPHeaders: randomClient() });

const tool = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/test-user.ts", ...args], {
    encoding: "utf8",
    shell: true,
  })
    .trim()
    .split("\n")
    .pop()!;

const meta = async (page: Page, property: string) =>
  page.locator(`meta[property="${property}"]`).first().getAttribute("content");

test("agenda et partage : .ics, Google Agenda, WhatsApp, partage natif, aperçu, e-mail", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const width = isMobile ? 375 : 1440;
  const viewport = { width, height: isMobile ? 812 : 900 };
  const title = `E2E-Partage-${stamp}-${width}`;
  const guestEmail = `partage-invite-${stamp}-${width}@e2e.agora.test`;
  await page.setViewportSize(viewport);
  try {
    const path = tool("create-reminder-event", title, "30");
    const slug = path.split("/").pop()!;
    await page.goto(path);
    const actions = page.getByRole("region", { name: "Agenda et partage" });
    await expect(actions).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await actions.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `docs/captures/partage/${width}-fiche.png`,
      fullPage: !isMobile,
    });

    // Fichier .ics téléchargé.
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      actions.getByRole("link", { name: "Fichier agenda (.ics)" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${slug}.ics`);
    const ics = await readFile((await download.path())!, "utf8");
    expect(ics).toContain("DTSTART;TZID=Africa/Dakar:");
    expect(ics).toContain("LOCATION:Maison de la culture Douta Seck");
    expect(ics.replace(/\r\n /g, "")).toContain(`/events/${slug}`);
    expect(ics).not.toContain("visio");

    // Google Agenda.
    const google = new URL(
      (await actions.getByRole("link", { name: "Google Agenda" }).getAttribute("href"))!,
    );
    expect(google.origin + google.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(google.searchParams.get("ctz")).toBe("Africa/Dakar");
    expect(google.searchParams.get("text")).toBe(title);

    // WhatsApp.
    const wa = (await actions
      .getByRole("link", { name: "Partager sur WhatsApp" })
      .getAttribute("href"))!;
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    const message = decodeURIComponent(wa.slice("https://wa.me/?text=".length));
    const lines = message.split("\n");
    expect(lines[0]).toBe(title);
    expect(lines[1]).toMatch(/\d{4} à \d+\sh.* · Maison de la culture Douta Seck$/);
    expect(lines[2]).toMatch(new RegExp(`/events/${slug}$`));
    expect(message).not.toContain("visio");

    // Sans partage natif (navigateur de bureau) : pas de bouton « Partager… ».
    await expect(actions.getByRole("button", { name: "Partager…" })).toHaveCount(0);

    // Partage natif simulé (téléphone) : le bouton apparaît et transmet titre, texte, adresse.
    const phone = await browser.newPage({ viewport, extraHTTPHeaders: randomClient() });
    await phone.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: async (data: unknown) => {
          (window as unknown as { __shared: unknown }).__shared = data;
        },
      });
    });
    await phone.goto(path);
    const native = phone
      .getByRole("region", { name: "Agenda et partage" })
      .getByRole("button", { name: "Partager…" });
    await expect(native).toBeVisible();
    await native.click();
    const shared = (await phone.evaluate(
      () => (window as unknown as { __shared: unknown }).__shared,
    )) as { title: string; text: string; url: string };
    expect(shared.title).toBe(title);
    expect(shared.url).toMatch(new RegExp(`/events/${slug}$`));
    expect(shared.text).toContain("Maison de la culture Douta Seck");
    await phone.close();

    // Aperçu du lien partagé.
    expect(await meta(page, "og:title")).toBe(title);
    expect(await meta(page, "og:description")).toMatch(/Maison de la culture Douta Seck/);
    expect(await meta(page, "og:url")).toMatch(new RegExp(`^https?://[^/]+/events/${slug}$`));
    expect(await meta(page, "og:image:width")).toBe("1200");
    const image = (await meta(page, "og:image"))!;
    expect(image).toMatch(new RegExp(`^https?://[^/]+/events/${slug}/opengraph-image`));
    const png = await request.get(new URL(image).pathname + new URL(image).search);
    expect(png.status()).toBe(200);
    expect(png.headers()["content-type"]).toBe("image/png");
    const bytes = await png.body();
    expect(bytes.length).toBeGreaterThan(10_000);
    expect(bytes.length).toBeLessThan(300_000);
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);
    const preview = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await preview.setContent(
      `<img src="data:image/png;base64,${bytes.toString("base64")}" style="display:block">`,
    );
    await preview.screenshot({ path: `docs/captures/partage/apercu-${width}.png` });
    await preview.close();

    // E-mail de confirmation d'un invité : liens d'agenda.
    const form = page.locator("#inscription");
    await form.getByLabel("Prénom et nom").fill("Moussa Diop");
    await form.getByLabel("Adresse e-mail").fill(guestEmail);
    await form.getByRole("button", { name: "Réserver ma place" }).click();
    await page.goto(
      await linkFromEmail(request, {
        to: guestEmail,
        subject: "Confirmez votre inscription",
        path: "/events/registration",
      }),
    );
    await page.getByRole("button", { name: "Confirmer mon inscription" }).click();
    const confirmed = await emailFor(request, { to: guestEmail, subject: "Vous êtes inscrit" });
    expect(confirmed.text).toContain(`${path}/agenda.ics`);
    expect(confirmed.text).toContain("Ajouter à Google Agenda : https://calendar.google.com");
    const file = await request.get(`${path}/agenda.ics`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
  } finally {
    testUser("delete-events", title);
  }
});

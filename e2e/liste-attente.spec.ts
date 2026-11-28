import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { countEmails, emailFor, linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Liste d'attente d'une rencontre d'une seule place :
 * - Awa s'inscrit ; Binta voit « Rejoindre la liste d'attente » et devient 1re ;
 * - un invité demande une place sur la liste, confirme son adresse (Mailpit) et devient 2e ;
 * - Awa annule : Binta est inscrite d'office et reçoit « Une place s'est libérée » ;
 * - le responsable voit la liste et inscrit l'invité à la main, au-delà de la capacité.
 * Contrôle visuel à 375 px et 1440 px, sans défilement horizontal.
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

async function memberPage(
  browser: Browser,
  request: APIRequestContext,
  email: string,
  firstName: string,
  viewport: { width: number; height: number },
) {
  const page = await browser.newPage({ viewport, extraHTTPHeaders: randomClient() });
  const password = `phrase-de-membre-${randomInt(1e6)}`;
  testUser("create", email, firstName, "member");
  testUser("member-number", email);
  await page.goto(
    await linkFromEmail(request, { to: email, subject: "Activez votre compte", path: "/activate" }),
  );
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByLabel("Encore une fois").fill(password);
  await page.getByRole("button", { name: "Activer mon compte" }).click();
  await expect(page).toHaveURL(/\/login\?notice=activated$/);
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).toHaveURL(/\/member$/);
  return page;
}

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

test("liste d’attente : rang, promotion à l’annulation, promotion manuelle", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const width = isMobile ? 375 : 1440;
  const viewport = { width, height: isMobile ? 812 : 900 };
  const title = `E2E-Attente-${stamp}-${width}`;
  const adminEmail = `attente-admin-${stamp}-${width}@e2e.agora.test`;
  const awaEmail = `attente-awa-${stamp}-${width}@e2e.agora.test`;
  const bintaEmail = `attente-binta-${stamp}-${width}@e2e.agora.test`;
  const guestEmail = `attente-invite-${stamp}-${width}@e2e.agora.test`;
  const shot = (p: Page, name: string) =>
    p.screenshot({ path: `docs/captures/liste-attente/${width}-${name}.png`, fullPage: true });
  await page.setViewportSize(viewport);
  const pages: Page[] = [];
  try {
    const { path, id } = JSON.parse(tool("create-waitlist-event", title)) as {
      path: string;
      id: string;
    };

    // Awa prend la seule place.
    const awa = await memberPage(browser, request, awaEmail, "Awa", viewport);
    pages.push(awa);
    await awa.goto(path);
    await awa.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(awa.getByText("Vous êtes inscrit. Nous vous attendons.")).toBeVisible();

    // Binta : complet, elle rejoint la liste d'attente.
    const binta = await memberPage(browser, request, bintaEmail, "Binta", viewport);
    pages.push(binta);
    await binta.goto(path);
    const panel = binta.locator("#inscription");
    await expect(panel.getByText("Toutes les places sont prises.")).toBeVisible();
    await panel.getByRole("button", { name: "Rejoindre la liste d’attente" }).click();
    await expect(panel.getByText(/Vous êtes sur la liste d’attente : 1er/)).toBeVisible();
    await noHorizontalScroll(binta);
    await shot(binta, "membre-en-attente");

    // Un invité demande une place sur la liste, puis confirme son adresse.
    const guest = await browser.newPage({ viewport, extraHTTPHeaders: randomClient() });
    pages.push(guest);
    await guest.goto(path);
    const form = guest.locator("#inscription");
    await expect(form.getByText(/1 personne sur la liste d’attente/)).toBeVisible();
    await form.getByLabel("Prénom et nom").fill("Moussa Diop");
    await form.getByLabel("Adresse e-mail").fill(guestEmail);
    await shot(guest, "invite-formulaire");
    await form.getByRole("button", { name: "Rejoindre la liste d’attente" }).click();
    await expect(form.getByText(/pour prendre votre rang sur la liste d’attente/)).toBeVisible();
    await guest.goto(
      await linkFromEmail(request, {
        to: guestEmail,
        subject: "Confirmez votre place sur la liste",
        path: "/events/registration",
      }),
    );
    await guest.getByRole("button", { name: "Confirmer ma place sur la liste" }).click();
    await expect(
      guest.getByRole("heading", { name: "Vous êtes 2e sur la liste d’attente." }),
    ).toBeVisible();
    await noHorizontalScroll(guest);
    await shot(guest, "invite-rang");

    // Awa annule : Binta est inscrite d'office et prévenue.
    await awa.goto(path);
    await awa.getByRole("button", { name: "Annuler mon inscription" }).click();
    await awa.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(
      awa.locator("#inscription").getByText("Toutes les places sont prises."),
    ).toBeVisible();
    const promoted = await emailFor(request, {
      to: bintaEmail,
      subject: "Une place s’est libérée",
    });
    expect(promoted.text).toContain(title);
    expect(promoted.text).toContain(`${path}/agenda.ics`);
    await binta.reload();
    await expect(binta.getByText("Vous êtes inscrit. Nous vous attendons.")).toBeVisible();
    await guest.reload();
    await expect(
      guest.getByRole("heading", { name: "Vous êtes 1er sur la liste d’attente." }),
    ).toBeVisible();

    // Le responsable voit la liste et inscrit l'invité au-delà de la capacité.
    await signInAsAdmin(page, request, adminEmail);
    await page.goto(`/admin/events/${id}`);
    const list = page.getByRole("list", { name: "Liste d’attente" });
    await expect(list.getByText("Moussa Diop")).toBeVisible();
    await noHorizontalScroll(page);
    await list.scrollIntoViewIfNeeded();
    await shot(page, "admin-liste");
    await list.getByRole("button", { name: "Inscrire" }).click();
    await list.getByRole("button", { name: "Confirmer : dépasser la capacité" }).click();
    await expect(
      page.getByText(/Moussa Diop est inscrit \(au-delà de la capacité\)/),
    ).toBeVisible();
    await expect(page.getByText("Personne n’attend une place.")).toBeVisible();
    const manual = await emailFor(request, { to: guestEmail, subject: "Une place s’est libérée" });
    expect(manual.text).toContain("Le club vous a fait une place");
    expect(await countEmails(request, { to: bintaEmail, subject: "Une place s’est libérée" })).toBe(
      1,
    );
  } finally {
    for (const p of pages) await p.close();
    testUser("delete-events", title);
    for (const email of [awaEmail, bintaEmail, adminEmail]) testUser("delete", email);
  }
});

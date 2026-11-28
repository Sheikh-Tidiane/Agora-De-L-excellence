import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { countEmails, emailFor, linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Rappels la veille des rencontres :
 * - un membre (inscrit depuis la page) et un invité (inscrit puis confirmé par e-mail) ;
 * - la tâche d'envoi (lancée ici pour ces seules rencontres) : un e-mail chacun, avec titre, date,
 *   heure, lieu, agenda (.ics et Google Agenda), lien de visio pour le membre seulement ;
 * - relancée : rien de plus ; le lien du rappel permet à l'invité d'annuler ;
 * - le membre désactive les rappels dans son profil : plus d'e-mail pour une autre rencontre.
 * Contrôle visuel : l'e-mail et le profil à 375 px et 1440 px.
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

async function signInAsMember(page: Page, request: APIRequestContext, email: string) {
  const password = `phrase-de-membre-${randomInt(1e6)}`;
  testUser("create", email, "Awa", "member");
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
}

test("rappel la veille : membre et invité, sans doublon, désactivable dans le profil", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const width = isMobile ? 375 : 1440;
  const title = `E2E-Veille-${stamp}-${width}`;
  const memberEmail = `rappel-membre-${stamp}-${width}@e2e.agora.test`;
  const guestEmail = `rappel-invite-${stamp}-${width}@e2e.agora.test`;
  const shot = (p: Page, name: string) =>
    p.screenshot({ path: `docs/captures/rappels/${width}-${name}.png`, fullPage: true });
  await page.setViewportSize({ width, height: isMobile ? 812 : 900 });
  const guest = await browser.newPage({
    viewport: { width, height: isMobile ? 812 : 900 },
    extraHTTPHeaders: randomClient(),
  });
  try {
    const path = tool("create-reminder-event", `${title}-A`);

    // Le membre s'inscrit depuis la page de la rencontre.
    await signInAsMember(page, request, memberEmail);
    await page.goto(path);
    await page.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(page.getByRole("link", { name: "Suivre la rencontre à distance" })).toBeVisible();

    // L'invité s'inscrit, puis confirme par le lien reçu.
    await guest.goto(path);
    const form = guest.locator("#inscription");
    await form.getByLabel("Prénom et nom").fill("Moussa Diop");
    await form.getByLabel("Adresse e-mail").fill(guestEmail);
    await form.getByRole("button", { name: "Réserver ma place" }).click();
    await guest.goto(
      await linkFromEmail(request, {
        to: guestEmail,
        subject: "Confirmez votre inscription",
        path: "/events/registration",
      }),
    );
    await guest.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(guest.getByText("Votre place est réservée.")).toBeVisible();

    // Inscriptions faites avant l'heure du rappel, puis la tâche d'envoi.
    tool("backdate-registrations", `${title}-A`);
    expect(JSON.parse(tool("send-event-reminders", `${title}-A`))).toMatchObject({
      sent: 2,
      failed: 0,
    });

    const memberMail = await emailFor(request, { to: memberEmail, subject: `Rappel : ${title}-A` });
    expect(memberMail.subject).toMatch(new RegExp(`^Rappel : ${title}-A, (demain|aujourd’hui) à`));
    for (const part of [
      "Maison de la culture Douta Seck",
      "Suivre la rencontre à distance : https://visio.exemple.sn/e2e-rappel",
      `${path}/agenda.ics`,
      "https://calendar.google.com/calendar/render?action=TEMPLATE",
      "Ne plus recevoir ces rappels",
    ]) {
      expect(memberMail.text).toContain(part);
    }
    expect(memberMail.text).toMatch(/Date : \S+ \d+ \S+ \d{4}, \d+\sh/);
    const guestMail = await emailFor(request, { to: guestEmail, subject: `Rappel : ${title}-A` });
    expect(guestMail.text).not.toContain("visio.exemple.sn");
    expect(guestMail.text).toContain(`${path}/agenda.ics`);

    // Contrôle visuel de l'e-mail du membre.
    const preview = await browser.newPage({ viewport: { width, height: 900 } });
    await preview.setContent(memberMail.html);
    expect(
      await preview.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await shot(preview, "email-membre");
    await preview.close();

    // Le fichier d'agenda.
    const ics = await request.get(`${path}/agenda.ics`);
    expect(ics.status()).toBe(200);
    expect(ics.headers()["content-type"]).toBe("text/calendar; charset=utf-8");
    const icsText = await ics.text();
    expect(icsText).toContain("DTSTART;TZID=Africa/Dakar:");
    expect(icsText).toContain(`SUMMARY:${title}-A`);
    expect(icsText).not.toContain("visio.exemple.sn");

    // Relancée : rien de plus.
    expect(JSON.parse(tool("send-event-reminders", `${title}-A`))).toMatchObject({ sent: 0 });
    expect(await countEmails(request, { to: memberEmail, subject: `Rappel : ${title}-A` })).toBe(1);

    // Le lien du rappel : l'invité voit son inscription et l'annule.
    const manage = guestMail.text
      .split(/\s+/)
      .find((w) => w.includes("/events/registration?token="))!;
    const url = new URL(manage);
    await guest.goto(url.pathname + url.search);
    await expect(guest.getByText("Votre place est réservée.")).toBeVisible();
    await shot(guest, "invite-lien-du-rappel");
    await guest.getByRole("button", { name: "Annuler mon inscription" }).click();
    await guest.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(guest.getByText("Votre place a été libérée.")).toBeVisible();

    // Le membre désactive les rappels : rien pour une autre rencontre.
    await page.goto("/member/profile");
    const box = page.getByLabel(/Recevoir un rappel par e-mail la veille/);
    await expect(box).toBeChecked();
    await box.uncheck();
    await shot(page, "profil-rappels");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Recevoir un rappel par e-mail la veille/)).not.toBeChecked();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);

    const other = tool("create-reminder-event", `${title}-B`);
    await page.goto(other);
    await page.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(page.getByRole("link", { name: "Suivre la rencontre à distance" })).toBeVisible();
    tool("backdate-registrations", `${title}-B`);
    expect(JSON.parse(tool("send-event-reminders", `${title}-B`))).toMatchObject({ sent: 0 });
    expect(await countEmails(request, { to: memberEmail, subject: `Rappel : ${title}-B` })).toBe(0);
  } finally {
    await guest.close();
    testUser("delete-events", title);
    testUser("delete", memberEmail);
  }
});

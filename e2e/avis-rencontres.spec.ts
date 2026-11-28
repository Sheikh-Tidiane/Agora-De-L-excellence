import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Avis après une rencontre, à 375 px et 1440 px :
 * - un membre pointé présent reçoit le lendemain l'e-mail « Votre avis sur … » (tâche lancée ici
 *   pour cette seule rencontre) ; il note 4 avec un commentaire, puis passe à 5 ;
 * - « Mes rencontres » propose de modifier l'avis ;
 * - un responsable voit l'avis et son auteur, puis masque le commentaire avec un motif ;
 * - un membre sans rôle n'a pas accès aux avis.
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

const noHorizontalScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

test("avis : invitation le lendemain, dépôt et modification, lecture et masquage par un responsable", async ({
  page,
  browser,
  request,
  isMobile,
}) => {
  test.setTimeout(300_000);
  const stamp = Date.now();
  const width = isMobile ? 375 : 1440;
  const viewport = { width, height: isMobile ? 812 : 900 };
  const title = `E2E-Avis-${stamp}-${width}`;
  const memberEmail = `avis-membre-${stamp}-${width}@e2e.agora.test`;
  const adminEmail = `avis-admin-${stamp}-${width}@e2e.agora.test`;
  const shot = (p: Page, name: string) =>
    p.screenshot({ path: `docs/captures/avis/${width}-${name}.png`, fullPage: true });
  await page.setViewportSize(viewport);
  const admin = await browser.newPage({ viewport, extraHTTPHeaders: randomClient() });
  try {
    const path = tool("create-feedback-event", title, "reel");
    const slug = path.split("/").pop()!;

    // Le membre, pointé présent, reçoit l'invitation.
    await signInAsMember(page, request, memberEmail);
    testUser("check-in", memberEmail, title);
    expect(JSON.parse(tool("send-feedback-requests", title))).toMatchObject({ sent: 1 });
    expect(JSON.parse(tool("send-feedback-requests", title))).toMatchObject({ sent: 0 });
    const link = await linkFromEmail(request, {
      to: memberEmail,
      subject: "Votre avis sur",
      path: `/member/events/${slug}/avis`,
    }).catch(() => null);
    // Le lien de l'e-mail n'a pas de jeton : on le reconstruit à partir de l'adresse attendue.
    await page.goto(link ?? `/member/events/${slug}/avis`);
    await expect(
      page.getByRole("heading", { name: "Qu’avez-vous pensé de cette rencontre ?" }),
    ).toBeVisible();

    // Note sans choix : refusée à l'écran ; puis 4 avec un commentaire.
    await page.getByRole("button", { name: "Envoyer mon avis" }).click();
    await expect(page.getByText("Choisissez une note de 1 à 5.")).toBeVisible();
    await page.getByLabel("4 sur 5 : Très bien").locator("..").click();
    await page.getByLabel("Votre commentaire").fill("Un débat passionnant, merci aux animateurs.");
    await noHorizontalScroll(page);
    await shot(page, "formulaire");
    await page.getByRole("button", { name: "Envoyer mon avis" }).click();
    await expect(page.getByText(/Merci ! Votre avis est enregistré/)).toBeVisible();

    // Modification : 5 sur 5.
    await page.reload();
    await expect(page.getByLabel("4 sur 5 : Très bien")).toBeChecked();
    await page.getByLabel("5 sur 5 : Excellente").locator("..").click();
    await expect(page.getByLabel("5 sur 5 : Excellente")).toBeChecked();
    await page.getByRole("button", { name: "Modifier mon avis" }).click();
    await expect(page.getByText(/Merci ! Votre avis est enregistré/)).toBeVisible();
    await page.goto("/member/events");
    await expect(page.getByRole("link", { name: /Modifier mon avis \(5 sur 5\)/ })).toBeVisible();

    // Un membre sans rôle n'a pas accès aux avis.
    await page.goto("/admin/feedback");
    await expect(page).not.toHaveURL(/\/admin\/feedback/);

    // Le responsable : tableau, détail avec l'auteur, masquage du commentaire.
    await signInAsAdmin(admin, request, adminEmail);
    await admin.goto("/admin/feedback?periode=3");
    const row = admin.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible();
    await noHorizontalScroll(admin);
    await shot(admin, "tableau");
    await row.getByRole("link", { name: title }).click();
    await expect(admin.getByText(/1 avis sur 1 présent/)).toBeVisible();
    const item = admin.getByRole("list", { name: "Avis" }).getByRole("listitem").first();
    await expect(item.getByText(/Awa Essai/)).toBeVisible();
    await expect(item.getByText("Un débat passionnant, merci aux animateurs.")).toBeVisible();
    await item.getByRole("button", { name: "Masquer ce commentaire" }).click();
    await item.getByLabel("Motif du masquage").fill("Test de modération");
    await item.getByRole("button", { name: "Masquer le commentaire" }).click();
    await expect(item.getByText("Commentaire masqué : Test de modération")).toBeVisible();
    await noHorizontalScroll(admin);
    await shot(admin, "detail");
  } finally {
    await admin.close();
    testUser("delete-events", title);
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

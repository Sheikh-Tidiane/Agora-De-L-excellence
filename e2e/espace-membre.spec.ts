import { randomInt } from "node:crypto";
import { deflateSync } from "node:zlib";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Espace membre (phase 4, partie A) : onglets, tableau de bord, profil, photo, carte et QR.
 * Mobile : barre d'onglets en bas. Desktop : colonne latérale.
 */
test.use({ extraHTTPHeaders: randomClient() });

/** Petite image PNG valide (4 × 4 px, terracotta), fabriquée sans fichier. */
function tinyPng(): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(body));
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(4, 0);
  ihdr.writeUInt32BE(4, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 2; // RVB
  const row = Buffer.from([0, ...Array.from({ length: 4 }, () => [0xc2, 0x56, 0x2e]).flat()]);
  const raw = Buffer.concat([row, row, row, row]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function signInAsMember(page: Page, request: APIRequestContext, email: string) {
  const password = `phrase-de-membre-${randomInt(1e6)}`;
  testUser("create", email, "Awa", "member");
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

test("espace membre : onglets, profil, photo et carte", async ({ page, request, isMobile }) => {
  const email = `membre-${randomInt(1e9)}@e2e.agora.test`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });

  try {
    await signInAsMember(page, request, email);
    await expect(page.getByRole("heading", { level: 1, name: "Bonjour, Awa." })).toBeVisible();
    await expect(page.getByText("Carte à régler").first()).toBeVisible();

    // Navigation : barre du bas sur mobile, colonne latérale sur desktop. Seuls les onglets
    // dont la page existe sont proposés.
    const nav = page.getByRole("navigation", { name: "Espace membre" }).filter({ visible: true });
    await expect(nav).toHaveCount(1);
    await expect(nav.getByRole("link")).toHaveText([
      "Accueil",
      "Lectures",
      "Événements",
      "Scrabble",
      "Profil",
    ]);
    await expect(nav.getByRole("link", { name: "Accueil" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (isMobile) {
      const box = await nav.boundingBox();
      const viewport = page.viewportSize()!;
      expect(box!.y + box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
    }

    await nav.getByRole("link", { name: "Événements" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mes rencontres" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Événements" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await nav.getByRole("link", { name: "Profil" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mon profil" })).toBeVisible();

    // Mobile : un toucher sur l'onglet déjà actif remonte en haut de la page, sans la recharger.
    if (isMobile) {
      await page.evaluate(() =>
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
      );
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      await nav.getByRole("link", { name: "Profil" }).click();
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await expect(page).toHaveURL(/\/member\/profile$/);
    }

    // Téléphone : refusé s'il est invalide, normalisé sinon ; retrait des classements.
    await page.getByLabel(/Téléphone/).fill("abc");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Indiquez un numéro valide")).toBeVisible();
    await page.getByLabel(/Téléphone/).fill("77 123 45 67");
    await page.getByLabel(/Ne pas apparaître dans les classements/).check();
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.getByText("Modifications enregistrées.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/Téléphone/)).toHaveValue("+221771234567");
    await expect(page.getByLabel(/Ne pas apparaître dans les classements/)).toBeChecked();

    // Photo : un fichier qui n'est pas une image est refusé, une vraie image est enregistrée.
    const input = page.locator("#photo-profil");
    await input.setInputFiles({
      name: "faux.png",
      mimeType: "image/png",
      buffer: Buffer.from("pas une image"),
    });
    await expect(page.getByText(/Format non accepté/)).toBeVisible();
    await input.setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: tinyPng() });
    await expect(page.getByText("Photo enregistrée.")).toBeVisible();
    const photo = page
      .locator('img[src^="/api/member/photo/avatars/"]')
      .filter({ visible: true })
      .first();
    await expect(photo).toBeVisible();
    const src = (await photo.getAttribute("src"))!;
    // Servie à la personne connectée, jamais par l'adresse publique ni sans session.
    expect((await page.request.get(src)).status()).toBe(200);
    expect((await page.request.get(src.replace("/api/member/photo/", "/uploads/"))).status()).toBe(
      404,
    );
    const anonymous = await request.get(src, { headers: { cookie: "" } });
    expect(anonymous.status()).toBe(401);
    await page.getByRole("button", { name: "Retirer" }).click();
    await expect(page.getByText("Photo retirée.")).toBeVisible();
    await expect(page.locator('img[src^="/api/member/photo/"]')).toHaveCount(0);

    // Carte de membre : état et code QR, sans donnée personnelle dans le code.
    await page.goto("/member/card");
    await expect(page.getByRole("heading", { level: 1, name: "Ma carte de membre" })).toBeVisible();
    await expect(page.getByText("Carte à régler").first()).toBeVisible();
    const qr = page.getByRole("img", { name: /Code QR/ });
    await expect(qr).toBeVisible();
    await expect(nav.getByRole("link", { name: "Profil" })).toHaveAttribute("aria-current", "page");

    testUser("pay-card", email);
    await page.reload();
    await expect(page.getByText(/Carte réglée/).first()).toBeVisible();

    expect(errors).toEqual([]);
  } finally {
    testUser("delete", email);
  }
});

/**
 * Carte hors ligne : le membre l'ouvre comme d'habitude (lien de l'espace membre, navigation
 * côté client), elle doit rester consultable sans connexion, puis disparaître à la déconnexion.
 */
test("carte de membre : consultable hors ligne, effacée à la déconnexion", async ({
  page,
  context,
  request,
}) => {
  const email = `membre-${randomInt(1e9)}@e2e.agora.test`;
  try {
    await signInAsMember(page, request, email);
    // Service worker actif et maître de la page (il prend la main dès son activation).
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
        );
      }
    });

    await page.getByRole("link", { name: "Afficher ma carte et son code QR" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ma carte de membre" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Code QR/ })).toBeVisible();
    // La carte est gardée de façon asynchrone : on attend qu'elle soit dans le cache.
    await expect
      .poll(() => page.evaluate(async () => !!(await caches.match("/member/card"))))
      .toBe(true);

    // Le cache garde le code affiché ; une carte remplacée y remplace l'ancienne (sinon, hors
    // ligne, le membre présenterait un code refusé au pointage).
    const cachedHasShownQr = () =>
      page.evaluate(async () => {
        const shown = document.querySelector('[aria-label^="Code QR"] svg path:last-of-type');
        const cached = await (await caches.match("/member/card"))?.text();
        return !!shown && !!cached && cached.includes(shown.getAttribute("d") ?? "∅");
      });
    await expect.poll(cachedHasShownQr).toBe(true);
    const oldQr = await page.locator('[aria-label^="Code QR"] svg path').last().getAttribute("d");
    await page.getByRole("button", { name: "Remplacer ma carte" }).click();
    await page.getByRole("button", { name: "Oui, remplacer ma carte" }).click();
    await expect(page.getByText("Nouvelle carte émise.")).toBeVisible();
    await expect(page.locator('[aria-label^="Code QR"] svg path').last()).not.toHaveAttribute(
      "d",
      oldQr!,
    );
    await expect.poll(cachedHasShownQr).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Ma carte de membre" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Code QR/ })).toBeVisible();

    // Déconnexion (en ligne) : la carte ne doit plus s'afficher sans connexion.
    await context.setOffline(false);
    await page.goto("/member/profile");
    await page
      .getByRole("button", { name: "Se déconnecter" })
      .filter({ visible: true })
      .first()
      .click();
    await expect(page).not.toHaveURL(/\/member/);
    await expect
      .poll(() => page.evaluate(async () => !!(await caches.match("/member/card"))))
      .toBe(false);
    await context.setOffline(true);
    await page.goto("/member/card").catch(() => undefined);
    await expect(page.getByRole("heading", { level: 1, name: "Ma carte de membre" })).toHaveCount(
      0,
    );
    await expect(page.getByText("La connexion a quitté la salle.")).toBeVisible();
  } finally {
    await context.setOffline(false);
    testUser("delete", email);
  }
});

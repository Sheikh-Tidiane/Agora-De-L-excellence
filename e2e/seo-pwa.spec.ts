import { expect, test } from "@playwright/test";

/**
 * Référencement et application installable : plan du site, robots, image de partage,
 * manifest, service worker et page hors ligne.
 * Le service worker n'est enregistré qu'en production : ces parcours supposent le build
 * de production (configuration par défaut de Playwright), pas `PW_DEV=1`.
 */

test("robots.txt ouvre le site public et ferme les espaces privés", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("Allow: /");
  for (const path of ["/admin", "/member", "/api/", "/login", "/events/registration"]) {
    expect(body, path).toContain(`Disallow: ${path}`);
  }
  expect(body).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
});

test("sitemap.xml liste les pages publiques et des fiches réelles, sans page privée", async ({
  request,
}) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();
  const paths = [...body.matchAll(/<loc>https?:\/\/[^/<]+([^<]*)<\/loc>/g)].map((m) => m[1] || "/");
  for (const path of ["/", "/events", "/library", "/news", "/membership", "/about", "/charte"]) {
    expect(paths, path).toContain(path);
  }
  expect(paths.some((path) => path.startsWith("/library/"))).toBe(true);
  expect(paths.some((path) => path.startsWith("/events/"))).toBe(true);
  expect(paths.filter((path) => /^\/(admin|member|login|api|offline)(\/|$)/.test(path))).toEqual(
    [],
  );
  // Chaque adresse annoncée existe vraiment.
  for (const path of paths) {
    const page = await request.get(path);
    expect(page.status(), path).toBe(200);
  }
});

test("chaque page publique a un titre, une description, une adresse canonique et une image de partage", async ({
  page,
  request,
}) => {
  const seen = new Set<string>();
  for (const path of [
    "/",
    "/about",
    "/activities",
    "/library",
    "/events",
    "/news",
    "/membership",
  ]) {
    await page.goto(path);
    const title = await page.title();
    expect(title.length, path).toBeGreaterThan(10);
    expect(seen.has(title), `titre en double : ${title}`).toBe(false);
    seen.add(title);
    const description = await page.locator('meta[name="description"]').getAttribute("content");
    expect(description?.length ?? 0, path).toBeGreaterThan(50);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${path === "/" ? "" : path}$`),
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
  }
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
  expect((await image.body()).length).toBeGreaterThan(10_000);
});

test("le manifest rend le club installable", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("/");
  expect(manifest.theme_color).toBe("#1F2A55");
  const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  expect(manifest.icons.some((icon: { purpose?: string }) => icon.purpose === "maskable")).toBe(
    true,
  );
  for (const icon of manifest.icons as { src: string }[]) {
    expect((await request.get(icon.src)).status(), icon.src).toBe(200);
  }
});

test("sans connexion, une navigation affiche la page hors ligne, puis reprend au retour du réseau", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto("/");
  // Le service worker s'installe après le chargement, puis prend la main sur la page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }),
      );
    }
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shell = await caches.open(keys.find((key) => key.includes("coquille"))!);
    return Boolean(await shell.match("/offline"));
  });
  expect(cached, "page hors ligne en cache").toBe(true);

  await context.setOffline(true);
  await page.goto("/events").catch(() => undefined);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "La connexion a quitté la salle.",
  );
  // La page est mise en forme (feuille de style et police servies par le cache), pas du HTML nu.
  const family = await page
    .getByRole("heading", { level: 1 })
    .evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).toMatch(/Young Serif|young/i);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();

  // Le réseau revient : la page demandée se recharge d'elle-même.
  await context.setOffline(false);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Les prochaines rencontres.", {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/events$/);
  expect(errors, "erreurs d’exécution").toEqual([]);
});

test("le service worker ne garde aucune page ni donnée en cache", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.goto("/library");
  await page.goto("/events");
  const urls = await page.evaluate(async () => {
    const found: string[] = [];
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) found.push(new URL(request.url).pathname);
    }
    return found;
  });
  const pages = urls.filter(
    (path) =>
      path !== "/offline" && !path.startsWith("/_next/static/") && !path.startsWith("/logos/"),
  );
  expect(pages).toEqual([]);
});

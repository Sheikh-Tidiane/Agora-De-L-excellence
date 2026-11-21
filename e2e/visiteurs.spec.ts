import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import { randomClient, testUser } from "./support/parcours";

/**
 * Cohérence du site selon le visiteur (docs/AUDIT-VISITEURS.md) : un parcours par type de
 * visiteur, sur les pages principales, qui vérifie les bons boutons et l'absence des mauvais.
 * Un relevé fait à chaque image du navigateur s'assure aussi que le header ne montre
 * jamais, même un instant, un état faux (le clignotement signalé le 14/11/2026).
 */
test.use({ extraHTTPHeaders: randomClient() });

type Kind = "visitor" | "member-unpaid" | "member" | "staff";

const LAUNCH = "/events/lancement-de-l-agora";
const PAGES = [
  "/",
  "/about",
  "/activities",
  "/events",
  LAUNCH,
  "/charte",
  "/contact",
  "/membership",
];

/** Appels à adhérer et à se connecter : jamais pour quelqu'un de connecté. */
const VISITOR_ONLY = [
  /^Adhérer$/,
  /^Rejoindre le club/,
  /^Demander mon adhésion/,
  /^Se connecter$/,
  /Pas encore membre/,
];

/**
 * Relève, à chaque image, si un libellé interdit est VISIBLE dans le header, le contenu ou le
 * pied de page. Le repli (invisible) n'est pas compté : seul ce que l'utilisateur voit compte.
 * Les relevés sont remontés au test au fil de l'eau : un rechargement complet (`page.goto`) ne
 * les efface pas, et l'état affiché pendant le chargement de chaque page est bien vérifié.
 * Les pages de connexion et d'activation, où « Se connecter » est le bouton du formulaire,
 * ne sont pas observées.
 */
async function watchFlashes(page: Page, forbidden: string[]) {
  const seen: string[] = [];
  await page.exposeFunction("__agoraFlash", (entry: string) => {
    if (!seen.includes(entry)) seen.push(entry);
  });
  await page.addInitScript((labels: string[]) => {
    const report = (window as unknown as { __agoraFlash: (entry: string) => void }).__agoraFlash;
    const sent = new Set<string>();
    const check = () => {
      const path = location.pathname;
      if (!/^\/(login|activate|forgot-password|reset-password)(\/|$)/.test(path)) {
        for (const el of document.querySelectorAll<HTMLElement>("a, button")) {
          const text = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
          if (!labels.some((label) => text.startsWith(label))) continue;
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          if (style.visibility !== "hidden" && style.display !== "none" && box.width > 0) {
            const entry = `${path} : ${text}`;
            if (!sent.has(entry)) {
              sent.add(entry);
              report(entry);
            }
          }
        }
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  }, forbidden);
  return seen;
}

async function signIn(page: Page, request: APIRequestContext, email: string, role: string) {
  const password = `phrase-de-visite-${randomInt(1e6)}`;
  testUser("create", email, "Awa", role);
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
  await expect(page).toHaveURL(role === "member" ? /\/member$/ : /\/admin$/);
}

/** Liens et boutons visibles du contenu, du header et du pied de page (repli invisible exclu). */
async function visibleActions(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a, button")]
      .filter((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && box.width > 0;
      })
      .map((el) => el.textContent?.replace(/\s+/g, " ").trim() ?? ""),
  );
}

async function tour(page: Page, kind: Kind) {
  const signedIn = kind !== "visitor";
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator("h1").first()).toBeVisible();
    // Le contenu qui dépend du visiteur est arrivé : plus aucun repli invisible dans la page.
    await expect(page.locator("[inert]")).toHaveCount(0);
    const actions = await visibleActions(page);

    for (const pattern of VISITOR_ONLY) {
      const found = actions.filter((label) => pattern.test(label));
      if (signedIn) expect(found, `${kind} ${path} : ${pattern}`).toEqual([]);
    }
    const header = page.getByRole("banner");
    if (signedIn) {
      await expect(header.getByRole("link", { name: "Mon espace" })).toBeVisible();
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "Mon espace" }),
      ).toBeVisible();
    } else {
      await expect(header.getByRole("link", { name: "Adhérer" })).toBeVisible();
      await expect(header.getByRole("link", { name: "Mon espace" })).toHaveCount(0);
      await expect(
        page.getByRole("contentinfo").getByRole("link", { name: "Se connecter" }),
      ).toBeVisible();
    }
  }

  // /membership : formulaire pour un visiteur, rien à remplir pour un membre.
  await page.goto("/membership");
  if (signedIn) {
    await expect(page.getByRole("button", { name: "Envoyer ma demande" })).toHaveCount(0);
    await expect(page.getByText(/vous êtes (déjà membre|responsable du club)/)).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Envoyer ma demande" })).toBeVisible();
  }

  // Charte : un membre lit qu'il l'a acceptée.
  await page.goto("/charte");
  if (signedIn) await expect(page.getByText(/vous avez accepté cette charte/)).toBeVisible();

  // Rencontre ouverte au public : formulaire invité pour un visiteur, un clic pour un membre.
  await page.goto(LAUNCH);
  const panel = page.locator("#inscription");
  if (signedIn) {
    await expect(panel.getByRole("button", { name: "Je m’inscris" })).toBeVisible();
    await expect(panel.getByLabel("Prénom et nom")).toHaveCount(0);
  } else {
    await expect(panel.getByLabel("Prénom et nom")).toBeVisible();
    // « Connectez-vous » ramène ensuite sur cette rencontre.
    await expect(panel.getByRole("link", { name: "Connectez-vous" })).toHaveAttribute(
      "href",
      `/login?next=${encodeURIComponent(LAUNCH)}`,
    );
  }

  // Connexion : un utilisateur connecté va directement dans son espace.
  await page.goto("/login");
  if (kind === "staff") await expect(page).toHaveURL(/\/admin$/);
  else if (signedIn) await expect(page).toHaveURL(/\/member$/);
  else await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bon retour au club.");
}

test("visiteur non connecté : appels à adhérer et à se connecter, formulaire invité", async ({
  page,
}) => {
  await tour(page, "visitor");
});

for (const kind of ["member-unpaid", "member", "staff"] as const) {
  test(`${kind} : aucun appel à adhérer, « Mon espace » partout, header sans clignotement`, async ({
    page,
    request,
  }, testInfo) => {
    test.skip(
      kind === "staff" && testInfo.project.name !== "desktop",
      "L’administration se vérifie sur ordinateur.",
    );
    test.setTimeout(300_000);
    const email = `visite-${kind}-${Date.now()}-${randomInt(1e6)}@e2e.agora.test`;
    const flashes = await watchFlashes(page, [
      "Adhérer",
      "Se connecter",
      "Rejoindre le club",
      "Demander mon adhésion",
      "Pas encore membre",
    ]);
    try {
      await signIn(page, request, email, kind === "staff" ? "admin" : "member");
      if (kind === "member") testUser("pay-card", email);

      await tour(page, kind);

      // Navigations côté client (sans rechargement) : le header ne repasse jamais par « Adhérer ».
      await page.goto("/");
      const mobile = (page.viewportSize()?.width ?? 1440) < 1024;
      for (const name of ["Activités", "Événements", "Bibliothèque", "Actualités"]) {
        if (mobile) {
          // Sur téléphone, les rubriques sont dans le menu plein écran.
          await page.getByRole("button", { name: "Ouvrir le menu" }).click();
          await page
            .getByRole("dialog")
            .getByRole("link", { name: new RegExp(name) })
            .click();
        } else {
          await page.getByRole("banner").getByRole("link", { name, exact: true }).click();
        }
        await expect(
          page.getByRole("banner").getByRole("link", { name: "Mon espace" }),
        ).toBeVisible();
      }
      expect(
        [...flashes],
        "libellés de visiteur affichés, même un instant, à un utilisateur connecté",
      ).toEqual([]);

      // Espace membre : état de la carte ; lien vers l'administration pour un responsable.
      if (kind !== "staff") {
        await page.goto("/member");
        await expect(
          page.getByText(kind === "member" ? /Carte réglée le/ : "Carte à régler"),
        ).toBeVisible();
        if (kind === "member-unpaid") {
          await expect(page.getByText(/en espèces auprès d’un responsable/)).toBeVisible();
        }
      } else {
        await page.goto("/");
        await page.getByRole("banner").getByRole("link", { name: "Mon espace" }).click();
        await expect(page).toHaveURL(/\/admin$/);
      }

      // Déconnexion, puis navigation côté client : le header redevient celui d'un visiteur.
      await page.goto(kind === "staff" ? "/admin" : "/member/profile");
      await page
        .getByRole("button", { name: "Se déconnecter" })
        .filter({ visible: true })
        .first()
        .click();
      await expect(page).toHaveURL(/\/login$/);
      await page
        .getByRole("link", { name: /accueil|Retour au site/ })
        .first()
        .click();
      await expect(page.getByRole("banner").getByRole("link", { name: "Adhérer" })).toBeVisible();
      await expect(page.getByRole("banner").getByRole("link", { name: "Mon espace" })).toHaveCount(
        0,
      );
    } finally {
      testUser("delete", email);
    }
  });
}

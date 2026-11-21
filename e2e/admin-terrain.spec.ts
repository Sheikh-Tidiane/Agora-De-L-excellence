import { expect, test } from "@playwright/test";
import {
  approveMembership,
  randomClient,
  requestMembership,
  signInAsAdmin,
  testUser,
} from "./support/parcours";

/**
 * Deux gestes d'administration : la photo d'un membre du comité (téléversement réel d'un fichier)
 * et l'annulation d'un encaissement de carte saisi par erreur.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués.
 */
test.use({ extraHTTPHeaders: randomClient() });

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
});

test("comité : une photo téléversée paraît dans l’admin et sur la page du club", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const adminEmail = `comite-${stamp}@e2e.agora.test`;
  const name = `E2E-Comite ${stamp}`;
  try {
    await signInAsAdmin(page, request, adminEmail);
    await page.goto("/admin/committee");
    await page.getByRole("button", { name: "Ajouter un membre" }).click();
    await page.getByLabel("Nom", { exact: true }).fill(name);

    // Un fichier qui n'est pas une image est refusé par le serveur, quel que soit son nom.
    await page.locator("#committee-file").setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: Buffer.from("ceci n’est pas une image"),
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("img", { name: "Image téléversée" })).toHaveCount(0);

    // Une vraie image : l'aperçu apparaît, le nom d'origine n'est pas conservé.
    await page.locator("#committee-file").setInputFiles("public/logos/icone-192.png");
    const preview = page.getByRole("img", { name: "Image téléversée" });
    await expect(preview).toBeVisible();
    await expect
      .poll(() => preview.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    expect(await preview.getAttribute("src")).not.toContain("icone-192");

    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(
      page.getByText("Comité enregistré. La page « Le club » est à jour."),
    ).toBeVisible();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row.getByText("photo")).toBeVisible();

    // Sur le site, le portrait remplace les initiales.
    await page.goto("/about");
    const card = page.getByRole("listitem").filter({ hasText: name });
    const portrait = card.locator("img");
    // L'image est chargée en différé : elle n'arrive qu'une fois proche de l'écran.
    await portrait.scrollIntoViewIfNeeded();
    await expect(portrait).toBeVisible();
    await expect
      .poll(() => portrait.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);

    // Retrait : le membre disparaît de l'admin et du site.
    await page.goto("/admin/committee");
    const listed = page.getByRole("listitem").filter({ hasText: name });
    await listed.getByRole("button", { name: "Retirer" }).click();
    await listed.getByRole("button", { name: "Confirmer le retrait" }).click();
    await expect(page.getByText(`${name} ne figure plus dans le comité.`)).toBeVisible();
    await page.goto("/about");
    await expect(page.getByText(name)).toHaveCount(0);
  } finally {
    testUser("delete-committee", "E2E-Comite");
    testUser("delete", adminEmail);
  }
});

test("carte de membre : un encaissement annulé remet la carte à régler", async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const adminEmail = `caisse-${stamp}@e2e.agora.test`;
  const memberEmail = `carte-${stamp}@e2e.agora.test`;
  const lastName = `Essai${stamp}`;
  try {
    await requestMembership(page, lastName, memberEmail);
    await signInAsAdmin(page, request, adminEmail);
    await approveMembership(page, lastName);

    const unpaid = () => page.getByRole("region", { name: "Cartes non réglées" });
    await page.goto("/admin/payments");
    await unpaid()
      .getByRole("link", { name: new RegExp(lastName) })
      .click();
    await page.getByRole("button", { name: /Encaisser la carte/ }).click();
    await page.getByRole("button", { name: "Enregistrer l’encaissement" }).click();
    await expect(page.getByText(/Réglée le /)).toBeVisible();

    // Annulation : le motif est obligatoire.
    await page.getByRole("button", { name: /Annuler l’encaissement de la carte/ }).click();
    const cancel = page.getByRole("button", { name: "Annuler l’encaissement", exact: true });
    await cancel.click();
    await expect(page.getByText(/Réglée le /)).toBeVisible();
    await page.getByLabel("Motif").fill("Saisie par erreur");
    await cancel.click();
    await expect(
      page.getByText("Encaissement annulé. La carte est de nouveau à régler."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Encaisser la carte/ })).toBeVisible();

    // Le tableau des encaissements : la carte redevient due, la ligne annulée ne compte plus.
    await page.goto("/admin/payments");
    await expect(unpaid().getByText(new RegExp(lastName))).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Derniers encaissements" })
        .getByRole("listitem")
        .filter({ hasText: lastName }),
    ).toContainText("Annulé : Saisie par erreur");

    // L'annulation est consignée, et un nouvel encaissement reste possible.
    await page.goto("/admin/audit");
    await expect(page.getByText("Encaissement annulé").first()).toBeVisible();
    await page.goto("/admin/payments");
    await unpaid()
      .getByRole("link", { name: new RegExp(lastName) })
      .click();
    await page.getByRole("button", { name: /Encaisser la carte/ }).click();
    await page.getByRole("button", { name: "Enregistrer l’encaissement" }).click();
    await expect(page.getByText(/Réglée le /)).toBeVisible();
  } finally {
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

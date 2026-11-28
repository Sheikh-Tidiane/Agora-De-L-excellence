import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Scan d'un membre dont la carte n'est pas réglée, sur le téléphone du responsable (375 px) :
 * - la présence est enregistrée quand même, un bandeau annonce le montant de la carte ;
 * - « Encaisser la carte maintenant » : Wave sans référence refusé à l'écran, puis avec la
 *   référence ; même service que la fiche membre (encaissement et trace au journal, en base) ;
 * - au scan suivant, la carte est « Réglée » et le bandeau a disparu.
 */
test.use({ extraHTTPHeaders: randomClient() });

const fixture = (...args: string[]) =>
  execFileSync("pnpm", ["exec", "tsx", "e2e/support/scan-fixture.ts", ...args], {
    encoding: "utf8",
    shell: true,
  })
    .trim()
    .split("\n")
    .pop()!;

type Person = { lastName: string; memberNumber: string; token: string };
type Row = {
  firstName: string;
  present: boolean;
  card: { method: string; reference: string | null; audited: number } | null;
};

test("scan : carte non réglée, encaissée depuis l’écran du scan, réglée au scan suivant", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Le scan se fait au téléphone du responsable.");
  test.setTimeout(300_000);
  const stamp = String(Date.now());
  const adminEmail = `scan-carte-${stamp}@e2e.agora.test`;
  const reference = `E2E-SCAN-${stamp}`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });

  const setup = JSON.parse(fixture("setup", stamp)) as { eventTitle: string; awa: Person };
  try {
    await page.setViewportSize({ width: 375, height: 812 });
    await signInAsAdmin(page, request, adminEmail, "admin");
    await page.goto("/admin/scan");
    const choice = page.getByRole("radio", { name: new RegExp(setup.eventTitle) });
    if (await choice.count()) await choice.check();
    const tokenField = page.getByLabel(/une autre application de lecture/);
    const verify = page.getByRole("button", { name: "Vérifier et pointer" });
    const sheet = page.getByRole("dialog", { name: "Vérifiez l’identité" });
    const banner = sheet.getByText(/^Carte de membre non réglée : 1\s000\sF\sCFA à encaisser$/);
    const noHorizontalScroll = async () =>
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);

    // 1. Scan : présence enregistrée, bandeau de la carte non réglée.
    await page.getByText("Coller le code d’une carte").click();
    await tokenField.fill(setup.awa.token);
    await verify.click();
    await expect(sheet.getByText(/^Présence enregistrée à/)).toBeVisible();
    await expect(banner).toBeVisible();
    await noHorizontalScroll();
    await page.screenshot({ path: "docs/captures/scan-carte/375-bandeau.png" });

    // 2. Encaissement depuis l'écran : Wave exige la référence de la transaction.
    await sheet.getByRole("button", { name: "Encaisser la carte maintenant" }).click();
    const form = sheet.getByRole("form", { name: "Encaisser la carte de membre" });
    await form.getByLabel("Moyen de paiement").selectOption("WAVE");
    const submit = form.getByRole("button", { name: /^Encaisser 1\s000/ });
    await submit.click();
    await expect(form.getByText("Indiquez la référence de la transaction Wave.")).toBeVisible();
    await noHorizontalScroll();
    await page.screenshot({ path: "docs/captures/scan-carte/375-encaissement.png" });
    await form.getByLabel("Référence de la transaction").fill(reference);
    await submit.click();
    await expect(
      sheet.getByText(/^Carte réglée : 1\s000\sF\sCFA encaissés \(Wave\)\.$/),
    ).toBeVisible();
    await expect(banner).toBeHidden();
    await expect(sheet.getByText("Réglée", { exact: true })).toBeVisible();
    await noHorizontalScroll();
    await page.screenshot({ path: "docs/captures/scan-carte/375-reglee.png" });
    await sheet.getByRole("button", { name: "Pointer le suivant" }).click();
    await expect(sheet).toBeHidden();

    // 3. Scan suivant : déjà pointé, carte « Réglée », plus de bandeau ni de bouton.
    await verify.click();
    await expect(sheet.getByText(/^Déjà pointé à/)).toBeVisible();
    await expect(sheet.getByText("Réglée", { exact: true })).toBeVisible();
    await expect(sheet.getByText(/Carte de membre non réglée/)).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Encaisser la carte maintenant" })).toHaveCount(
      0,
    );

    // En base : présence, carte encaissée par Wave avec sa référence, une trace au journal.
    const awa = (JSON.parse(fixture("inspect", stamp)) as Row[]).find(
      (row) => row.firstName === "Awa",
    );
    expect(awa).toMatchObject({
      present: true,
      card: { method: "WAVE", reference, audited: 1 },
    });
    expect(errors).toEqual([]);
  } finally {
    fixture("cleanup", stamp);
    testUser("delete", adminEmail);
  }
});

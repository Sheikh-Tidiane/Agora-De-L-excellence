import { execFileSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { randomClient, signInAsAdmin, testUser } from "./support/parcours";

/**
 * Scan des présences (phase 4, partie B) : un responsable, à l'entrée de la rencontre du jour.
 * La caméra ne se teste pas ici : le texte du QR de la carte est collé dans le champ de secours
 * (vérifié exactement comme un scan), puis un second membre est pointé par la recherche.
 * Vérifié : présence, participation, points (en base), idempotence, refus d'un jeton forgé.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués.
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
type Setup = { eventTitle: string; awa: Person; moussa: Person };
type Row = {
  firstName: string;
  present: boolean;
  method: string | null;
  payments: number[];
  points: number;
  lines: number;
  card: { method: string; reference: string | null; audited: number } | null;
};

test("scan : carte, secours par recherche, participation et points", async ({
  page,
  request,
  isMobile,
}) => {
  test.setTimeout(300_000);
  const stamp = String(Date.now());
  const adminEmail = `scan-resp-${stamp}@e2e.agora.test`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`);
  });

  const setup = JSON.parse(fixture("setup", stamp)) as Setup;
  try {
    await signInAsAdmin(page, request, adminEmail, "admin");
    if (!isMobile) {
      await expect(page.getByRole("link", { name: "Scan des présences" }).first()).toBeVisible();
    }
    await page.goto("/admin/scan");
    await expect(page.getByRole("heading", { level: 1, name: "Scan des présences" })).toBeVisible();
    // D'autres rencontres du jour peuvent exister en base : on choisit celle du parcours.
    const choice = page.getByRole("radio", { name: new RegExp(setup.eventTitle) });
    if (await choice.count()) await choice.check();
    await expect(page.getByText(setup.eventTitle).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Activer la caméra" })).toBeVisible();
    // Captures du contrôle visuel : 375 px sur mobile, 1440 px sur ordinateur.
    const width = isMobile ? 375 : 1440;
    const shot = (name: string) =>
      page.screenshot({ path: `docs/captures/phase-4b/scan-${width}-${name}.png`, fullPage: true });
    await page.setViewportSize({ width, height: isMobile ? 812 : 900 });
    await shot("accueil");
    const tokenField = page.getByLabel(/une autre application de lecture/);
    const verify = page.getByRole("button", { name: "Vérifier et pointer" });
    const sheet = page.getByRole("dialog", { name: "Vérifiez l’identité" });
    const next = sheet.getByRole("button", { name: "Pointer le suivant" });

    // 1. Carte d'Awa, participation encaissée au passage.
    await page.getByLabel("Encaisser à chaque pointage").check();
    await page.getByText("Coller le code d’une carte").click();
    await tokenField.fill(setup.awa.token);
    await verify.click();
    await expect(sheet.getByText(/^Présence enregistrée à/)).toBeVisible();
    await expect(sheet.getByText(setup.awa.memberNumber)).toBeVisible();
    await expect(sheet.getByText("+20")).toBeVisible();
    await expect(sheet.getByText("Réglée", { exact: true })).toBeVisible(); // participation
    // Carte de membre non réglée : bandeau sous la présence, montant lu dans les réglages.
    await expect(sheet.getByText(/^Carte de membre non réglée : .+ à encaisser$/)).toBeVisible();
    await expect(sheet.getByText("Carte scannée")).toBeVisible();
    await shot("resultat");
    await next.click();
    await expect(sheet).toBeHidden();

    // 2. La même carte une seconde fois : déjà pointée, rien ne change.
    await verify.click();
    await expect(sheet.getByText(/^Déjà pointé à/)).toBeVisible();
    await next.click();

    // 3. Un jeton forgé est refusé.
    await tokenField.fill(`${setup.awa.token.slice(0, -4)}AAAA`);
    await verify.click();
    const refusal = page.getByRole("dialog", { name: "Pointage refusé" });
    await expect(refusal.getByText(/n’a pas été émis par le club/)).toBeVisible();
    await shot("refus");
    // Un message long dans le fil des pointages n'élargit jamais la page (défaut corrigé).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await refusal.getByRole("button", { name: "Pointer le suivant" }).click();
    await expect(refusal).toBeHidden();

    // 4. Secours : Moussa, trouvé par son numéro, pointé sans encaissement, puis encaissé.
    await page.getByLabel("Encaisser à chaque pointage").uncheck();
    await page.getByLabel("Chercher un inscrit").fill(setup.moussa.memberNumber);
    await page.getByRole("button", { name: `Pointer Moussa ${setup.moussa.lastName}` }).click();
    await expect(sheet.getByText("Saisie manuelle")).toBeVisible();
    await expect(sheet.getByText("Non réglée", { exact: true })).toBeVisible();
    await sheet.getByRole("button", { name: "Encaisser la participation" }).click();
    await expect(sheet.getByText(/^Déjà pointé à/)).toBeVisible();
    await expect(sheet.getByText("Non réglée", { exact: true })).toHaveCount(0);
    await next.click();
    await expect(page.getByText("Derniers pointages")).toBeVisible();
    await page.getByLabel("Chercher un inscrit").fill(setup.moussa.lastName);
    await expect(page.getByRole("list", { name: "Inscrits trouvés" })).toBeVisible();
    await shot("secours");

    // En base : présence (méthode), une participation au montant du réglage, 20 points chacun.
    const rows = JSON.parse(fixture("inspect", stamp)) as Row[];
    expect(rows).toEqual([
      {
        firstName: "Awa",
        present: true,
        method: "QR_SCAN",
        payments: [100],
        points: 20,
        lines: 1,
        card: null,
      },
      {
        firstName: "Moussa",
        present: true,
        method: "MANUAL",
        payments: [100],
        points: 20,
        lines: 1,
        card: null,
      },
    ]);
    expect(errors).toEqual([]);
  } finally {
    fixture("cleanup", stamp);
    testUser("delete", adminEmail);
  }
});

import { randomInt } from "node:crypto";
import { devices, expect, test, type Page } from "@playwright/test";
import { linkFromEmail } from "./support/mailpit";
import {
  approveMembership,
  randomClient,
  requestMembership,
  signInAsAdmin,
  testUser,
} from "./support/parcours";

/**
 * Recette (cahier des charges, section 13) : les critères que les autres parcours ne couvrent pas.
 *  - critères 4 et 5 : un administrateur crée, modifie et publie un événement ; un visiteur s'y
 *    inscrit depuis un téléphone, confirme par e-mail, puis annule ; la capacité est respectée ;
 *  - critère 8 : un rôle limité n'ouvre que ses rubriques, pages et points d'accès compris ;
 *  - critères 2 et 9 : erreurs de formulaire explicites, refus décidés par le serveur.
 * Prérequis : `docker compose up -d`, migrations et seed appliqués.
 */
test.use({ extraHTTPHeaders: randomClient() });

const h1 = (page: Page) => page.getByRole("heading", { level: 1 });
const formError = (page: Page) => page.locator("form [role=alert]");

test("événement : création, modification, publication ; inscription d’un visiteur, capacité, annulation", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(240_000);
  const stamp = Date.now();
  const adminEmail = `recette-admin-${stamp}@e2e.agora.test`;
  const firstGuest = `invite-un-${stamp}@e2e.agora.test`;
  const secondGuest = `invite-deux-${stamp}@e2e.agora.test`;
  const title = `E2E-Recette ${stamp}`;
  const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Les visiteurs sont sur téléphone : c'est la cible principale.
  const phone = () =>
    browser.newContext({
      ...devices["Pixel 7"],
      locale: "fr-FR",
      baseURL: testInfo.project.use.baseURL,
      extraHTTPHeaders: randomClient(),
    });
  const visitorOne = await phone();
  const visitorTwo = await phone();

  try {
    await signInAsAdmin(page, request, adminEmail);

    // --- Critère 4 : créer (brouillon invisible du public), modifier, publier ---
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Début").fill(`${start}T16:00`);
    await page.getByLabel("Présentation").fill("Une rencontre créée pour la recette du site.");
    await page.getByLabel("Nombre de places").fill("1");
    await page.getByLabel(/Ouvert au public/).check();
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    // Next garde la page précédente (masquée) en mémoire : on repart d'une page chargée à neuf.
    await page.reload();

    // La fiche arrive en flux : une saisie faite avant que React ait pris la main sur le champ
    // peut s'ajouter au texte au lieu de le remplacer. On recommence jusqu'à lire la bonne valeur.
    const titleField = page.getByLabel("Titre");
    await expect(titleField).toHaveValue(title);
    await expect(async () => {
      await titleField.fill(`${title} (modifié)`);
      await expect(titleField).toHaveValue(`${title} (modifié)`, { timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Événement enregistré.")).toBeVisible();

    await page.goto("/events");
    await expect(page.getByText(title)).toHaveCount(0);

    await page.goBack();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Événement publié : il est visible sur le site.")).toBeVisible();
    const publicPath = (await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href"))!;

    // --- Critère 5 : le visiteur trouve la rencontre dans l'agenda et s'inscrit ---
    const one = await visitorOne.newPage();
    await one.goto("/events");
    await one.getByRole("link", { name: `${title} (modifié)` }).click();
    await expect(h1(one)).toHaveText(`${title} (modifié)`);
    await expect(one.getByText(/1\s*place\s*restante\s*sur 1/)).toBeVisible();

    // Un second visiteur ouvre la page pendant qu'il reste une place.
    const two = await visitorTwo.newPage();
    await two.goto(publicPath);
    await expect(two.getByRole("button", { name: "Réserver ma place" })).toBeVisible();

    // Erreurs sous le champ concerné, avant tout envoi.
    await one.getByRole("button", { name: "Réserver ma place" }).click();
    await expect(one.getByText("Indiquez votre prénom et votre nom.")).toBeVisible();
    await one.getByLabel("Prénom et nom").fill("Awa Recette");
    await one.getByLabel("Adresse e-mail").fill("pas-une-adresse");
    await one.getByRole("button", { name: "Réserver ma place" }).click();
    await expect(one.getByText("Cette adresse e-mail n’est pas valide.")).toBeVisible();
    await one.getByLabel("Adresse e-mail").fill(firstGuest);
    await one.getByRole("button", { name: "Réserver ma place" }).click();
    await expect(one.getByText(/Presque fini/)).toBeVisible();

    // --- Capacité : la dernière place est retenue ; le serveur refuse le second visiteur ---
    await two.getByLabel("Prénom et nom").fill("Binta Recette");
    await two.getByLabel("Adresse e-mail").fill(secondGuest);
    await two.getByRole("button", { name: "Réserver ma place" }).click();
    await expect(formError(two)).toHaveText("Cette rencontre est complète.");
    await two.reload();
    await expect(two.getByText(/Toutes les places sont prises/)).toBeVisible();

    // --- Confirmation par le lien reçu par e-mail ---
    const link = await linkFromEmail(request, {
      to: firstGuest,
      subject: "Confirmez votre inscription",
      path: "/events/registration",
    });
    await one.goto(link);
    await expect(h1(one)).toContainText("confirmez votre place");
    await one.getByRole("button", { name: "Confirmer mon inscription" }).click();
    await expect(h1(one)).toHaveText("Votre place est réservée.");

    // L'administrateur voit l'inscrit.
    await page.reload();
    const registrants = page.getByRole("region", { name: "Inscrits" });
    await expect(registrants.getByText("Awa Recette").first()).toBeVisible();

    // --- Annulation par le même lien : la place se libère ---
    await one.getByRole("button", { name: "Annuler mon inscription" }).click();
    await one.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(h1(one)).toHaveText("Votre place a été libérée.");
    await two.reload();
    await expect(two.getByText(/1\s*place\s*restante\s*sur 1/)).toBeVisible();
    await expect(two.getByRole("button", { name: "Réserver ma place" })).toBeVisible();
  } finally {
    await visitorOne.close();
    await visitorTwo.close();
    testUser("delete-events", "E2E-Recette");
    testUser("delete", adminEmail);
  }
});

test("rôles : un responsable bibliothèque n’ouvre que ses rubriques", async ({
  page,
  request,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const email = `recette-biblio-${Date.now()}@e2e.agora.test`;
  const password = `phrase-de-test-${randomInt(1e6)}`;
  testUser("create", email, "Coumba", "library");
  try {
    const activation = await linkFromEmail(request, {
      to: email,
      subject: "Activez votre compte",
      path: "/activate",
    });
    await page.goto(activation);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByLabel("Encore une fois").fill(password);
    await page.getByRole("button", { name: "Activer mon compte" }).click();
    await expect(page).toHaveURL(/\/login\?notice=activated$/);
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    // Le menu ne montre que la bibliothèque.
    const nav = page.getByRole("navigation", { name: "Administration" }).first();
    await expect(nav.getByRole("link", { name: "Livres" })).toBeVisible();
    for (const hidden of ["Membres", "Demandes d’adhésion", "Événements", "Articles", "Journal"]) {
      await expect(nav.getByRole("link", { name: hidden }), hidden).toHaveCount(0);
    }
    await page.goto("/admin/books");
    await expect(h1(page)).toHaveText("Livres");

    // Les autres pages sont refusées par le serveur, pas seulement masquées.
    for (const path of [
      "/admin/members",
      "/admin/memberships",
      "/admin/events",
      "/admin/articles",
      "/admin/payments",
      "/admin/settings",
      "/admin/team",
      "/admin/audit",
    ]) {
      await page.goto(path);
      await expect(page, path).toHaveURL(/\/access-denied$/);
    }
    // Un responsable sans le rôle « membre » n'a pas d'espace membre.
    await page.goto("/member");
    await expect(page).toHaveURL(/\/access-denied$/);

    // Points d'accès HTTP : export et téléversement hors de son périmètre.
    const exported = await page.request.get("/api/admin/events/inconnu/registrations");
    expect(exported.status()).toBe(403);
    const upload = await page.request.post("/api/admin/uploads?folder=committee", {
      multipart: { file: { name: "a.png", mimeType: "image/png", buffer: Buffer.from("x") } },
    });
    expect(upload.status()).toBe(403);

    // Sans session : rien non plus.
    const anonymous = await request.get("/api/admin/events/inconnu/registrations");
    expect(anonymous.status()).toBe(401);
  } finally {
    testUser("delete", email);
  }
});

test("adhésion : erreurs explicites, et une seconde demande pour la même adresse est refusée par le serveur", async ({
  page,
}) => {
  const stamp = Date.now();
  const email = `recette-double-${stamp}-${randomInt(1e6)}@e2e.agora.test`;
  const fill = async () => {
    await page.goto("/membership");
    await page.getByLabel("Prénom").fill("Moussa");
    await page.getByLabel("Nom", { exact: true }).fill("Recette");
    await page.getByLabel("Adresse e-mail").fill(email);
    await page.getByLabel("Tranche d’âge").selectOption("FROM_15_TO_17");
    await page.getByLabel("Situation").selectOption("PUPIL");
    await page.getByLabel("Génies du soir").check();
    await page.getByLabel(/J’accepte que le club utilise/).check();
    await page.getByLabel(/J’accepte la charte du club/).check();
  };
  try {
    // Un formulaire vide : chaque champ dit ce qui manque.
    await page.goto("/membership");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Indiquez votre prénom.")).toBeVisible();
    await expect(page.getByText("Choisissez votre tranche d’âge.")).toBeVisible();
    await expect(page.getByText("Cochez au moins une activité qui vous attire.")).toBeVisible();

    // Mineur : le parent ou tuteur est exigé.
    await fill();
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Indiquez le nom d’un parent ou tuteur.")).toBeVisible();
    await page.getByLabel("Nom du parent ou tuteur").fill("Parent Recette");
    await page.getByLabel("Téléphone du parent ou tuteur").fill("12");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText(/Indiquez un numéro valide/)).toBeVisible();
    await page.getByLabel("Téléphone du parent ou tuteur").fill("77 123 45 67");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(page.getByText("Demande envoyée")).toBeVisible();

    // La même adresse une seconde fois : valide pour le navigateur, refusée par le serveur.
    await fill();
    await page.getByLabel("Nom du parent ou tuteur").fill("Parent Recette");
    await page.getByLabel("Téléphone du parent ou tuteur").fill("77 123 45 67");
    await page.getByRole("button", { name: "Envoyer ma demande" }).click();
    await expect(formError(page)).toContainText("Une demande est déjà en cours d’examen");
    await expect(page.getByText("Demande envoyée")).toHaveCount(0);
  } finally {
    testUser("delete", email);
  }
});

test("administration : refus d’une demande, livre modifié, export CSV, clôture, suspension, recherche", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const stamp = Date.now();
  const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";
  const adminEmail = `recette-gestion-${stamp}@e2e.agora.test`;
  const acceptedEmail = `recette-oui-${stamp}@e2e.agora.test`;
  const refusedEmail = `recette-non-${stamp}@e2e.agora.test`;
  const accepted = `Oui${stamp}`;
  const refused = `Non${stamp}`;
  const bookTitle = `E2E-Recette Livre ${stamp}`;
  const eventTitle = `E2E-Recette Export ${stamp}`;
  const start = new Date(Date.now() + 12 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const memberPassword = `phrase-de-membre-${randomInt(1e6)}`;
  const memberContext = await browser.newContext({
    locale: "fr-FR",
    baseURL: testInfo.project.use.baseURL,
    extraHTTPHeaders: randomClient(),
  });
  const toast = (text: string | RegExp) => expect(page.getByText(text).first()).toBeVisible();

  try {
    await requestMembership(page, accepted, acceptedEmail);
    await requestMembership(page, refused, refusedEmail);
    await signInAsAdmin(page, request, adminEmail);

    // --- Critère 3 : refuser une demande, avec un mot transmis au demandeur ---
    await page.goto("/admin/memberships");
    await page.getByLabel("Rechercher dans : Demandes d’adhésion").fill(refused);
    await page
      .getByRole("button", { name: new RegExp(refused) })
      .first()
      .click();
    await page.getByRole("button", { name: "Refuser" }).click();
    await page.getByLabel(/Un mot pour le demandeur/).fill("Les inscriptions rouvrent en janvier.");
    await page.getByRole("button", { name: "Confirmer le refus" }).click();
    await toast("Demande refusée. Le demandeur est prévenu par e-mail.");
    await expect(async () => {
      const search = await request.get(`${mailpit}/api/v1/search`, {
        params: { query: `to:"${refusedEmail}" subject:"Votre demande d’adhésion"`, limit: "1" },
      });
      const { messages } = (await search.json()) as { messages: { ID: string }[] };
      expect(messages.length).toBeGreaterThan(0);
      const message = await request.get(`${mailpit}/api/v1/message/${messages[0]!.ID}`);
      expect(((await message.json()) as { Text: string }).Text).toContain(
        "Les inscriptions rouvrent en janvier.",
      );
    }).toPass({ timeout: 30_000 });

    // --- …et valider l'autre : le membre active son compte et entre dans son espace ---
    await approveMembership(page, accepted);
    const member = await memberContext.newPage();
    await member.goto(
      await linkFromEmail(request, {
        to: acceptedEmail,
        subject: "Activez votre compte",
        path: "/activate",
      }),
    );
    await member.getByLabel("Mot de passe", { exact: true }).fill(memberPassword);
    await member.getByLabel("Encore une fois").fill(memberPassword);
    await member.getByRole("button", { name: "Activer mon compte" }).click();
    await member.getByLabel("Adresse e-mail").fill(acceptedEmail);
    await member.getByLabel("Mot de passe", { exact: true }).fill(memberPassword);
    await member.getByRole("button", { name: "Se connecter" }).click();
    await expect(member).toHaveURL(/\/member$/);
    await expect(member.getByText(/AE-\d{4}-\d{4}/).first()).toBeVisible();

    // --- Membres : renouvellement, suspension (accès coupé tout de suite), réactivation ---
    await page.goto("/admin/members");
    await page.getByLabel("Rechercher dans : Membres").fill(accepted);
    await page
      .getByRole("button", { name: new RegExp(accepted) })
      .first()
      .click();
    await page.getByRole("button", { name: "Renouveler l’adhésion" }).click();
    await toast(/Adhésion renouvelée jusqu’au/);
    await page.getByRole("button", { name: "Suspendre le compte" }).click();
    await toast("Compte suspendu : ses sessions sont fermées.");
    await member.goto("/member");
    await expect(member).toHaveURL(/\/login/);
    await page.getByRole("button", { name: "Réactiver le compte" }).click();
    await toast("Compte réactivé.");

    // --- Critère 6 : ajouter puis modifier une fiche de livre ---
    await page.goto("/admin/books");
    await page.getByRole("button", { name: "Nouveau livre" }).click();
    await page.getByLabel("Titre", { exact: true }).fill(bookTitle);
    await page.getByLabel("Auteur(s)").fill(`E2E-Recette Auteur ${stamp}`);
    await page.getByLabel("Résumé").fill("Un résumé de recette, rédigé pour le club.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await toast("Livre ajouté au catalogue.");
    await page.getByLabel("Rechercher dans : Livres").fill(bookTitle);
    await page
      .getByRole("button", { name: new RegExp(bookTitle) })
      .first()
      .click();
    await page.getByLabel("Titre", { exact: true }).fill(`${bookTitle} bis`);
    await page.getByLabel("Le mot du club").fill("Un mot ajouté à la modification.");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await toast("Fiche enregistrée.");
    await page.goto(`/library?q=${encodeURIComponent(`${bookTitle} bis`)}`);
    await page
      .getByRole("main")
      .getByRole("link", { name: `${bookTitle} bis` })
      .click();
    await expect(h1(page)).toHaveText(`${bookTitle} bis`);
    await expect(
      page.getByRole("blockquote").getByText("Un mot ajouté à la modification."),
    ).toBeVisible();

    // --- Recherche globale : Ctrl K retrouve le livre ---
    await page.goto("/admin");
    await expect(h1(page)).toContainText("Bonjour");
    const search = page.getByRole("searchbox", { name: "Rechercher" });
    // L'administration arrive en flux : le raccourci n'existe qu'une fois la page interactive.
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(search).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30_000 });
    await search.fill(`${bookTitle} bis`);
    await page.getByRole("button", { name: new RegExp(`${bookTitle} bis`) }).click();
    await expect(page).toHaveURL(/\/admin\/books\?open=/);

    // --- Événement : un inscrit, export CSV, clôture ---
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(eventTitle);
    await page.getByLabel("Début").fill(`${start}T16:00`);
    await page
      .getByLabel("Présentation")
      .fill("Une rencontre pour vérifier l’export des inscrits.");
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    const adminUrl = page.url();
    await page.reload();
    await page.getByRole("button", { name: "Publier" }).click();
    await toast("Événement publié : il est visible sur le site.");
    const publicPath = (await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href"))!;
    await page.goto(publicPath);
    await page.getByRole("button", { name: "Je m’inscris" }).click();
    await expect(page.getByText("Vous êtes inscrit. Nous vous attendons.")).toBeVisible();

    await page.goto(adminUrl);
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Exporter en CSV" }).click();
    expect((await download).suggestedFilename()).toMatch(/^inscrits-.+\.csv$/);
    const exportPath = `${new URL(adminUrl).pathname.replace("/admin/", "/api/admin/")}/registrations`;
    const csv = await page.request.get(exportPath);
    expect(csv.status()).toBe(200);
    const body = await csv.text();
    expect(body).toContain("Nom;E-mail");
    expect(body).toContain("Fatou Essai");
    expect(body).toContain(adminEmail);

    await page.getByRole("button", { name: "Clôturer les inscriptions" }).click();
    await toast("Inscriptions clôturées.");
    const closed = await request.get(publicPath);
    expect(await closed.text()).toContain("Les inscriptions à cette rencontre sont closes.");

    // --- Le journal garde la trace des actions sensibles ---
    await page.goto("/admin/audit");
    for (const label of [
      "Adhésion refusée",
      "Adhésion validée",
      "Adhésion renouvelée",
      "Compte suspendu",
      "Compte réactivé",
      "Liste exportée (CSV)",
    ]) {
      await expect(page.getByText(label).first(), label).toBeVisible();
    }
  } finally {
    await memberContext.close();
    testUser("delete-events", "E2E-Recette");
    testUser("delete-content", "E2E-Recette");
    testUser("delete", acceptedEmail);
    testUser("delete", refusedEmail);
    testUser("delete", adminEmail);
  }
});

test("espace membre : annuler une inscription depuis /member, refus une fois le délai passé", async ({
  page,
  request,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "L’administration se vérifie sur ordinateur.");
  test.setTimeout(300_000);
  const stamp = Date.now();
  const adminEmail = `recette-delai-admin-${stamp}@e2e.agora.test`;
  const memberEmail = `recette-delai-membre-${stamp}@e2e.agora.test`;
  const memberPassword = `phrase-de-membre-${randomInt(1e6)}`;
  const free = `E2E-Recette Annulable ${stamp}`;
  const locked = `E2E-Recette Verrouillee ${stamp}`;
  const start = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  // Le membre est sur téléphone.
  const memberContext = await browser.newContext({
    ...devices["Pixel 7"],
    locale: "fr-FR",
    baseURL: testInfo.project.use.baseURL,
    extraHTTPHeaders: randomClient(),
  });

  /** Crée et publie une rencontre ; renvoie l'adresse de sa fiche d'administration et de sa page publique. */
  const createEvent = async (title: string) => {
    await page.goto("/admin/events/new");
    await page.getByLabel("Titre").fill(title);
    await page.getByLabel("Début").fill(`${start}T16:00`);
    await page.getByLabel("Présentation").fill("Une rencontre pour vérifier l’annulation.");
    await page.getByRole("button", { name: "Créer le brouillon" }).click();
    await expect(page).toHaveURL(/\/admin\/events\/(?!new$)[a-z0-9]+$/);
    const adminUrl = page.url();
    await page.reload();
    await page.getByRole("button", { name: "Publier" }).click();
    await expect(page.getByText("Événement publié : il est visible sur le site.")).toBeVisible();
    const publicPath = (await page
      .getByRole("link", { name: "Voir la page publique" })
      .getAttribute("href"))!;
    return { adminUrl, publicPath };
  };

  try {
    await signInAsAdmin(page, request, adminEmail);
    const freeEvent = await createEvent(free);
    const lockedEvent = await createEvent(locked);

    // --- Le membre active son compte, se connecte et s'inscrit aux deux rencontres ---
    testUser("create", memberEmail, "Awa");
    const member = await memberContext.newPage();
    await member.goto(
      await linkFromEmail(request, {
        to: memberEmail,
        subject: "Activez votre compte",
        path: "/activate",
      }),
    );
    await member.getByLabel("Mot de passe", { exact: true }).fill(memberPassword);
    await member.getByLabel("Encore une fois").fill(memberPassword);
    await member.getByRole("button", { name: "Activer mon compte" }).click();
    await member.getByLabel("Adresse e-mail").fill(memberEmail);
    await member.getByLabel("Mot de passe", { exact: true }).fill(memberPassword);
    await member.getByRole("button", { name: "Se connecter" }).click();
    await expect(member).toHaveURL(/\/member$/);
    await expect(member.getByText("Aucune inscription pour l’instant.")).toBeVisible();

    for (const event of [freeEvent, lockedEvent]) {
      await member.goto(event.publicPath);
      await member.getByRole("button", { name: "Je m’inscris" }).click();
      await expect(member.getByText("Vous êtes inscrit. Nous vous attendons.")).toBeVisible();
    }

    // --- /member liste les deux inscriptions, chacune annulable ---
    await member.goto("/member");
    const freeRow = member.getByRole("listitem").filter({ hasText: free });
    const lockedRow = member.getByRole("listitem").filter({ hasText: locked });
    await expect(freeRow.getByRole("button", { name: "Annuler mon inscription" })).toBeVisible();
    await expect(lockedRow.getByRole("button", { name: "Annuler mon inscription" })).toBeVisible();

    // --- Pendant que la page du membre reste ouverte, le délai d'une rencontre est dépassé ---
    // (délai d'annulation porté à 500 h pour une rencontre qui commence dans 240 h)
    await page.goto(lockedEvent.adminUrl);
    await page.getByLabel("Délai d’annulation (heures)").fill("500");
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    await expect(page.getByText("Événement enregistré.")).toBeVisible();

    // Le bouton est encore à l'écran du membre : c'est le serveur qui refuse.
    await lockedRow.getByRole("button", { name: "Annuler mon inscription" }).click();
    await lockedRow.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(lockedRow.getByRole("alert")).toContainText("Le délai d’annulation est dépassé.");

    // --- L'autre inscription s'annule : elle quitte la liste ---
    await freeRow.getByRole("button", { name: "Annuler mon inscription" }).click();
    await freeRow.getByRole("button", { name: "Confirmer l’annulation" }).click();
    await expect(freeRow).toHaveCount(0);

    // Après rechargement : la rencontre verrouillée reste, sans bouton, avec l'explication.
    await member.reload();
    await expect(lockedRow).toHaveCount(1);
    await expect(lockedRow.getByText("Le délai d’annulation est passé.")).toBeVisible();
    await expect(lockedRow.getByRole("button", { name: "Annuler mon inscription" })).toHaveCount(0);
    await expect(freeRow).toHaveCount(0);

    // La place annulée est libérée : le membre peut se réinscrire ; l'admin voit l'annulation.
    await member.goto(freeEvent.publicPath);
    await expect(member.getByRole("button", { name: "Je m’inscris" })).toBeVisible();
    await page.goto(freeEvent.adminUrl);
    const registrants = page.getByRole("region", { name: "Inscrits" });
    await registrants.getByLabel("Statut").selectOption({ label: "Annulée" });
    await expect(registrants.getByText("Awa Essai").first()).toBeVisible();
    await page.goto(lockedEvent.adminUrl);
    await expect(
      page.getByRole("region", { name: "Inscrits" }).getByText("Awa Essai").first(),
    ).toBeVisible();
  } finally {
    await memberContext.close();
    testUser("delete-events", "E2E-Recette");
    testUser("delete", memberEmail);
    testUser("delete", adminEmail);
  }
});

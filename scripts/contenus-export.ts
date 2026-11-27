import "dotenv/config";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { isStoredImage } from "@/lib/storage-names";

/**
 * Export des contenus réels du club, de la base locale vers la production.
 *
 *   pnpm exec tsx scripts/contenus-export.ts              → APERÇU : liste ce qui serait exporté
 *                                                           (et ce qui est écarté), ne modifie rien
 *   pnpm exec tsx scripts/contenus-export.ts --exporter   → écrit le dossier export-contenus/
 *
 * Exporté : catégories, auteurs, livres (avec leurs couvertures), comité (avec les photos), charte,
 * rencontres (dont le lancement) et articles (avec leurs images).
 * Jamais exporté : comptes et rôles attribués, sessions, demandes d'adhésion, adhésions,
 * encaissements, inscriptions, lectures et critiques, points et badges, notifications, journal,
 * photos de profil. Les liens vers un compte (auteur d'un article, créateur d'une rencontre)
 * sont retirés.
 * Écarté comme donnée de test : titre ou nom commençant par « E2E » ou « Essai- », marque `isDemo`,
 * ou contenu créé par un compte de test (@e2e.agora.test, @essai.agora.test, @demo.agora.test).
 *
 * L'aperçu est aussi écrit dans export-contenus/APERCU.md. Import : scripts/contenus-import.ts,
 * procédure dans docs/DEPLOIEMENT.md (« Transférer les contenus »).
 */

const OUT = path.resolve("export-contenus");
const exporter = process.argv.includes("--exporter");
const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "uploads");

// « E2E… » (tests Playwright) et « Essai-… » (essai de production). Pas « Essai » seul : c'est
// aussi une catégorie réelle (le genre littéraire).
const testName = /^\s*(e2e[\s-]|essai-)/i;
const statut: Record<string, string> = {
  DRAFT: "brouillon",
  PUBLISHED: "publié",
  CANCELLED: "annulé",
  CLOSED: "clôturé",
  ARCHIVED: "archivé",
};
const testEmail = /@(e2e|essai|demo)\.agora\.test$/i;
const iso = (d: Date | null) => (d ? d.toISOString() : null);
const dateFr = (d: Date | null) =>
  d
    ? d.toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Africa/Dakar",
      })
    : "sans date";

type Excluded = { quoi: string; nom: string; raison: string };
const excluded: Excluded[] = [];

function keep(quoi: string, nom: string, opts: { isDemo?: boolean; creatorEmail?: string | null }) {
  let raison: string | undefined;
  if (testName.test(nom)) raison = "nom de test (E2E… / Essai-…)";
  else if (opts.isDemo) raison = "marqué démonstration (isDemo)";
  else if (opts.creatorEmail && testEmail.test(opts.creatorEmail))
    raison = "créé par un compte de test";
  if (raison) excluded.push({ quoi, nom, raison });
  return !raison;
}

async function main() {
  const [categoriesDb, authorsDb, booksDb, committeeDb, charterDb, eventsDb, articlesDb] =
    await Promise.all([
      prisma.category.findMany({ orderBy: { position: "asc" } }),
      prisma.author.findMany({ orderBy: { name: "asc" } }),
      prisma.book.findMany({
        orderBy: { title: "asc" },
        include: {
          category: { select: { slug: true } },
          authors: { select: { slug: true, name: true } },
        },
      }),
      prisma.committeeMember.findMany({ orderBy: { position: "asc" } }),
      prisma.setting.findMany({
        where: { key: { startsWith: "charter." } },
        orderBy: { key: "asc" },
      }),
      prisma.event.findMany({
        orderBy: { startsAt: "asc" },
        include: { createdBy: { select: { email: true } } },
      }),
      prisma.article.findMany({
        orderBy: { createdAt: "asc" },
        include: { author: { select: { email: true } } },
      }),
    ]);

  const books = booksDb.filter((b) => keep("Livre", b.title, { isDemo: b.isDemo }));
  // Un auteur est exporté s'il n'est pas de test ; ceux sans aucun livre exporté sont signalés.
  const authors = authorsDb.filter((a) => keep("Auteur", a.name, { isDemo: a.isDemo }));
  const authorSlugs = new Set(authors.map((a) => a.slug));
  const categories = categoriesDb.filter((c) => keep("Catégorie", c.name, {}));
  const committee = committeeDb.filter((m) => keep("Comité", m.name, {}));
  const events = eventsDb.filter((e) =>
    keep("Rencontre", e.title, { isDemo: e.isDemo, creatorEmail: e.createdBy?.email }),
  );
  const articles = articlesDb.filter((a) =>
    keep("Article", a.title, { isDemo: a.isDemo, creatorEmail: a.author?.email }),
  );
  for (const b of books) {
    const missing = b.authors.filter((a) => !authorSlugs.has(a.slug));
    if (missing.length)
      throw new Error(
        `Le livre « ${b.title} » cite un auteur écarté : ${missing.map((a) => a.name).join(", ")}`,
      );
  }

  const bundle = {
    format: "agora-contenus",
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      description: c.description,
      position: c.position,
    })),
    authors: authors.map((a) => ({ slug: a.slug, name: a.name, bio: a.bio })),
    books: books.map((b) => ({
      slug: b.slug,
      title: b.title,
      subtitle: b.subtitle,
      summary: b.summary,
      category: b.category.slug,
      authors: b.authors.map((a) => a.slug),
      language: b.language,
      publisher: b.publisher,
      publishedYear: b.publishedYear,
      pageCount: b.pageCount,
      isbn: b.isbn,
      coverImage: b.coverImage,
      isClubFavorite: b.isClubFavorite,
      clubNote: b.clubNote,
      isPublished: b.isPublished,
      archivedAt: iso(b.archivedAt),
    })),
    committee: committee.map((m) => ({
      name: m.name,
      role: m.role,
      photo: m.photo,
      bio: m.bio,
      position: m.position,
    })),
    charter: charterDb.map((s) => ({ key: s.key, value: s.value })),
    events: events.map((e) => ({
      slug: e.slug,
      title: e.title,
      type: e.type,
      activities: e.activities,
      status: e.status,
      summary: e.summary,
      description: e.description,
      location: e.location,
      startsAt: iso(e.startsAt),
      endsAt: iso(e.endsAt),
      isTentative: e.isTentative,
      program: e.program,
      speakerName: e.speakerName,
      speakerTitle: e.speakerTitle,
      speakerMode: e.speakerMode,
      videoLink: e.videoLink,
      reportContent: e.reportContent,
      reportPublishedAt: iso(e.reportPublishedAt),
      capacity: e.capacity,
      isPublic: e.isPublic,
      cancellationDeadlineHours: e.cancellationDeadlineHours,
      coverImage: e.coverImage,
      publishedAt: iso(e.publishedAt),
      archivedAt: iso(e.archivedAt),
    })),
    articles: articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      category: a.category,
      status: a.status,
      publishedAt: iso(a.publishedAt),
      coverImage: a.coverImage,
      archivedAt: iso(a.archivedAt),
    })),
    files: [] as { name: string; sha256: string }[],
  };

  // Images citées par les contenus exportés : jamais les photos de profil (avatars).
  const images = [
    ...bundle.books.map((b) => b.coverImage),
    ...bundle.committee.map((m) => m.photo),
    ...bundle.events.map((e) => e.coverImage),
    ...bundle.articles.map((a) => a.coverImage),
  ].filter((n): n is string => !!n);
  const missingFiles: string[] = [];
  for (const name of [...new Set(images)].sort()) {
    const file = path.join(uploadRoot, name);
    if (!isStoredImage(name) || name.startsWith("avatars/") || !existsSync(file)) {
      missingFiles.push(name);
      continue;
    }
    bundle.files.push({
      name,
      sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
    });
  }

  // --- Aperçu --------------------------------------------------------------------------------
  const notExported = await Promise.all([
    prisma.user.count().then((n) => `Comptes : ${n}`),
    prisma.membershipRequest.count().then((n) => `Demandes d’adhésion : ${n}`),
    prisma.payment.count().then((n) => `Encaissements : ${n}`),
    prisma.eventRegistration.count().then((n) => `Inscriptions aux rencontres : ${n}`),
    prisma.reading.count().then((n) => `Lectures de membres : ${n}`),
    prisma.monthlySelection
      .count()
      .then((n) => `Livres du mois : ${n} (à ressaisir, ou à ajouter à l’export sur demande)`),
    prisma.quiz.count().then((n) => `Quiz : ${n} (à ajouter à l’export sur demande)`),
    prisma.tournament
      .count()
      .then((n) => `Tournois de Scrabble : ${n} (à ajouter à l’export sur demande)`),
    prisma.scrabbleRecord
      .count()
      .then((n) => `Records de Scrabble : ${n} (à ajouter à l’export sur demande)`),
    prisma.setting
      .count({ where: { NOT: { key: { startsWith: "charter." } } } })
      .then(
        (n) =>
          `Autres réglages (identité du club, tarifs, contacts) : ${n} (à ressaisir dans Administration > Paramètres)`,
      ),
  ]);

  const authorBooks = (slug: string) =>
    books.filter((b) => b.authors.some((a) => a.slug === slug)).length;
  const lines: string[] = [
    `# Aperçu de l’export des contenus`,
    ``,
    `Base : ${process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, "//…@") ?? "?"} · ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })} (heure de Dakar)`,
    ``,
    `## Sera exporté`,
    ``,
    `### Catégories (${categories.length})`,
    ...categories.map((c) => `- ${c.name}`),
    ``,
    `### Auteurs (${authors.length})`,
    ...authors.map((a) => `- ${a.name}${authorBooks(a.slug) ? "" : " — aucun livre exporté"}`),
    ``,
    `### Livres (${books.length})`,
    ...books.map(
      (b) =>
        `- ${b.title} — ${b.authors.map((a) => a.name).join(", ") || "sans auteur"} · ${categoriesDb.find((c) => c.id === b.categoryId)?.name}` +
        `${b.coverImage ? " · couverture" : ""}${b.isPublished ? "" : " · non publié"}${b.archivedAt ? " · archivé" : ""}`,
    ),
    ``,
    `### Comité de pilotage (${committee.length})`,
    ...committee.map(
      (m) => `- ${m.name}${m.role ? ` — ${m.role}` : ""}${m.photo ? " · photo" : ""}`,
    ),
    ``,
    `### Charte (${charterDb.length} réglage${charterDb.length > 1 ? "s" : ""})`,
    ...charterDb.map((s) => {
      const v =
        typeof s.value === "string" ? `${s.value.length} caractères` : JSON.stringify(s.value);
      return `- ${s.key} : ${v}`;
    }),
    ...(charterDb.length ? [] : ["- (aucune : la page Charte affichera le texte par défaut)"]),
    ``,
    `### Rencontres (${events.length})`,
    ...events.map(
      (e) =>
        `- ${e.title} — ${dateFr(e.startsAt)} · ${statut[e.status] ?? e.status}${e.archivedAt ? " · archivée" : ""}${e.reportContent ? " · compte rendu" : ""}`,
    ),
    ``,
    `### Articles (${articles.length})`,
    ...articles.map(
      (a) =>
        `- ${a.title} — ${a.category} · ${statut[a.status] ?? a.status}${a.archivedAt ? " · archivé" : ""}`,
    ),
    ``,
    `### Images (${bundle.files.length})`,
    ...bundle.files.map((f) => `- ${f.name}`),
    ...(missingFiles.length
      ? [
          "",
          `**Images citées mais introuvables dans ${uploadRoot} (${missingFiles.length})** :`,
          ...missingFiles.map((f) => `- ${f}`),
        ]
      : []),
    ``,
    `## Écarté comme donnée de test (${excluded.length})`,
    ...(excluded.length ? excluded.map((e) => `- ${e.quoi} : ${e.nom} — ${e.raison}`) : ["- rien"]),
    ``,
    `## Jamais exporté`,
    ...notExported.map((l) => `- ${l}`),
    `- Sessions, rôles attribués, points, badges, notifications, journal, photos de profil`,
    ``,
  ];
  const apercu = lines.join("\n");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(path.join(OUT, "APERCU.md"), apercu);
  console.log(apercu);

  if (missingFiles.length) {
    throw new Error(
      `${missingFiles.length} image(s) introuvable(s) : vérifiez UPLOAD_DIR (${uploadRoot}).`,
    );
  }
  if (!exporter) {
    console.log(`Aperçu seulement (export-contenus/APERCU.md). Pour écrire l’export : --exporter`);
    return;
  }
  rmSync(path.join(OUT, "uploads"), { recursive: true, force: true });
  for (const f of bundle.files) {
    const target = path.join(OUT, "uploads", f.name);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(uploadRoot, f.name), target);
  }
  writeFileSync(path.join(OUT, "contenus.json"), JSON.stringify(bundle, null, 2));
  console.log(
    `Export écrit : ${OUT}/contenus.json et ${bundle.files.length} image(s) dans ${OUT}/uploads/.`,
  );
}

main()
  .catch((error) => {
    console.error(`\nÉchec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

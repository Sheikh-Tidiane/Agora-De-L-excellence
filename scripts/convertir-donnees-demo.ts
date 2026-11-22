import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

/**
 * Décision du 21/11/2026 : les contenus marqués `isDemo` sont gardés et deviennent des
 * contenus réels, que l'administrateur corrige un par un depuis l'admin. Rien n'est supprimé.
 *
 *   pnpm exec tsx scripts/convertir-donnees-demo.ts            → compte, ne modifie rien
 *   pnpm exec tsx scripts/convertir-donnees-demo.ts --appliquer → passe `isDemo` à false
 *
 * L'application, en une transaction :
 *  1. relève la liste des enregistrements concernés (titre, lien d'édition) ;
 *  2. calcule, pour chaque table de la base, le nombre de lignes et une empreinte de toutes les
 *     colonnes sauf `isDemo` ;
 *  3. passe `isDemo` à false en SQL direct (Prisma mettrait à jour `updatedAt`) ;
 *  4. recalcule nombres et empreintes : la moindre différence annule tout.
 * Puis elle écrit docs/A-CORRIGER.md.
 */

const TABLES_DEMO = [
  "User",
  "MembershipRequest",
  "Author",
  "Book",
  "MonthlySelection",
  "Event",
  "Tournament",
  "ScrabbleRecord",
  "Quiz",
  "Article",
] as const;
type TableDemo = (typeof TABLES_DEMO)[number];

type Ligne = { titre: string; detail?: string; lien: string };

const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const dateFr = (d: Date) =>
  d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Dakar",
  });

type Client = Pick<typeof prisma, "$queryRawUnsafe" | "$executeRawUnsafe"> & typeof prisma;

async function toutesLesTables(db: Client): Promise<string[]> {
  const rows = await db.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
     ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

/** Nombre de lignes et empreinte de tout le contenu (hors `isDemo`) de chaque table. */
async function etatDesTables(db: Client, tables: string[]) {
  const etat: Record<string, { lignes: number; empreinte: string }> = {};
  for (const t of tables) {
    const [r] = await db.$queryRawUnsafe<{ lignes: bigint; empreinte: string }[]>(
      `SELECT count(*) AS lignes,
              md5(coalesce(string_agg((to_jsonb(x) - 'isDemo')::text, '|' ORDER BY (to_jsonb(x) - 'isDemo')::text), '')) AS empreinte
       FROM "${t}" x`,
    );
    etat[t] = { lignes: Number(r!.lignes), empreinte: r!.empreinte };
  }
  return etat;
}

async function compterDemo(db: Client) {
  const n: Record<TableDemo, number> = {} as Record<TableDemo, number>;
  for (const t of TABLES_DEMO) {
    const [r] = await db.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*) AS n FROM "${t}" WHERE "isDemo" = true`,
    );
    n[t] = Number(r!.n);
  }
  return n;
}

/** Les enregistrements concernés, avec de quoi les retrouver dans l'admin. */
async function liste(db: Client): Promise<Record<TableDemo, Ligne[]>> {
  const ou = { isDemo: true } as const;
  const [
    users,
    demandes,
    auteurs,
    livres,
    selections,
    rencontres,
    tournois,
    records,
    quiz,
    articles,
  ] = await Promise.all([
    db.user.findMany({
      where: ou,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        roles: { select: { role: { select: { code: true } } } },
      },
    }),
    db.membershipRequest.findMany({
      where: ou,
      orderBy: { createdAt: "asc" },
      select: { id: true, firstName: true, lastName: true, email: true, status: true },
    }),
    db.author.findMany({ where: ou, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.book.findMany({
      where: ou,
      orderBy: { title: "asc" },
      select: { id: true, title: true, slug: true },
    }),
    db.monthlySelection.findMany({
      where: ou,
      orderBy: { month: "asc" },
      select: { id: true, month: true, book: { select: { title: true } } },
    }),
    db.event.findMany({
      where: ou,
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, status: true },
    }),
    db.tournament.findMany({
      where: ou,
      orderBy: { startsAt: "asc" },
      select: { id: true, name: true, startsAt: true, status: true },
    }),
    db.scrabbleRecord.findMany({
      where: ou,
      orderBy: { category: "asc" },
      select: { id: true, category: true, value: true },
    }),
    db.quiz.findMany({
      where: ou,
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
    db.article.findMany({
      where: ou,
      orderBy: { title: "asc" },
      select: { id: true, title: true, status: true },
    }),
  ]);

  return {
    User: users.map((u) => {
      const membre = u.roles.some((r) => r.role.code === "member");
      return {
        titre: `${u.firstName} ${u.lastName}`.trim(),
        detail: `${u.email}${u.email.endsWith("@e2e.agora.test") ? " — compte laissé par un test automatique" : ""}`,
        lien: membre ? `${base}/admin/members?open=${u.id}` : `${base}/admin/team`,
      };
    }),
    MembershipRequest: demandes.map((d) => ({
      titre: `${d.firstName} ${d.lastName}`.trim(),
      detail: `${d.email} · ${d.status}`,
      lien: `${base}/admin/memberships?open=${d.id}`,
    })),
    Author: auteurs.map((a) => ({
      titre: a.name,
      detail: "se modifie depuis la fiche de ses livres",
      lien: `${base}/admin/books`,
    })),
    Book: livres.map((b) => ({ titre: b.title, lien: `${base}/admin/books?open=${b.id}` })),
    MonthlySelection: selections.map((s) => ({
      titre: s.month.toLocaleDateString("fr-FR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
      detail: `livre : ${s.book.title}`,
      lien: `${base}/admin/books/monthly`,
    })),
    Event: rencontres.map((e) => ({
      titre: e.title,
      detail: `${dateFr(e.startsAt)} · ${e.status}`,
      lien: `${base}/admin/events/${e.id}`,
    })),
    Tournament: tournois.map((t) => ({
      titre: t.name,
      detail: `${dateFr(t.startsAt)} · ${t.status}`,
      lien: `${base}/admin/scrabble/${t.id}/settings`,
    })),
    ScrabbleRecord: records.map((r) => ({
      titre: r.category,
      detail: r.value,
      lien: `${base}/admin/scrabble/records`,
    })),
    Quiz: quiz.map((q) => ({
      titre: q.title,
      detail: q.status,
      lien: `${base}/admin/quizzes/${q.id}`,
    })),
    Article: articles.map((a) => ({
      titre: a.title,
      detail: a.status,
      lien: `${base}/admin/articles/${a.id}`,
    })),
  };
}

const NOMS: Record<TableDemo, string> = {
  Book: "Livres",
  Author: "Auteurs",
  MonthlySelection: "Livres du mois",
  Event: "Rencontres (événements)",
  Article: "Articles",
  Tournament: "Tournois de Scrabble",
  ScrabbleRecord: "Records de Scrabble",
  Quiz: "Quiz",
  User: "Comptes (membres et responsables)",
  MembershipRequest: "Demandes d’adhésion",
};
const ORDRE: TableDemo[] = [
  "Book",
  "Author",
  "MonthlySelection",
  "Event",
  "Article",
  "Tournament",
  "ScrabbleRecord",
  "Quiz",
  "User",
  "MembershipRequest",
];

function ecrireACorriger(lignes: Record<TableDemo, Ligne[]>, date: string) {
  const total = ORDRE.reduce((s, t) => s + lignes[t].length, 0);
  const md: string[] = [
    "# Contenus à corriger",
    "",
    `Liste établie le ${date}, au moment où ces ${total} enregistrements, créés à l’origine comme exemples, sont devenus des contenus réels de la plateforme (décision du porteur du projet : rien n’est supprimé, tout est corrigé depuis l’admin).`,
    "",
    "Chaque ligne mène à sa page d’édition dans l’administration. Les liens commencent par l’adresse du site de développement ; sur le site en ligne, remplacer le début de l’adresse.",
    "Les informations des livres (auteurs, éditions, résumés) n’ont pas encore été vérifiées.",
    "",
  ];
  for (const t of ORDRE) {
    const l = lignes[t];
    if (!l.length) continue;
    md.push(`## ${NOMS[t]} (${l.length})`, "");
    for (const x of l)
      md.push(
        `- [ ] [${x.titre.replaceAll("[", "(").replaceAll("]", ")")}](${x.lien})${x.detail ? ` — ${x.detail}` : ""}`,
      );
    md.push("");
  }
  writeFileSync("docs/A-CORRIGER.md", md.join("\n"));
}

async function main() {
  const appliquer = process.argv.includes("--appliquer");
  const tables = await toutesLesTables(prisma);
  const avant = await compterDemo(prisma);
  console.log("Enregistrements marqués isDemo = true :");
  for (const t of TABLES_DEMO) console.log(`  ${t.padEnd(18)} ${avant[t]}`);
  console.log(`  ${"TOTAL".padEnd(18)} ${Object.values(avant).reduce((a, b) => a + b, 0)}`);
  if (Object.values(avant).every((n) => n === 0)) {
    console.log("\nAucun enregistrement à convertir : docs/A-CORRIGER.md n'est pas réécrit.");
    return;
  }
  if (!appliquer) {
    console.log(
      "\nRien n'a été modifié. Ajouter --appliquer pour passer ces enregistrements à isDemo = false.",
    );
    return;
  }

  const resultat = await prisma.$transaction(
    async (tx) => {
      const db = tx as unknown as Client;
      const lignes = await liste(db);
      const etatAvant = await etatDesTables(db, tables);
      for (const t of TABLES_DEMO)
        await db.$executeRawUnsafe(`UPDATE "${t}" SET "isDemo" = false WHERE "isDemo" = true`);
      const etatApres = await etatDesTables(db, tables);
      const restants = await compterDemo(db);
      const ecarts = tables.filter(
        (t) =>
          etatAvant[t]!.lignes !== etatApres[t]!.lignes ||
          etatAvant[t]!.empreinte !== etatApres[t]!.empreinte,
      );
      if (ecarts.length)
        throw new Error(`Contenu modifié dans : ${ecarts.join(", ")} — tout est annulé.`);
      if (Object.values(restants).some((n) => n > 0))
        throw new Error("Il reste des lignes isDemo = true — tout est annulé.");
      return { lignes, etatAvant, etatApres };
    },
    { timeout: 120_000 },
  );

  console.log(
    "\nNombre de lignes par table (avant → après), contenu hors isDemo comparé par empreinte :",
  );
  for (const t of tables) {
    const a = resultat.etatAvant[t]!;
    const b = resultat.etatApres[t]!;
    console.log(
      `  ${t.padEnd(26)} ${String(a.lignes).padStart(5)} → ${String(b.lignes).padStart(5)}  ${a.empreinte === b.empreinte ? "identique" : "DIFFÉRENT"}`,
    );
  }
  ecrireACorriger(resultat.lignes, dateFr(new Date()));
  console.log(
    "\n✓ isDemo = false partout ; aucune ligne ajoutée ni supprimée ; liste écrite dans docs/A-CORRIGER.md.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

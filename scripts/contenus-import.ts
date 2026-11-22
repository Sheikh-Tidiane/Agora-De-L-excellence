import "dotenv/config";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { isStoredImage } from "@/lib/storage-names";

/**
 * Import en production des contenus exportés par scripts/contenus-export.ts.
 *
 *   tsx scripts/contenus-import.ts <dossier>               → SIMULATION : ce qui serait créé,
 *                                                             mis à jour, retiré ; rien n'est écrit
 *   tsx scripts/contenus-import.ts <dossier> --appliquer   → écrit, en une transaction
 *
 * En production, dans le conteneur d'outils (docs/DEPLOIEMENT.md, « Transférer les contenus ») :
 *   bash scripts/prod-compose.sh run --rm -v "$PWD/export-contenus:/import:ro" tools \
 *     pnpm exec tsx scripts/contenus-import.ts /import
 *
 * Règles : chaque contenu est rapproché par son adresse (slug), le comité par le nom, la charte
 * par sa clé. Ce qui existe est mis à jour avec les valeurs exportées, ce qui manque est créé.
 * Seul le comité est remplacé en entier (un membre absent de l'export est retiré). Rien d'autre
 * n'est supprimé : un contenu présent en production et absent de l'export est seulement signalé.
 * Les images sont copiées dans UPLOAD_DIR après contrôle de leur empreinte ; une image déjà
 * présente n'est jamais écrasée. Relancé, l'import ne change plus rien.
 */

type Bundle = {
  format: string;
  version: number;
  exportedAt: string;
  categories: { slug: string; name: string; description: string | null; position: number }[];
  authors: { slug: string; name: string; bio: string | null }[];
  books: (Omit<Prisma.BookUncheckedCreateInput, "categoryId" | "archivedAt"> & {
    slug: string;
    category: string;
    authors: string[];
    archivedAt: string | null;
  })[];
  committee: {
    name: string;
    role: string | null;
    photo: string | null;
    bio: string | null;
    position: number;
  }[];
  charter: { key: string; value: Prisma.InputJsonValue }[];
  events: Record<string, unknown>[];
  articles: Record<string, unknown>[];
  files: { name: string; sha256: string }[];
};

const dir = process.argv[2];
const appliquer = process.argv.includes("--appliquer");
if (!dir || dir.startsWith("--")) {
  console.error("Usage : tsx scripts/contenus-import.ts <dossier de l’export> [--appliquer]");
  process.exit(2);
}

const eventDates = ["startsAt", "endsAt", "reportPublishedAt", "publishedAt", "archivedAt"];
const toDates = (row: Record<string, unknown>, keys: string[]) => {
  const out = { ...row };
  for (const k of keys) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  return out;
};

async function main() {
  const bundle = JSON.parse(readFileSync(path.join(dir!, "contenus.json"), "utf8")) as Bundle;
  if (bundle.format !== "agora-contenus" || bundle.version !== 1) {
    throw new Error("Ce dossier n’est pas un export de scripts/contenus-export.ts (version 1).");
  }
  const uploadRoot = path.resolve(process.env.UPLOAD_DIR || "uploads");

  // --- Images : contrôle avant toute écriture -------------------------------------------------
  const filesToCopy: string[] = [];
  for (const f of bundle.files) {
    if (!isStoredImage(f.name) || f.name.startsWith("avatars/"))
      throw new Error(`Nom d’image refusé : ${f.name}`);
    const src = path.join(dir!, "uploads", f.name);
    const hash = createHash("sha256").update(readFileSync(src)).digest("hex");
    if (hash !== f.sha256) throw new Error(`Image abîmée pendant le transfert : ${f.name}`);
    const target = path.join(uploadRoot, f.name);
    if (existsSync(target)) {
      const there = createHash("sha256").update(readFileSync(target)).digest("hex");
      if (there !== f.sha256)
        throw new Error(`Une autre image porte déjà ce nom en production : ${f.name}`);
    } else filesToCopy.push(f.name);
  }

  // --- Ce qui va changer ------------------------------------------------------------------------
  const existing = async <T extends { slug: string }>(
    rows: T[],
    find: (slugs: string[]) => Promise<{ slug: string }[]>,
  ) => {
    const found = new Set((await find(rows.map((r) => r.slug))).map((r) => r.slug));
    return {
      create: rows.filter((r) => !found.has(r.slug)),
      update: rows.filter((r) => found.has(r.slug)),
    };
  };
  const plan = {
    categories: await existing(bundle.categories, (slugs) =>
      prisma.category.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ),
    authors: await existing(bundle.authors, (slugs) =>
      prisma.author.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ),
    books: await existing(bundle.books, (slugs) =>
      prisma.book.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ),
    events: await existing(bundle.events as { slug: string }[], (slugs) =>
      prisma.event.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ),
    articles: await existing(bundle.articles as { slug: string }[], (slugs) =>
      prisma.article.findMany({ where: { slug: { in: slugs } }, select: { slug: true } }),
    ),
  };
  const committeeNames = new Set(bundle.committee.map((m) => m.name));
  const committeeRemoved = (
    await prisma.committeeMember.findMany({ select: { name: true } })
  ).filter((m) => !committeeNames.has(m.name));
  const onlyInProd = {
    livres: await prisma.book.findMany({
      where: { slug: { notIn: bundle.books.map((b) => b.slug) } },
      select: { title: true },
    }),
    rencontres: await prisma.event.findMany({
      where: { slug: { notIn: bundle.events.map((e) => e.slug as string) } },
      select: { title: true },
    }),
    articles: await prisma.article.findMany({
      where: { slug: { notIn: bundle.articles.map((a) => a.slug as string) } },
      select: { title: true },
    }),
  };

  const label = (r: { name?: unknown; title?: unknown; slug: string }) =>
    String(r.title ?? r.name ?? r.slug);
  console.log(
    `Export du ${new Date(bundle.exportedAt).toLocaleString("fr-FR", { timeZone: "Africa/Dakar" })}\n`,
  );
  for (const [quoi, p] of Object.entries(plan)) {
    console.log(`${quoi} : ${p.create.length} à créer, ${p.update.length} à mettre à jour`);
    for (const r of p.create) console.log(`  + ${label(r as never)}`);
    for (const r of p.update) console.log(`  ~ ${label(r as never)}`);
  }
  console.log(`comité : ${bundle.committee.length} membre(s), remplacé en entier`);
  for (const m of committeeRemoved) console.log(`  - retiré : ${m.name}`);
  console.log(`charte : ${bundle.charter.length} réglage(s)`);
  console.log(
    `images : ${filesToCopy.length} à copier, ${bundle.files.length - filesToCopy.length} déjà présente(s)`,
  );
  for (const [quoi, rows] of Object.entries(onlyInProd)) {
    if (rows.length)
      console.log(
        `présents en production seulement (laissés tels quels) — ${quoi} : ${rows.map((r) => r.title).join(" ; ")}`,
      );
  }

  if (!appliquer) {
    console.log("\nSimulation : rien n’a été écrit. Relancer avec --appliquer pour importer.");
    return;
  }

  // --- Écriture -----------------------------------------------------------------------------------
  for (const name of filesToCopy) {
    const target = path.join(uploadRoot, name);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(path.join(dir!, "uploads", name), target);
  }

  await prisma.$transaction(
    async (tx) => {
      for (const c of bundle.categories) {
        await tx.category.upsert({ where: { slug: c.slug }, update: c, create: c });
      }
      for (const a of bundle.authors) {
        await tx.author.upsert({ where: { slug: a.slug }, update: a, create: a });
      }
      for (const { category, authors, archivedAt, ...b } of bundle.books) {
        const data = {
          ...b,
          archivedAt: archivedAt ? new Date(archivedAt) : null,
          category: { connect: { slug: category } },
        };
        await tx.book.upsert({
          where: { slug: b.slug },
          update: { ...data, authors: { set: authors.map((slug) => ({ slug })) } },
          create: { ...data, authors: { connect: authors.map((slug) => ({ slug })) } },
        });
      }
      await tx.committeeMember.deleteMany({ where: { name: { notIn: [...committeeNames] } } });
      for (const m of bundle.committee) {
        await tx.committeeMember.upsert({ where: { name: m.name }, update: m, create: m });
      }
      for (const s of bundle.charter) {
        await tx.setting.upsert({ where: { key: s.key }, update: { value: s.value }, create: s });
      }
      for (const e of bundle.events) {
        const data = toDates(e, eventDates) as Prisma.EventUncheckedCreateInput;
        await tx.event.upsert({ where: { slug: data.slug }, update: data, create: data });
      }
      for (const a of bundle.articles) {
        const data = toDates(a, [
          "publishedAt",
          "archivedAt",
        ]) as Prisma.ArticleUncheckedCreateInput;
        await tx.article.upsert({ where: { slug: data.slug }, update: data, create: data });
      }
      await audit(
        {
          actorId: null,
          action: "contents.imported",
          entityType: "Setting",
          entityId: "contenus",
          metadata: {
            exportedAt: bundle.exportedAt,
            livres: bundle.books.length,
            rencontres: bundle.events.length,
            articles: bundle.articles.length,
            images: filesToCopy.length,
          },
        },
        tx,
      );
    },
    { timeout: 120_000 },
  );
  console.log(
    "\nImport terminé. Reconstruire les pages pré-rendues : bash scripts/deploy.sh --no-pull",
  );
}

main()
  .catch((error) => {
    console.error(`\nÉchec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

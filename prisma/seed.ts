import "dotenv/config";
import { site } from "@/config/site";
import { slugify } from "@/lib/slug";
import { rules as defaultRules } from "@/config/rules";
import type { BadgeCriterion, EventType } from "@/generated/prisma/client";
import { PERMISSIONS, ROLES, type PermissionCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

/**
 * Seed idempotent : peut être relancé sans dupliquer ni écraser.
 * Il ne sème que des données de référence et les contenus officiels du club, jamais de
 * contenus fictifs (décision du 21/11/2026) :
 * - référence (rôles, permissions, barème, badges, niveaux, catégories, réglages) : créée si
 *   absente ; les valeurs déjà ajustées par un responsable ne sont jamais écrasées ;
 * - club (comité de pilotage, lancement) : d'après docs/CONTENUS-CLUB.md.
 * Livres, rencontres, articles, tournois et quiz se créent depuis l'administration.
 * Aucun compte utilisateur n'est créé ici : le super-admin se crée avec `pnpm create-admin`.
 */
async function seedAccessControl() {
  for (const [code, description] of Object.entries(PERMISSIONS)) {
    await prisma.permission.upsert({
      where: { code },
      update: { description },
      create: { code, description },
    });
  }
  const permissions = await prisma.permission.findMany();
  const idByCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const [code, role] of Object.entries(ROLES)) {
    const saved = await prisma.role.upsert({
      where: { code },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { code, name: role.name, description: role.description, isSystem: true },
    });
    await prisma.rolePermission.createMany({
      data: (role.permissions as readonly PermissionCode[]).map((permission) => ({
        roleId: saved.id,
        permissionId: idByCode.get(permission)!,
      })),
      skipDuplicates: true,
    });
  }
}

/** Barème du cahier des charges (§4.1). Valeurs de départ, ajustables par un administrateur. */
const pointRules: {
  code: string;
  label: string;
  description?: string;
  points: number;
  eventType?: EventType;
}[] = [
  {
    code: "reading_session",
    label: "Participer à une séance de lecture",
    points: 20,
    eventType: "RENDEZ_VOUS_LECTURE",
  },
  { code: "book_finished", label: "Terminer un livre et renseigner sa fiche", points: 50 },
  { code: "debate", label: "Participer à un débat", points: 15, eventType: "DEBAT_IDEES" },
  {
    code: "tournament_participation",
    label: "Participer à un tournoi de Scrabble",
    points: 20,
    eventType: "TOURNOI_SCRABBLE",
  },
  { code: "tournament_win", label: "Gagner un tournoi", points: 50 },
  { code: "review_approved", label: "Publier une critique littéraire validée", points: 30 },
  {
    code: "quiz_completed",
    label: "Terminer un quiz en ligne",
    description: "Barème proposé, à valider par le comité.",
    points: 10,
  },
];

/**
 * Niveaux : cinq paliers, seuils du cahier des charges (0, 100, 300, 700, 1 500 points).
 * Noms proposés, à valider par le comité ; modifiables ensuite par un administrateur.
 */
const levels = [
  { code: "esprit_curieux", name: "Esprit curieux", minPoints: 0 },
  { code: "plume_en_eveil", name: "Plume en éveil", minPoints: 100 },
  { code: "voix_affirmee", name: "Voix affirmée", minPoints: 300 },
  { code: "pilier_de_l_agora", name: "Pilier de l’Agora", minPoints: 700 },
  { code: "flamme_de_l_agora", name: "Flamme de l’Agora", minPoints: 1500 },
];

const badges: {
  code: string;
  name: string;
  description: string;
  criterion: BadgeCriterion;
  threshold?: number;
}[] = [
  {
    code: "lecteur_passionne",
    name: "Lecteur passionné",
    description: "Cinq livres terminés.",
    criterion: "BOOKS_FINISHED",
    threshold: 5,
  },
  {
    code: "maitre_des_lettres",
    name: "Maître des lettres",
    description: "Victoire dans un tournoi.",
    criterion: "TOURNAMENTS_WON",
    threshold: 1,
  },
  {
    code: "esprit_debatteur",
    name: "Esprit débatteur",
    description: "Participation à dix débats.",
    criterion: "DEBATES_ATTENDED",
    threshold: 10,
  },
  {
    code: "ambassadeur_du_savoir",
    name: "Ambassadeur du savoir",
    description:
      "Contribution remarquable à la vie du club. Attribué par un administrateur, avec un motif.",
    criterion: "MANUAL",
  },
];

const categories = [
  "Littérature sénégalaise",
  "Littérature africaine",
  "Roman",
  "Conte et nouvelle",
  "Poésie",
  "Théâtre",
  "Essai",
  "Jeunesse",
];

async function seedReference() {
  for (const rule of pointRules) {
    await prisma.pointRule.upsert({ where: { code: rule.code }, update: {}, create: rule });
  }
  for (const badge of badges) {
    await prisma.badge.upsert({ where: { code: badge.code }, update: {}, create: badge });
  }
  // Semés seulement dans une base qui n'en a pas : un niveau renommé, déplacé ou retiré
  // par un administrateur n'est ni réécrit ni recréé.
  if ((await prisma.level.count()) === 0) await prisma.level.createMany({ data: levels });
  for (const [position, name] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { slug: slugify(name), name, position },
    });
  }
  // Identité du club : modifiable ensuite depuis l'admin, jamais écrasée par le seed.
  for (const [key, value] of Object.entries({
    "club.name": site.name,
    "club.shortName": site.shortName,
    "club.slogan": site.slogan,
    "fees.membershipCard": defaultRules["fees.membershipCard"],
    "fees.session": defaultRules["fees.session"],
  })) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
}

/**
 * Contenus réels du club (docs/CONTENUS-CLUB.md), jamais écrasés par un nouveau passage du seed.
 */
const committee = ["Yaye Arête Sagna Diop", "Mame Cheikh Diop", "Ndèye Absa Diop", "Mansour Diop"];

const launch = {
  slug: "lancement-de-l-agora",
  title: "Lancement de L’Agora de l’Excellence",
  summary:
    "Présentation du club, de sa vision et de ses cinq activités, première animation, puis adhésions sur place.",
  description:
    "Le club se présente : sa vision, ses trois dimensions et ses cinq activités, chacune avec une courte démonstration.\n\nSuit une première animation, lecture et quiz de culture générale, puis la présentation du comité de pilotage.\n\nLa rencontre se termine par les adhésions, les échanges et une collation. Un QR code affiché sur place ouvre le formulaire d’adhésion : on s’inscrit depuis son téléphone.",
  program: [
    "16 h 00 – 16 h 30 | Mise en place",
    "16 h 30 – 17 h 00 | Accueil des participants",
    "17 h 00 – 17 h 20 | Présentation du club et de sa vision",
    "17 h 20 – 17 h 40 | Présentation des cinq activités, chacune avec une courte démonstration",
    "17 h 40 – 18 h 10 | Première animation : lecture et quiz de culture générale",
    "18 h 10 – 18 h 25 | Présentation du comité et mot de clôture",
    "18 h 25 – 19 h 00 | Adhésions, échanges et collation",
  ].join("\n"),
};

async function seedClub() {
  // Le comité n'est semé que dans une base qui n'en a pas : un nom retiré depuis l'admin ne revient pas.
  if ((await prisma.committeeMember.count()) === 0) {
    await prisma.committeeMember.createMany({
      data: committee.map((name, position) => ({ name, position })),
    });
  }
  // Samedi 26 décembre 2026, à partir de 16 h : date provisoire, lieu à confirmer.
  await prisma.event.upsert({
    where: { slug: launch.slug },
    update: {},
    create: {
      ...launch,
      type: "LANCEMENT_AUTRE",
      status: "PUBLISHED",
      isTentative: true,
      location: null,
      startsAt: new Date("2026-12-26T16:00:00Z"),
      endsAt: new Date("2026-12-26T19:00:00Z"),
      isPublic: true,
      publishedAt: new Date(),
    },
  });
}

async function main() {
  await seedAccessControl();
  await seedReference();
  await seedClub();
  const [roles, permissions, rules, badgeCount, levelCount, categoryCount, settingCount] =
    await Promise.all([
      prisma.role.count(),
      prisma.permission.count(),
      prisma.pointRule.count(),
      prisma.badge.count(),
      prisma.level.count(),
      prisma.category.count(),
      prisma.setting.count(),
    ]);
  console.log(
    `Seed terminé : ${roles} rôles, ${permissions} permissions, ${rules} règles de points, ${badgeCount} badges, ${levelCount} niveaux, ${categoryCount} catégories, ${settingCount} réglages.`,
  );
  console.log(
    `Contenus du club : ${await prisma.committeeMember.count()} membres du comité, lancement du 26 décembre 2026 (date provisoire).`,
  );
  console.log("Aucun compte n’est créé par le seed. Super-admin : pnpm create-admin");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

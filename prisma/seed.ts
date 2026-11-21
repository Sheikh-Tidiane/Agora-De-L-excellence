import "dotenv/config";
import { site } from "@/config/site";
import { slugify } from "@/lib/slug";
import { rules as defaultRules } from "@/config/rules";
import { articles, bookOfTheMonth, books, demoQuiz, events } from "./demo-data";
import type { BadgeCriterion, EventType } from "@/generated/prisma/client";
import { PERMISSIONS, ROLES, type PermissionCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";
import { seedDemoTournamentResults } from "./seed-scrabble";

/**
 * Seed idempotent : peut être relancé sans dupliquer ni écraser.
 * - Référence (rôles, permissions, barème, badges, catégories) : créée si absente ;
 *   les valeurs déjà ajustées par un responsable (points, seuils) ne sont jamais écrasées.
 * - Démonstration (livres, événements, articles…) : marquée `isDemo`, supprimable par `pnpm db:clear-demo`.
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
 * Contenus réels du club (docs/CONTENUS-CLUB.md) : jamais marqués `isDemo`, jamais écrasés
 * par un nouveau passage du seed, et conservés par `pnpm db:clear-demo`.
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
      isDemo: false,
    },
  });
}

/** Démonstration d'avant les contenus officiels (rencontres antérieures au lancement) : retirée. */
const obsoleteDemoSlugs = [
  "rencontre-une-si-longue-lettre",
  "tournoi-amical-novembre",
  "debat-lire-pour-reussir",
  "atelier-critique-200-mots",
];

const articleBodies: Record<string, string> = {
  "pourquoi-commencer-par-mariama-ba":
    "Le livre tient en moins de deux cents pages et se trouve dans presque toutes les bibliothèques de Dakar. Chacun peut donc arriver à la rencontre en l’ayant lu, ou au moins commencé.\n\nSurtout, il divise. Ramatoulaye a-t-elle raison de rester ? Aïssatou a-t-elle raison de partir ? Nous n’attendons pas de réponse commune : seulement que chacun vienne avec la sienne, et l’envie d’écouter celle des autres.",
  "mot-de-la-semaine-palabre":
    "Le mot vient de l’espagnol « palabra », la parole. Sous l’arbre à palabres, on ne bavarde pas : on prend le temps qu’il faut pour qu’un désaccord trouve son issue, et que chacun reparte en ayant été entendu.\n\nAu Scrabble, il vaut onze points sans case bonus. Dans un débat, il vaut bien davantage.",
  "duplicate-ou-classique":
    "La partie classique ressemble à celle que l’on joue en famille : deux joueurs, chacun son tirage, et une part de chance que l’on apprend à apprivoiser.\n\nLe duplicate retire le hasard. Tous les joueurs reçoivent le même tirage et cherchent, en même temps, le meilleur coup possible. C’est le format de nos tournois, parce qu’on peut y jouer à trente et que chacun progresse à son rythme.",
};

/** Demandes d'adhésion fictives : de quoi essayer la validation dans l'administration. */
const demoRequests = [
  {
    firstName: "Awa",
    lastName: "Démonstration",
    email: "awa.demonstration@demo.agora.test",
    phone: "+221770000001",
    ageRange: "FROM_18_TO_25" as const,
    occupation: "STUDENT" as const,
    interests: ["READING" as const, "DEBATES" as const],
    motivation: "Je lis beaucoup, mais toujours seule. J’aimerais en parler avec d’autres.",
  },
  {
    firstName: "Ibrahima",
    lastName: "Démonstration",
    email: "ibrahima.demonstration@demo.agora.test",
    phone: "+221770000002",
    ageRange: "FROM_15_TO_17" as const,
    occupation: "PUPIL" as const,
    interests: ["SCRABBLE" as const],
    motivation: "Je joue au Scrabble en famille et je voudrais essayer le duplicate.",
    guardianName: "Parent Démonstration",
    guardianPhone: "+221770000003",
  },
  {
    firstName: "Coumba",
    lastName: "Démonstration",
    email: "coumba.demonstration@demo.agora.test",
    phone: null,
    ageRange: "FROM_26_TO_35" as const,
    occupation: "WORKER" as const,
    interests: ["READING" as const, "GENIES_DU_SOIR" as const, "AGORA_CINE" as const],
    motivation: null,
  },
];

async function seedDemoQuiz() {
  const event = await prisma.event.findUnique({ where: { slug: "genies-du-soir-fevrier" } });
  // Créé une seule fois : un quiz déjà joué n'est jamais réécrit.
  await prisma.quiz.upsert({
    where: { slug: demoQuiz.slug },
    update: {},
    create: {
      slug: demoQuiz.slug,
      title: demoQuiz.title,
      instructions: demoQuiz.instructions,
      durationMinutes: demoQuiz.durationMinutes,
      opensAt: new Date("2026-11-14T00:00:00Z"),
      closesAt: event?.endsAt ?? new Date("2027-02-20T18:00:00Z"),
      status: "PUBLISHED",
      publishedAt: new Date("2026-11-14T00:00:00Z"),
      eventId: event?.id,
      isDemo: true,
      questions: {
        create: demoQuiz.questions.map((question, position) => ({
          prompt: question.prompt,
          position,
          choices: {
            create: question.choices.map((label, index) => ({
              label,
              position: index,
              isCorrect: index === question.correct,
            })),
          },
        })),
      },
    },
  });
}

async function seedDemo() {
  await prisma.tournament.deleteMany({ where: { isDemo: true, slug: { in: obsoleteDemoSlugs } } });
  await prisma.event.deleteMany({ where: { isDemo: true, slug: { in: obsoleteDemoSlugs } } });

  const categoryByName = new Map(
    (await prisma.category.findMany()).map((category) => [category.name, category.id]),
  );

  for (const book of books) {
    const authorSlug = slugify(book.author);
    const author = await prisma.author.upsert({
      where: { slug: authorSlug },
      update: {},
      create: { slug: authorSlug, name: book.author, isDemo: true },
    });
    const isMonthly = book.slug === bookOfTheMonth.book.slug;
    const data = {
      title: book.title,
      summary: isMonthly ? bookOfTheMonth.pitch : book.note,
      clubNote: book.note,
      publishedYear: book.year,
      isClubFavorite: isMonthly,
      categoryId: categoryByName.get(book.category)!,
      isDemo: true,
    };
    await prisma.book.upsert({
      where: { slug: book.slug },
      update: {},
      create: { slug: book.slug, ...data, authors: { connect: { id: author.id } } },
    });
  }

  for (const event of events) {
    await prisma.event.upsert({
      where: { slug: event.slug },
      update: {},
      create: {
        slug: event.slug,
        title: event.title,
        type: event.type,
        status: "PUBLISHED",
        summary: event.summary,
        description: event.description,
        // Lieu des rencontres : non communiqué par le club.
        location: null,
        // Les heures de démonstration sont exprimées à l'heure de Dakar (UTC+0).
        startsAt: new Date(`${event.iso}:00Z`),
        endsAt: new Date(new Date(`${event.iso}:00Z`).getTime() + 2 * 60 * 60 * 1000),
        capacity: 30,
        isPublic: event.open,
        publishedAt: new Date("2026-11-12T09:00:00Z"),
        isDemo: true,
      },
    });
  }

  const monthlyBook = await prisma.book.findUniqueOrThrow({
    where: { slug: bookOfTheMonth.book.slug },
  });
  const meeting = await prisma.event.findUnique({ where: { slug: bookOfTheMonth.meetingSlug } });
  const month = new Date(`${bookOfTheMonth.month}T00:00:00Z`);
  const selection = await prisma.monthlySelection.upsert({
    where: { month },
    update: {},
    create: { month, bookId: monthlyBook.id, eventId: meeting?.id, isDemo: true },
  });
  // La sélection de démonstration suit le rendez-vous lecture de démonstration.
  if (selection.isDemo && meeting && selection.eventId !== meeting.id) {
    await prisma.monthlySelection.update({
      where: { id: selection.id },
      data: { eventId: meeting.id },
    });
  }

  const tournamentEvent = await prisma.event.findUnique({
    where: { slug: "tournoi-de-scrabble-mars" },
  });
  await prisma.tournament.upsert({
    where: { slug: "tournoi-de-scrabble-mars" },
    update: {},
    create: {
      slug: "tournoi-de-scrabble-mars",
      name: "Tournoi de Scrabble de mars",
      description: "Compétition individuelle, comptée pour le classement mensuel.",
      format: "INDIVIDUAL",
      gameMode: "DUPLICATE",
      rankingRule: "CUMULATIVE_SCORE",
      status: "REGISTRATION_OPEN",
      startsAt: tournamentEvent?.startsAt ?? new Date("2027-03-06T16:00:00Z"),
      eventId: tournamentEvent?.id,
      isDemo: true,
    },
  });
  await seedDemoTournamentResults("tournoi-de-scrabble-mars");

  for (const request of demoRequests) {
    const known = await prisma.membershipRequest.findFirst({ where: { email: request.email } });
    if (!known) {
      await prisma.membershipRequest.create({
        data: { ...request, consentAt: new Date("2026-11-10T10:00:00Z"), isDemo: true },
      });
    }
  }

  for (const article of articles) {
    await prisma.article.upsert({
      where: { slug: article.slug },
      update: {},
      create: {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        content: articleBodies[article.slug] ?? article.excerpt,
        category: article.category,
        status: "PUBLISHED",
        publishedAt: new Date(`${article.iso}T09:00:00Z`),
        isDemo: true,
      },
    });
  }

  await seedDemoQuiz();
}

async function main() {
  await seedAccessControl();
  await seedReference();
  await seedClub();
  await seedDemo();
  const [
    roles,
    permissions,
    rules,
    badgeCount,
    categoryCount,
    bookCount,
    eventCount,
    articleCount,
    levelCount,
    quizCount,
  ] = await Promise.all([
    prisma.role.count(),
    prisma.permission.count(),
    prisma.pointRule.count(),
    prisma.badge.count(),
    prisma.category.count(),
    prisma.book.count({ where: { isDemo: true } }),
    prisma.event.count({ where: { isDemo: true } }),
    prisma.article.count({ where: { isDemo: true } }),
    prisma.level.count(),
    prisma.quiz.count({ where: { isDemo: true } }),
  ]);
  console.log(
    `Seed terminé : ${roles} rôles, ${permissions} permissions, ${rules} règles de points, ${badgeCount} badges, ${levelCount} niveaux, ${categoryCount} catégories ; démonstration : ${bookCount} livres, ${eventCount} événements, ${articleCount} articles, ${quizCount} quiz.`,
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

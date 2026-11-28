import "dotenv/config";
import { createPendingUser, sendActivationEmail } from "@/features/auth/service";
import type { RoleCode } from "@/lib/permissions/catalog";
import { prisma } from "@/lib/prisma";

// Comptes de test des parcours Playwright.
//   tsx e2e/support/test-user.ts create <email> <prénom> [rôle]
//     Crée un compte en attente d'activation, comme le fera la validation d'une adhésion (phase 3),
//     et envoie le vrai e-mail d'activation (lu ensuite dans Mailpit par le test).
//   tsx e2e/support/test-user.ts member-number <email>
//     Donne un numéro de membre au compte (comme la validation d'une adhésion).
//   tsx e2e/support/test-user.ts pay-card <email>
//     Enregistre la carte de membre comme réglée.
//   tsx e2e/support/test-user.ts delete-events E2E-<début du titre>
//     Supprime les rencontres de test dont le titre commence ainsi.
//   tsx e2e/support/test-user.ts delete-committee E2E-<début du nom>
//     Retire du comité les membres de test dont le nom commence ainsi.
//   tsx e2e/support/test-user.ts create-content E2E-<préfixe>
//     Crée un livre visible et un article publié, titrés « <préfixe> Livre » et « <préfixe> Article ».
//   tsx e2e/support/test-user.ts delete-content E2E-<début du titre>
//     Supprime les livres, auteurs et articles de test dont le titre ou le nom commence ainsi.
//   tsx e2e/support/test-user.ts delete-tournaments E2E-<début du nom>
//     Supprime les tournois de test (parties d'abord : elles retiennent les joueurs).
//   tsx e2e/support/test-user.ts delete-quizzes E2E-<début du titre>
//     Supprime les quiz de test (tentatives d'abord : elles retiennent le quiz).
//   tsx e2e/support/test-user.ts delete-contact E2E-<début de l'objet>
//     Supprime les messages de contact de test dont l'objet commence ainsi.
//   tsx e2e/support/test-user.ts create-genies-rule E2E
//     Règle d'essai « Génies du soir » (10 points), si le barème n'en a pas : le barème du club n'en
//     a pas, et une rencontre lecture + quiz doit pouvoir prouver que chaque activité paie.
//   tsx e2e/support/test-user.ts delete-genies-rule E2E
//     Retire cette règle d'essai (et seulement elle), ainsi que les points qu'elle a payés.
//   tsx e2e/support/test-user.ts get-attendance-mode E2E
//     Affiche la règle des points de présence enregistrée (ALL_ACTIVITIES, PRIMARY_ONLY) ou « none ».
//   tsx e2e/support/test-user.ts set-attendance-mode E2E <ALL_ACTIVITIES|PRIMARY_ONLY|none>
//     La remet telle qu'elle était avant le parcours (« none » : aucun réglage enregistré).
//   tsx e2e/support/test-user.ts accept <email> <jours>
//     Adhésion acceptée il y a <jours> jours (comme une validation), pour le délai de la carte.
//   tsx e2e/support/test-user.ts get-payment-settings E2E
//     Affiche, en JSON, les réglages des paiements à distance (numéros, délai, masquage visio).
//   tsx e2e/support/test-user.ts set-payment-settings E2E '<json>'
//     Les remet tels qu'ils étaient (une clé absente du JSON est supprimée).
//   tsx e2e/support/test-user.ts delete <email>
//     Supprime le compte de test, sa demande d'adhésion, ses adhésions et ses encaissements.
/** Réglages des paiements à distance, sauvegardés puis restaurés par e2e/carte-a-distance.spec.ts. */
const PAYMENT_SETTING_KEYS = [
  "payments.waveNumber",
  "payments.orangeMoneyNumber",
  "membership.cardGraceDays",
  "events.hideVideoWhenCardUnpaid",
];

/** Code de la règle d'essai : jamais une règle du barème du club. */
const E2E_GENIES_RULE = "e2e_genies_du_soir";

async function main() {
  const [command, email, firstName, role = "member"] = process.argv.slice(2);
  if (
    !command?.startsWith("delete-") &&
    command !== "create-content" &&
    command !== "create-genies-rule" &&
    command !== "get-attendance-mode" &&
    command !== "set-attendance-mode" &&
    command !== "get-payment-settings" &&
    command !== "set-payment-settings" &&
    !email?.endsWith("@e2e.agora.test")
  ) {
    throw new Error("Par sécurité, ce script n’agit que sur des adresses @e2e.agora.test.");
  }
  if (command === "create" && firstName) {
    const user = await createPendingUser(
      { firstName, lastName: "Essai", email, roles: [role as RoleCode], isDemo: true },
      null,
    );
    await sendActivationEmail(user.id, null);
  } else if (command === "delete") {
    // Tout ce qui retient le compte (encaissements, adhésions, demande) part avant lui.
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      await prisma.payment.deleteMany({
        where: { OR: [{ userId: user.id }, { receivedById: user.id }, { cancelledById: user.id }] },
      });
      await prisma.membership.deleteMany({ where: { userId: user.id } });
      // Points (corrections d'abord : elles retiennent la ligne corrigée), badges, lectures, critiques.
      await prisma.pointTransaction.deleteMany({
        where: { userId: user.id, reversesId: { not: null } },
      });
      await prisma.pointTransaction.deleteMany({ where: { userId: user.id } });
      await prisma.userBadge.deleteMany({ where: { userId: user.id } });
      await prisma.review.deleteMany({ where: { userId: user.id } });
      await prisma.quizAttempt.deleteMany({ where: { userId: user.id } });
      await prisma.match.deleteMany({
        where: {
          OR: [{ participantA: { userId: user.id } }, { participantB: { userId: user.id } }],
        },
      });
      await prisma.tournamentParticipant.deleteMany({ where: { userId: user.id } });
      await prisma.reading.deleteMany({ where: { userId: user.id } });
    }
    await prisma.membershipRequest.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email } });
  } else if (command === "member-number") {
    // Numéro de membre, comme après la validation d'une adhésion : condition des points.
    await prisma.user.update({
      where: { email },
      data: { memberNumber: `E2E-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}` },
    });
  } else if (command === "pay-card") {
    // Carte de membre encaissée (comme le ferait un responsable depuis l'administration).
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    await prisma.payment.create({
      data: { kind: "MEMBERSHIP_CARD", amount: 1000, userId: user.id, paidAt: new Date() },
    });
  } else if (command === "create-genies-rule" && email === "E2E") {
    const existing = await prisma.pointRule.findUnique({ where: { eventType: "GENIES_DU_SOIR" } });
    if (!existing) {
      await prisma.pointRule.create({
        data: {
          code: E2E_GENIES_RULE,
          label: "E2E Participer aux Génies du soir",
          points: 10,
          eventType: "GENIES_DU_SOIR",
        },
      });
    }
  } else if (command === "delete-genies-rule" && email === "E2E") {
    const rule = await prisma.pointRule.findUnique({ where: { code: E2E_GENIES_RULE } });
    if (rule) {
      const lines = await prisma.pointTransaction.findMany({
        where: { ruleId: rule.id },
        select: { id: true },
      });
      await prisma.pointTransaction.deleteMany({
        where: { sourceType: "CORRECTION", sourceId: { in: lines.map((l) => l.id) } },
      });
      await prisma.pointTransaction.deleteMany({ where: { ruleId: rule.id } });
      await prisma.pointRule.delete({ where: { id: rule.id } });
    }
  } else if (command === "accept" && firstName) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } });
    const startsAt = new Date(Date.now() - Number(firstName) * 24 * 60 * 60 * 1000);
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.membership.create({
      data: {
        userId: user.id,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000),
      },
    });
  } else if (command === "get-payment-settings" && email === "E2E") {
    const rows = await prisma.setting.findMany({ where: { key: { in: PAYMENT_SETTING_KEYS } } });
    process.stdout.write(JSON.stringify(Object.fromEntries(rows.map((r) => [r.key, r.value]))));
  } else if (command === "set-payment-settings" && email === "E2E" && firstName) {
    const saved = JSON.parse(firstName) as Record<string, unknown>;
    for (const key of PAYMENT_SETTING_KEYS) {
      if (key in saved) {
        const value = saved[key] as never;
        await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
      } else {
        await prisma.setting.deleteMany({ where: { key } });
      }
    }
  } else if (command === "get-attendance-mode" && email === "E2E") {
    const row = await prisma.setting.findUnique({ where: { key: "points.attendance" } });
    const mode = (row?.value as { mode?: string } | null)?.mode;
    process.stdout.write(mode ?? "none");
  } else if (command === "set-attendance-mode" && email === "E2E") {
    const mode = firstName;
    if (mode === "none") {
      await prisma.setting.deleteMany({ where: { key: "points.attendance" } });
    } else if (mode === "ALL_ACTIVITIES" || mode === "PRIMARY_ONLY") {
      await prisma.setting.upsert({
        where: { key: "points.attendance" },
        update: { value: { mode } },
        create: { key: "points.attendance", value: { mode } },
      });
    } else {
      throw new Error(`Règle inconnue : ${mode}`);
    }
  } else if (command === "delete-events" && email?.startsWith("E2E-")) {
    // Rencontres créées par un parcours (titre « E2E-… ») : encaissements, puis inscriptions en cascade.
    const where = { title: { startsWith: email } };
    await prisma.payment.deleteMany({ where: { event: where } });
    await prisma.event.deleteMany({ where });
  } else if (command === "delete-committee" && email?.startsWith("E2E-")) {
    await prisma.committeeMember.deleteMany({ where: { name: { startsWith: email } } });
  } else if (command === "create-content" && email?.startsWith("E2E-")) {
    // Un livre visible et un article publié : le parcours public ne dépend plus d'aucun contenu
    // préexistant (le seed n'en crée plus). Retirés ensuite par `delete-content` avec le même préfixe.
    const prefix = email;
    const slug = prefix
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const category = await prisma.category.findFirstOrThrow({ orderBy: { position: "asc" } });
    await prisma.book.create({
      data: {
        slug: `${slug}-livre`,
        title: `${prefix} Livre`,
        summary: "Un résumé de test, rédigé pour le club.",
        categoryId: category.id,
        isPublished: true,
        authors: { create: { slug: `${slug}-auteur`, name: `${prefix} Auteur` } },
      },
    });
    await prisma.article.create({
      data: {
        slug: `${slug}-article`,
        title: `${prefix} Article`,
        excerpt: "Un article de test.",
        content: "Le contenu d’un article de test.",
        category: "Compte rendu",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });
  } else if (command === "delete-content" && email?.startsWith("E2E-")) {
    await prisma.book.deleteMany({ where: { title: { startsWith: email } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: email } } });
    await prisma.article.deleteMany({ where: { title: { startsWith: email } } });
  } else if (command === "delete-tournaments" && email?.startsWith("E2E-")) {
    const where = { name: { startsWith: email } };
    await prisma.match.deleteMany({ where: { round: { tournament: where } } });
    await prisma.tournament.deleteMany({ where });
  } else if (command === "delete-contact" && email?.startsWith("E2E-")) {
    await prisma.contactMessage.deleteMany({ where: { subject: { startsWith: email } } });
  } else if (command === "delete-quizzes" && email?.startsWith("E2E-")) {
    const where = { title: { startsWith: email } };
    await prisma.quizAttempt.deleteMany({ where: { quiz: where } });
    await prisma.quiz.deleteMany({ where });
  } else {
    throw new Error("Usage : test-user.ts create <email> <prénom> [rôle] | delete <email>");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

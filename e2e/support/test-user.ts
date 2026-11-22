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
//   tsx e2e/support/test-user.ts delete <email>
//     Supprime le compte de test, sa demande d'adhésion, ses adhésions et ses encaissements.
async function main() {
  const [command, email, firstName, role = "member"] = process.argv.slice(2);
  if (
    !command?.startsWith("delete-") &&
    command !== "create-content" &&
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

import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { prisma, type Db, type PrismaClient } from "@/lib/prisma";

/**
 * Données de démonstration : comptage et suppression.
 * Sans dépendance à Next.js : utilisé par l'application et par `pnpm db:clear-demo`.
 */
export async function countDemoData(db: Db = prisma) {
  const [users, requests, authors, books, selections, events, tournaments, articles, quizzes] =
    await Promise.all([
      db.user.count({ where: { isDemo: true } }),
      db.membershipRequest.count({ where: { isDemo: true } }),
      db.author.count({ where: { isDemo: true } }),
      db.book.count({ where: { isDemo: true } }),
      db.monthlySelection.count({ where: { isDemo: true } }),
      db.event.count({ where: { isDemo: true } }),
      db.tournament.count({ where: { isDemo: true } }),
      db.article.count({ where: { isDemo: true } }),
      db.quiz.count({ where: { isDemo: true } }),
    ]);
  return { users, requests, authors, books, selections, events, tournaments, articles, quizzes };
}

export type DemoCounts = Awaited<ReturnType<typeof countDemoData>>;

const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

/**
 * Points gagnés sur un objet de démonstration, y compris par un vrai membre (quiz de démonstration
 * joué, présence à une rencontre fictive) : ils disparaissent avec l'objet.
 * Convention des sources (docs/DECISIONS.md, section 10) : présence → inscription ; lecture → lecture ;
 * critique → critique ; tournoi → tournoi ; quiz → quiz.
 */
async function demoPointSources(db: Db): Promise<Prisma.PointTransactionWhereInput[]> {
  const [registrations, readings, reviews, tournaments, quizzes] = await Promise.all([
    db.eventRegistration.findMany({ where: { event: { isDemo: true } }, select: { id: true } }),
    db.reading.findMany({ where: { book: { isDemo: true } }, select: { id: true } }),
    db.review.findMany({ where: { book: { isDemo: true } }, select: { id: true } }),
    db.tournament.findMany({ where: { isDemo: true }, select: { id: true } }),
    db.quiz.findMany({ where: { isDemo: true }, select: { id: true } }),
  ]);
  const sources: [Prisma.PointTransactionWhereInput["sourceType"], string[]][] = [
    ["EVENT_ATTENDANCE", ids(registrations)],
    ["READING", ids(readings)],
    ["REVIEW", ids(reviews)],
    ["TOURNAMENT", ids(tournaments)],
    ["QUIZ", ids(quizzes)],
  ];
  return sources
    .filter(([, list]) => list.length > 0)
    .map(([sourceType, list]) => ({ sourceType, sourceId: { in: list } }));
}

/**
 * Supprime toutes les lignes `isDemo` et ce qui en dépend, en une transaction.
 * Les données de référence (rôles, permissions, barème, badges, niveaux, catégories) sont conservées.
 */
export async function clearDemoData(client: PrismaClient = prisma): Promise<DemoCounts> {
  return client.$transaction(async (tx) => {
    const counts = await countDemoData(tx);
    const demoBook = { book: { isDemo: true } };
    const demoUser = { user: { isDemo: true } };

    // Grand livre : les points liés à un objet ou à un membre de démonstration. Les corrections
    // d'abord (elles référencent la ligne corrigée).
    const sources = await demoPointSources(tx);
    const demoPoints: Prisma.PointTransactionWhereInput = { OR: [demoUser, ...sources] };
    await tx.pointTransaction.deleteMany({ where: { reverses: { is: demoPoints } } });
    await tx.pointTransaction.deleteMany({ where: { ...demoUser, reversesId: { not: null } } });
    await tx.pointTransaction.deleteMany({ where: demoPoints });

    // Quiz : tentatives (réponses en cascade), puis quiz (questions et propositions en cascade).
    await tx.quizAttempt.deleteMany({ where: { OR: [{ quiz: { isDemo: true } }, demoUser] } });
    await tx.quiz.deleteMany({ where: { isDemo: true } });

    // Encaissements de démonstration (séances ou membres fictifs) : ils bloqueraient la suppression.
    await tx.payment.deleteMany({
      where: { OR: [{ event: { isDemo: true } }, { user: { isDemo: true } }] },
    });
    await tx.scrabbleRecord.deleteMany({ where: { isDemo: true } });
    await tx.monthlySelection.deleteMany({ where: { OR: [{ isDemo: true }, demoBook] } });
    // Les parties d'abord : elles retiennent leurs joueurs (`Restrict`), la cascade échouerait.
    await tx.match.deleteMany({ where: { round: { tournament: { isDemo: true } } } });
    // Participants, équipes, manches et scores partent en cascade.
    await tx.tournament.deleteMany({ where: { isDemo: true } });
    // Les inscriptions partent en cascade.
    await tx.event.deleteMany({ where: { isDemo: true } });
    await tx.article.deleteMany({ where: { isDemo: true } });

    await tx.reading.deleteMany({ where: demoBook });
    await tx.review.deleteMany({ where: demoBook });
    await tx.book.deleteMany({ where: { isDemo: true } });
    // Un auteur de démonstration auquel un vrai livre a été rattaché est conservé.
    await tx.author.deleteMany({ where: { isDemo: true, books: { none: {} } } });

    await tx.membershipRequest.deleteMany({ where: { isDemo: true } });
    await tx.membership.deleteMany({ where: demoUser });
    await tx.tournamentParticipant.deleteMany({ where: demoUser });
    // Lectures, critiques, badges, notifications et inscriptions des membres fictifs : en cascade.
    await tx.user.deleteMany({ where: { isDemo: true } });

    await audit(
      { actorId: null, action: "demo.cleared", entityType: "Demo", metadata: counts },
      tx,
    );
    return counts;
  });
}

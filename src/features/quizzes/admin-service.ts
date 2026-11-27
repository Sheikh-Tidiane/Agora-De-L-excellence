import type { Tx } from "@/features/gamification/ledger";
import { runInTransaction } from "@/features/gamification/ledger";
import { createBulkNotifications } from "@/features/notifications/service";
import { lockQuiz } from "@/features/quizzes/attempt-core";
import { questionProblem, QUIZ_LIMITS } from "@/features/quizzes/rules";
import type { QuizSettingsData } from "@/features/quizzes/schemas";
import { audit } from "@/lib/audit";
import { formatDateTime, toLocalDateTime } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { prisma, type Db } from "@/lib/prisma";
import { uniqueSlug } from "@/lib/slug";

/**
 * Administration des quiz (`quizzes.manage`).
 * - Brouillon : tout se modifie (réglages, questions, propositions).
 * - Publié ou clos : seuls le titre, la consigne, la rencontre liée et (publié seulement) la
 *   fermeture se modifient ; durée, ouverture, adresse et questions sont figées. Un quiz publié
 *   que personne n'a encore joué peut repasser en brouillon pour tout modifier.
 * - Un quiz joué ne se supprime jamais : il se clôt, puis s'archive.
 */

export const memberHref = (slug: string) => `/member/quiz/${slug}`;

export async function loadLocked(tx: Tx, quizId: string) {
  if (!(await lockQuiz(tx, quizId, "UPDATE"))) throw new AppError("NOT_FOUND", "Quiz introuvable.");
  return tx.quiz.findUniqueOrThrow({
    where: { id: quizId },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      durationMinutes: true,
      archivedAt: true,
      publishedAt: true,
      _count: { select: { attempts: true } },
    },
  });
}

/** Rencontre liée : non archivée, avec les Génies du soir parmi ses activités. */
async function checkEvent(db: Db, eventId: string | null): Promise<void> {
  if (!eventId) return;
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { activities: true, archivedAt: true },
  });
  if (!event || event.archivedAt || !event.activities.includes("GENIES_DU_SOIR")) {
    throw new AppError("VALIDATION", undefined, {
      fieldErrors: {
        eventId: "Choisissez une rencontre qui compte les Génies du soir parmi ses activités.",
      },
    });
  }
}

async function resolveSlug(
  db: Db,
  data: QuizSettingsData,
  currentId: string | null,
): Promise<string> {
  const taken = async (slug: string) => {
    const row = await db.quiz.findUnique({ where: { slug }, select: { id: true } });
    return row !== null && row.id !== currentId;
  };
  if (data.slug) {
    if (await taken(data.slug)) {
      throw new AppError("VALIDATION", undefined, {
        fieldErrors: { slug: "Cette adresse est déjà utilisée par un autre quiz." },
      });
    }
    return data.slug;
  }
  return uniqueSlug(data.title, taken, "quiz");
}

export async function createQuiz(
  data: QuizSettingsData,
  actorId: string,
  db: Db = prisma,
): Promise<{ id: string; slug: string }> {
  await checkEvent(db, data.eventId);
  const slug = await resolveSlug(db, data, null);
  return db.quiz.create({
    data: {
      slug,
      title: data.title,
      instructions: data.instructions,
      durationMinutes: data.durationMinutes,
      opensAt: data.opensAt,
      closesAt: data.closesAt,
      eventId: data.eventId,
      createdById: actorId,
    },
    select: { id: true, slug: true },
  });
}

const sameMinute = (a: Date, b: Date) => toLocalDateTime(a) === toLocalDateTime(b);

export async function updateQuiz(
  quizId: string,
  data: QuizSettingsData,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ slug: string }> {
  return runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz.archivedAt) throw new AppError("CONFLICT", "Ce quiz est archivé.");
    await checkEvent(tx, data.eventId);
    if (quiz.status === "DRAFT") {
      const slug = data.slug ? await resolveSlug(tx, data, quizId) : quiz.slug;
      await tx.quiz.update({
        where: { id: quizId },
        data: {
          slug,
          title: data.title,
          instructions: data.instructions,
          durationMinutes: data.durationMinutes,
          opensAt: data.opensAt,
          closesAt: data.closesAt,
          eventId: data.eventId,
        },
      });
      return { slug };
    }
    const frozen =
      data.durationMinutes !== quiz.durationMinutes ||
      !sameMinute(data.opensAt, quiz.opensAt) ||
      (data.slug !== null && data.slug !== quiz.slug) ||
      (quiz.status === "CLOSED" && !sameMinute(data.closesAt, quiz.closesAt));
    if (frozen) {
      throw new AppError(
        "CONFLICT",
        quiz._count.attempts === 0 && quiz.status === "PUBLISHED"
          ? "Après publication, seuls le titre, la consigne, la rencontre liée et la fermeture se modifient. Repassez le quiz en brouillon pour le reste."
          : "Ce quiz a déjà été joué : seuls le titre, la consigne, la rencontre liée et la fermeture se modifient.",
      );
    }
    const closesChanged = !sameMinute(data.closesAt, quiz.closesAt);
    // Fermeture passée : le corrigé est déjà visible des joueurs. Rouvrir le quiz laisserait
    // jouer, corrigé en main, ceux qui ne l'ont pas encore fait.
    if (closesChanged && quiz.closesAt <= now) {
      throw new AppError(
        "CONFLICT",
        "Ce quiz est terminé et son corrigé est visible : il ne se rouvre pas.",
      );
    }
    if (closesChanged && data.closesAt <= now) {
      throw new AppError("VALIDATION", undefined, {
        fieldErrors: {
          closesAt:
            "La nouvelle fermeture doit être dans le futur. Pour arrêter le quiz, closez-le.",
        },
      });
    }
    await tx.quiz.update({
      where: { id: quizId },
      data: {
        title: data.title,
        instructions: data.instructions,
        eventId: data.eventId,
        ...(closesChanged ? { closesAt: data.closesAt } : {}),
      },
    });
    return { slug: quiz.slug };
  });
}

/** Problèmes qui empêchent la publication (liste vide : publiable). */
export async function publicationProblems(db: Db, quizId: string, now: Date): Promise<string[]> {
  const quiz = await db.quiz.findUniqueOrThrow({
    where: { id: quizId },
    select: {
      closesAt: true,
      questions: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        select: { prompt: true, choices: { select: { label: true, isCorrect: true } } },
      },
    },
  });
  const problems: string[] = [];
  if (quiz.questions.length === 0) problems.push("Ajoutez au moins une question.");
  if (quiz.questions.length > QUIZ_LIMITS.maxQuestions) problems.push("Pas plus de 50 questions.");
  quiz.questions.forEach((question, index) => {
    const problem = questionProblem(question);
    if (problem) problems.push(`Question ${index + 1} : ${problem}`);
  });
  if (quiz.closesAt <= now) problems.push("La fermeture est déjà passée : reportez-la.");
  return problems;
}

/** Publie un brouillon ; à la première publication, prévient les membres actifs (in-app). */
export async function publishQuiz(
  quizId: string,
  actorId: string,
  now: Date = new Date(),
  db: Db = prisma,
): Promise<{ notified: number }> {
  return runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz.archivedAt || quiz.status !== "DRAFT") {
      throw new AppError("CONFLICT", "Seul un brouillon se publie.");
    }
    const problems = await publicationProblems(tx, quizId, now);
    if (problems.length > 0) throw new AppError("CONFLICT", problems.join(" "));
    const firstTime = quiz.publishedAt === null;
    await tx.quiz.update({
      where: { id: quizId },
      data: { status: "PUBLISHED", publishedAt: quiz.publishedAt ?? now },
    });
    let notified = 0;
    if (firstTime) {
      const members = await tx.user.findMany({
        where: { status: "ACTIVE", memberNumber: { not: null }, archivedAt: null },
        select: { id: true },
      });
      const body =
        quiz.opensAt > now
          ? `Il ouvre le ${formatDateTime(quiz.opensAt)}. ${quiz.durationMinutes} minutes, une seule tentative.`
          : `À jouer jusqu’au ${formatDateTime(quiz.closesAt)}. ${quiz.durationMinutes} minutes, une seule tentative.`;
      notified = await createBulkNotifications(
        members.map((member) => ({
          userId: member.id,
          type: "quiz.published" as const,
          title: `Nouveau quiz : ${quiz.title}`,
          body,
          href: memberHref(quiz.slug),
        })),
        tx,
      );
    }
    await audit(
      {
        actorId,
        action: "quiz.published",
        entityType: "Quiz",
        entityId: quizId,
        metadata: { slug: quiz.slug, notified, republished: !firstTime },
      },
      tx,
    );
    return { notified };
  });
}

/** Repasse en brouillon un quiz publié que personne n'a joué (sans nouvelle notification ensuite). */
export async function unpublishQuiz(
  quizId: string,
  actorId: string,
  db: Db = prisma,
): Promise<void> {
  await runInTransaction(db, async (tx) => {
    const quiz = await loadLocked(tx, quizId);
    if (quiz.status !== "PUBLISHED" || quiz.archivedAt) {
      throw new AppError("CONFLICT", "Seul un quiz publié repasse en brouillon.");
    }
    if (quiz._count.attempts > 0) {
      throw new AppError("CONFLICT", "Ce quiz a déjà été joué : il ne repasse plus en brouillon.");
    }
    await tx.quiz.update({ where: { id: quizId }, data: { status: "DRAFT" } });
    await audit({ actorId, action: "quiz.unpublished", entityType: "Quiz", entityId: quizId }, tx);
  });
}

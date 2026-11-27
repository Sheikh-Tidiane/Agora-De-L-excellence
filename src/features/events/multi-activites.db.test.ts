import { afterAll, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Rencontres à plusieurs activités, sur la vraie base : liens d'un quiz (Génies du soir) et d'un
 * tournoi (Scrabble) quand l'activité est secondaire, et refus de retirer l'activité qui justifie
 * un lien. Les tests créent leurs propres lignes et les suppriment.
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const { listGeniesEvents } = await import("@/features/quizzes/admin-queries");
const { readLinkableEvents } = await import("@/features/scrabble/admin-read");
const { updateEvent } = await import("@/features/events/service");
const { eventSchema } = await import("@/features/events/schemas");

const reachable = await databaseReachable();

describe.skipIf(!reachable)("rencontres à plusieurs activités (base réelle)", () => {
  const tag = uniq();
  const events: string[] = [];
  const quizzes: string[] = [];
  const tournaments: string[] = [];

  const event = async (type: string, activities: string[]) => {
    const created = await db.event.create({
      data: {
        slug: `vt-multi-${events.length}-${tag}`,
        title: `Rencontre ${tag}`,
        type: type as never,
        activities: activities as never,
        description: "Test",
        startsAt: new Date(Date.now() + 86_400_000),
        status: "PUBLISHED",
        isDemo: true,
      },
    });
    events.push(created.id);
    return created;
  };

  const form = (type: string, activities: string[]) =>
    eventSchema.parse({
      title: `Rencontre ${tag}`,
      type,
      activities,
      summary: "",
      description: "Une description assez longue.",
      location: "",
      isTentative: false,
      program: "",
      speakerName: "",
      speakerTitle: "",
      speakerMode: "",
      videoLink: "",
      startsAt: "2027-02-06T16:00",
      endsAt: "",
      capacity: "",
      isPublic: false,
      cancellationDeadlineHours: "",
    });

  afterAll(async () => {
    await db.quiz.deleteMany({ where: { id: { in: quizzes } } });
    await db.tournament.deleteMany({ where: { id: { in: tournaments } } });
    await db.event.deleteMany({ where: { id: { in: events } } });
    await db.$disconnect();
  });

  it("un quiz se lie à une rencontre où les Génies du soir sont une activité secondaire", async () => {
    const lectureQuiz = await event("RENDEZ_VOUS_LECTURE", [
      "RENDEZ_VOUS_LECTURE",
      "GENIES_DU_SOIR",
    ]);
    const lectureSeule = await event("RENDEZ_VOUS_LECTURE", ["RENDEZ_VOUS_LECTURE"]);
    const ids = (await listGeniesEvents()).map((e) => e.id);
    expect(ids).toContain(lectureQuiz.id);
    expect(ids).not.toContain(lectureSeule.id);
  });

  it("un tournoi se lie à une rencontre où le Scrabble est une activité secondaire", async () => {
    const debatScrabble = await event("DEBAT_IDEES", ["DEBAT_IDEES", "INITIATION_SCRABBLE"]);
    const debatSeul = await event("DEBAT_IDEES", ["DEBAT_IDEES"]);
    const ids = (await readLinkableEvents(null)).map((e) => e.id);
    expect(ids).toContain(debatScrabble.id);
    expect(ids).not.toContain(debatSeul.id);
  });

  it("modifier une rencontre : l'activité qui justifie un quiz ou un tournoi lié ne se retire pas", async () => {
    const withQuiz = await event("RENDEZ_VOUS_LECTURE", ["RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"]);
    const quiz = await db.quiz.create({
      data: {
        slug: `vt-multi-quiz-${tag}`,
        title: "Quiz",
        durationMinutes: 10,
        opensAt: new Date(),
        closesAt: new Date(Date.now() + 3_600_000),
        eventId: withQuiz.id,
        isDemo: true,
      },
    });
    quizzes.push(quiz.id);
    await expect(
      updateEvent(withQuiz.id, form("RENDEZ_VOUS_LECTURE", ["RENDEZ_VOUS_LECTURE"])),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Ajouter une activité reste permis, les Génies du soir gardés.
    await updateEvent(
      withQuiz.id,
      form("GENIES_DU_SOIR", ["GENIES_DU_SOIR", "RENDEZ_VOUS_LECTURE", "AGORA_CINE"]),
    );
    expect(await db.event.findUniqueOrThrow({ where: { id: withQuiz.id } })).toMatchObject({
      type: "GENIES_DU_SOIR",
      activities: ["GENIES_DU_SOIR", "RENDEZ_VOUS_LECTURE", "AGORA_CINE"],
    });

    const withTournament = await event("TOURNOI_SCRABBLE", ["TOURNOI_SCRABBLE", "DEBAT_IDEES"]);
    const tournament = await db.tournament.create({
      data: {
        slug: `vt-multi-tournoi-${tag}`,
        name: "Tournoi",
        startsAt: new Date(Date.now() + 86_400_000),
        eventId: withTournament.id,
        isDemo: true,
      },
    });
    tournaments.push(tournament.id);
    await expect(
      updateEvent(withTournament.id, form("DEBAT_IDEES", ["DEBAT_IDEES"])),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // Passer de tournoi à initiation garde une activité Scrabble : permis.
    await updateEvent(
      withTournament.id,
      form("DEBAT_IDEES", ["DEBAT_IDEES", "INITIATION_SCRABBLE"]),
    );
  });
});

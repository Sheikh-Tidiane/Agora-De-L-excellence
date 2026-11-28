import { afterAll, describe, expect, it, vi } from "vitest";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

/**
 * Statistiques sur la vraie base, avec un jeu de données contrôlé en mars 2001 (aucune autre
 * donnée à cette date) : rencontres comptées ou exclues, inscrits, présents, listes d'attente,
 * nouveaux membres, adhérents à jour et actifs, membres qui ne reviennent plus.
 */
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));

const {
  getEventStats,
  getMemberStats,
  getInactiveMembers,
  getReadingStats,
  getScrabbleStats,
  countRenewals,
} = await import("@/features/stats/queries");
const { parseStatsPeriod } = await import("@/features/stats/rules");

const reachable = await databaseReachable();
const at = (iso: string) => new Date(iso);

describe.skipIf(!reachable)("statistiques (base réelle)", () => {
  const tag = uniq();
  const users: string[] = [];
  const events: string[] = [];
  let n = 0;
  const NOW = at("2001-04-15T12:00:00Z");
  const period = parseStatsPeriod({ du: "2001-03-01", au: "2001-03-31" }, NOW);

  const makeEvent = async (
    data: Partial<{
      status: "PUBLISHED" | "CLOSED" | "CANCELLED" | "DRAFT";
      archivedAt: Date;
      isDemo: boolean;
      capacity: number;
      startsAt: Date;
    }> = {},
  ) => {
    const event = await db.event.create({
      data: {
        slug: `vt-stats-${tag}-${++n}`,
        title: `Stats ${tag} ${n}`,
        type: "RENDEZ_VOUS_LECTURE",
        activities: ["RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"],
        description: "Test",
        startsAt: data.startsAt ?? at("2001-03-10T18:00:00Z"),
        status: data.status ?? "PUBLISHED",
        archivedAt: data.archivedAt,
        isDemo: data.isDemo ?? false,
        capacity: data.capacity,
      },
    });
    events.push(event.id);
    return event;
  };
  const makeMember = async (since: Date, renewed?: Date) => {
    const user = await db.user.create({
      data: {
        firstName: `Stat${++n}`,
        lastName: "Membre",
        name: `Stat${n} Membre`,
        email: `stats-${n}-${tag}@e2e.agora.test`,
        status: "ACTIVE",
        memberNumber: `S-${tag}-${n}`,
      },
    });
    users.push(user.id);
    await db.membership.create({
      data: {
        userId: user.id,
        startsAt: since,
        endsAt: new Date(since.getTime() + 365 * 86_400_000),
      },
    });
    if (renewed) {
      await db.membership.create({
        data: {
          userId: user.id,
          startsAt: renewed,
          endsAt: new Date(renewed.getTime() + 365 * 86_400_000),
        },
      });
    }
    return user;
  };

  const tournaments: string[] = [];
  const books: string[] = [];
  const categories: string[] = [];

  afterAll(async () => {
    await db.tournament.deleteMany({ where: { id: { in: tournaments } } });
    await db.reading.deleteMany({ where: { bookId: { in: books } } });
    await db.book.deleteMany({ where: { id: { in: books } } });
    await db.category.deleteMany({ where: { id: { in: categories } } });
    await db.event.deleteMany({ where: { id: { in: events } } });
    await db.membership.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });

  it("présence, activités, listes d'attente, membres, relances", async () => {
    const [a, b, c] = [
      await makeMember(at("2001-03-02T10:00:00Z")),
      await makeMember(at("2000-06-01T10:00:00Z"), at("2001-03-20T10:00:00Z")),
      await makeMember(at("2001-01-05T10:00:00Z")),
    ];
    const counted = await makeEvent({ capacity: 2 });
    // Exclues : annulée, archivée, démonstration, hors période.
    for (const excluded of [
      await makeEvent({ status: "CANCELLED" }),
      await makeEvent({ archivedAt: NOW }),
      await makeEvent({ isDemo: true }),
      await makeEvent({ startsAt: at("2001-04-02T18:00:00Z") }),
    ]) {
      await db.eventRegistration.create({
        data: {
          eventId: excluded.id,
          userId: a.id,
          status: "CONFIRMED",
          attendedAt: excluded.startsAt,
          checkInMethod: "MANUAL",
        },
      });
    }
    await db.eventRegistration.createMany({
      data: [
        {
          eventId: counted.id,
          userId: a.id,
          status: "CONFIRMED",
          attendedAt: at("2001-03-10T18:05:00Z"),
          checkInMethod: "QR_SCAN",
        },
        {
          eventId: counted.id,
          userId: b.id,
          status: "CONFIRMED",
          waitlistedAt: at("2001-03-01T10:00:00Z"),
          promotedAt: at("2001-03-05T10:00:00Z"),
        },
        {
          eventId: counted.id,
          userId: c.id,
          status: "WAITLISTED",
          waitlistedAt: at("2001-03-02T10:00:00Z"),
        },
        {
          eventId: counted.id,
          guestName: "Invité",
          guestEmail: `stats-invite-${tag}@e2e.agora.test`,
          status: "CANCELLED",
        },
      ],
    });

    const stats = await getEventStats(period, "all", NOW);
    expect(stats.attendance.map((r) => r.id)).toEqual([counted.id]);
    expect(stats.summary).toMatchObject({ events: 1, registered: 2, present: 1, rate: 0.5 });
    expect(stats.byMonth).toEqual([{ month: "2001-03", present: 1, events: 1 }]);
    expect(stats.activities.map((x) => [x.code, x.events, x.present])).toEqual([
      ["GENIES_DU_SOIR", 1, 1],
      ["RENDEZ_VOUS_LECTURE", 1, 1],
    ]);
    expect(stats.waitlists).toMatchObject({ full: 1, waited: 2, promoted: 1, stayed: 1 });
    expect((await getEventStats(period, "primary", NOW)).activities.map((x) => x.code)).toEqual([
      "RENDEZ_VOUS_LECTURE",
    ]);

    const members = await getMemberStats(period, NOW);
    // Nouveaux en mars 2001 : A seulement (B : première adhésion en 2000, renouvelée en mars).
    expect(members.newByMonth).toEqual([{ month: "2001-03", count: 1 }]);
    expect(members.current).toBe(3);
    expect(members.active).toBe(1);

    // Période passée, membre renouvelé depuis (adhésion précédente « EXPIRED ») : toujours compté.
    await db.membership.updateMany({
      where: { userId: b.id, startsAt: at("2000-06-01T10:00:00Z") },
      data: { status: "EXPIRED" },
    });
    expect(
      (await getMemberStats(parseStatsPeriod({ du: "2001-02-01", au: "2001-02-28" }, NOW), NOW))
        .current,
    ).toBeGreaterThanOrEqual(2);

    // Relances au 15 avril 2001 (6 semaines) : B et C jamais venus depuis plus de 6 semaines ;
    // A est venu le 2 avril (rencontre hors période, mais présence réelle).
    const inactive = (await getInactiveMembers(6, NOW)).filter((m) => users.includes(m.id));
    expect(inactive.map((m) => m.id).sort()).toEqual([b.id, c.id].sort());
    expect(inactive.every((m) => m.lastAttended === null)).toBe(true);
  });

  it("lecture, Scrabble et renouvellements", async () => {
    const reader = await makeMember(at("2000-01-10T10:00:00Z"), at("2001-03-15T10:00:00Z"));
    const category = await db.category.create({
      data: { slug: `vt-genre-${tag}`, name: `Genre ${tag}` },
    });
    categories.push(category.id);
    const book = await db.book.create({
      data: {
        slug: `vt-livre-${tag}`,
        title: `Livre ${tag}`,
        summary: "Test",
        categoryId: category.id,
      },
    });
    books.push(book.id);
    await db.reading.create({
      data: {
        userId: reader.id,
        bookId: book.id,
        status: "FINISHED",
        progress: 100,
        finishedAt: at("2001-03-12T10:00:00Z"),
        completionStatus: "APPROVED",
      },
    });
    const reading = await getReadingStats(period, NOW);
    expect(reading.finished).toBeGreaterThanOrEqual(1);
    expect(reading.genres).toContainEqual({ label: `Genre ${tag}`, count: 1 });

    const tournament = await db.tournament.create({
      data: {
        slug: `vt-tournoi-${tag}`,
        name: `Tournoi ${tag}`,
        status: "COMPLETED",
        startsAt: at("2001-03-17T15:00:00Z"),
      },
    });
    tournaments.push(tournament.id);
    const round = await db.round.create({ data: { tournamentId: tournament.id, number: 1 } });
    for (const [name, points] of [
      ["Awa", 400],
      ["Moussa", 300],
    ] as const) {
      const p = await db.tournamentParticipant.create({
        data: { tournamentId: tournament.id, externalName: `${name} ${tag}` },
      });
      await db.score.create({ data: { roundId: round.id, participantId: p.id, points } });
    }
    await db.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        externalName: `Retiré ${tag}`,
        withdrawnAt: at("2001-03-17T16:00:00Z"),
      },
    });
    const scrabble = await getScrabbleStats(period, NOW);
    expect(scrabble.rows.find((r) => r.id === tournament.id)).toMatchObject({
      participants: 2,
      rounds: 1,
      averageScore: 350,
    });

    // Le lecteur a renouvelé en mars 2001 (première adhésion en 2000).
    expect(await countRenewals(period, NOW)).toBeGreaterThanOrEqual(2);
  });
});

import { describe, expect, it } from "vitest";
import {
  activities,
  activityLabels,
  eventActivities,
  eventHasActivity,
  normalizeActivities,
  activityBySlug,
  activityOfType,
  eventTypeCodes,
  eventTypeLabels,
  interestLabels,
} from "@/config/activities";
import { rules } from "@/config/rules";
import { site } from "@/config/site";
import { committeeMemberSchema, initials } from "@/features/committee/schemas";
import { excerpt } from "@/features/events/excerpt";
import { parseProgram, placeLabel } from "@/features/events/rules";
import { eventReportSchema, eventSchema } from "@/features/events/schemas";
import { dimensions, objectives } from "@/features/home/content";
import { sum, totalsByMonth, totalsBySession, type PaymentLine } from "@/features/payments/summary";
import { charterSchema, defaultCharter } from "@/features/settings/charter-schema";
import {
  clubSettingsSchema,
  defaultClubSettings,
  mergeSettings,
} from "@/features/settings/schemas";
import { formatFcfa } from "@/lib/money";

/** Contenus officiels du club (docs/CONTENUS-CLUB.md) : ce que le code doit en refléter. */
describe("identité et activités", () => {
  it("porte le slogan officiel", () => {
    expect(site.slogan).toBe("Le savoir comme flamme, l’excellence comme ambition");
    expect(defaultClubSettings.slogan).toBe(site.slogan);
  });

  it("présente trois dimensions et trois objectifs", () => {
    expect(dimensions.map((d) => d.title)).toEqual(["Culturelle", "Intellectuelle", "Sociale"]);
    expect(objectives).toHaveLength(3);
  });

  it("présente les cinq activités, dans l'ordre du document", () => {
    expect(activities.map((a) => a.name)).toEqual([
      "Les Rendez-vous lecture",
      "Les Tournois de Scrabble",
      "Les Débats d’idées",
      "Les Génies du soir",
      "L’Agora Ciné",
    ]);
  });

  it("rattache chaque type d'événement à une activité, sauf « Vie du club »", () => {
    expect(eventTypeCodes).toHaveLength(7);
    for (const type of eventTypeCodes) {
      expect(eventTypeLabels[type]).toBeTruthy();
      if (type === "LANCEMENT_AUTRE") expect(activityOfType(type)).toBeUndefined();
      else expect(activityOfType(type)).toBeDefined();
    }
    expect(activityOfType("INITIATION_SCRABBLE")?.slug).toBe("tournois-de-scrabble");
    expect(activityBySlug("agora-cine")?.rhythm).toBe("Tous les trois mois");
    expect(activityBySlug("inconnue")).toBeUndefined();
  });

  it("rencontre à plusieurs activités : principale d'abord, ordre du catalogue, sans doublon", () => {
    expect(
      normalizeActivities("GENIES_DU_SOIR", ["AGORA_CINE", "RENDEZ_VOUS_LECTURE", "AGORA_CINE"]),
    ).toEqual(["GENIES_DU_SOIR", "RENDEZ_VOUS_LECTURE", "AGORA_CINE"]);
    // La principale manquante est ajoutée : la base l'exige.
    expect(normalizeActivities("DEBAT_IDEES", [])).toEqual(["DEBAT_IDEES"]);
    expect(eventActivities({ type: "DEBAT_IDEES", activities: null })).toEqual(["DEBAT_IDEES"]);
    const lancement = {
      type: "LANCEMENT_AUTRE" as const,
      activities: ["LANCEMENT_AUTRE", "RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"] as const,
    };
    expect(activityLabels(lancement)).toEqual([
      "Vie du club",
      "Rendez-vous lecture",
      "Génies du soir",
    ]);
  });

  it("une rencontre paraît sous chacune de ses activités, Scrabble compris", () => {
    const bySlug = (slug: string) => activityBySlug(slug)!;
    const lectureQuiz = {
      type: "RENDEZ_VOUS_LECTURE" as const,
      activities: ["RENDEZ_VOUS_LECTURE", "GENIES_DU_SOIR"] as const,
    };
    expect(eventHasActivity(lectureQuiz, bySlug("rendez-vous-lecture"))).toBe(true);
    expect(eventHasActivity(lectureQuiz, bySlug("genies-du-soir"))).toBe(true);
    expect(eventHasActivity(lectureQuiz, bySlug("agora-cine"))).toBe(false);
    // Une initiation au Scrabble en activité secondaire relève de l'activité « Scrabble ».
    const debatScrabble = {
      type: "DEBAT_IDEES" as const,
      activities: ["DEBAT_IDEES", "INITIATION_SCRABBLE"] as const,
    };
    expect(eventHasActivity(debatScrabble, bySlug("tournois-de-scrabble"))).toBe(true);
    // Le lancement (« Vie du club ») n'est sous aucune activité par sa principale, mais l'est par les autres.
    expect(
      eventHasActivity(
        { type: "LANCEMENT_AUTRE", activities: ["LANCEMENT_AUTRE"] },
        bySlug("rendez-vous-lecture"),
      ),
    ).toBe(false);
  });

  it("propose un centre d'intérêt par activité", () => {
    expect(Object.keys(interestLabels)).toHaveLength(5);
  });
});

describe("cotisations", () => {
  it("part de 1 000 F CFA pour la carte et 100 F CFA par séance, réglables", () => {
    expect(rules["fees.membershipCard"]).toBe(1000);
    expect(rules["fees.session"]).toBe(100);
    const merged = mergeSettings([{ key: "fees.session", value: 200 }]);
    expect(merged.sessionFee).toBe(200);
    expect(merged.membershipCardFee).toBe(1000);
    expect(
      clubSettingsSchema.safeParse({ ...defaultClubSettings, membershipCardFee: "-5" }).success,
    ).toBe(false);
  });

  it("formate un montant en francs CFA", () => {
    expect(formatFcfa(1000).replace(/\s/g, " ")).toBe("1 000 F CFA");
    expect(formatFcfa(100).replace(/\s/g, " ")).toBe("100 F CFA");
  });

  const lines: PaymentLine[] = [
    {
      kind: "MEMBERSHIP_CARD",
      amount: 1000,
      paidAt: new Date("2026-12-26T18:30:00Z"),
      eventId: null,
    },
    { kind: "SESSION_FEE", amount: 100, paidAt: new Date("2027-01-09T16:10:00Z"), eventId: "e1" },
    { kind: "SESSION_FEE", amount: 100, paidAt: new Date("2027-01-09T16:12:00Z"), eventId: "e1" },
    { kind: "SESSION_FEE", amount: 100, paidAt: new Date("2027-01-23T16:05:00Z"), eventId: "e2" },
  ];

  it("totalise par mois, le plus récent d'abord", () => {
    const months = totalsByMonth(lines);
    expect(months.map((m) => m.month.toISOString().slice(0, 7))).toEqual(["2027-01", "2026-12"]);
    expect(months[0]).toMatchObject({ cards: 0, sessions: 300, total: 300, count: 3 });
    expect(months[1]).toMatchObject({ cards: 1000, sessions: 0, total: 1000, count: 1 });
    expect(sum(lines)).toBe(1300);
  });

  it("totalise par séance, sans les cartes", () => {
    const sessions = totalsBySession(lines);
    expect(sessions.get("e1")).toEqual({ total: 200, count: 2 });
    expect(sessions.get("e2")).toEqual({ total: 100, count: 1 });
    expect(sessions.size).toBe(2);
  });
});

describe("événements", () => {
  it("lit un déroulé « horaire | intitulé »", () => {
    expect(parseProgram("16 h 00 – 16 h 30 | Mise en place\n\nMot de clôture\n | ")).toEqual([
      { time: "16 h 00 – 16 h 30", label: "Mise en place" },
      { time: "", label: "Mot de clôture" },
    ]);
    expect(parseProgram(null)).toEqual([]);
  });

  it("affiche « Lieu à confirmer » tant que le lieu manque", () => {
    expect(placeLabel(null)).toBe("Lieu à confirmer");
    expect(placeLabel("Maison de la culture")).toBe("Maison de la culture");
  });

  const event = {
    title: "Débat d’idées",
    type: "DEBAT_IDEES",
    activities: ["DEBAT_IDEES"],
    summary: "",
    description: "Un sujet de société est choisi et débattu.",
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
    isPublic: true,
    cancellationDeadlineHours: "",
  };

  it("fiche d'une rencontre : au moins une activité, la principale parmi elles", () => {
    const parsed = eventSchema.parse({
      ...event,
      type: "DEBAT_IDEES",
      activities: ["AGORA_CINE", "DEBAT_IDEES", "AGORA_CINE"],
    });
    expect(parsed.activities).toEqual(["DEBAT_IDEES", "AGORA_CINE"]);
    expect(eventSchema.safeParse({ ...event, activities: [] }).success).toBe(false);
    const outside = eventSchema.safeParse({
      ...event,
      type: "DEBAT_IDEES",
      activities: ["AGORA_CINE"],
    });
    expect(outside.success).toBe(false);
    expect(outside.error?.issues[0]?.path).toEqual(["type"]);
    // Toutes les erreurs remontent en une fois, même avec la principale hors de la liste.
    const several = eventSchema.safeParse({
      ...event,
      type: "DEBAT_IDEES",
      activities: ["AGORA_CINE"],
      startsAt: "2027-01-10T18:00",
      endsAt: "2027-01-10T17:00",
    });
    expect(several.error?.issues.map((issue) => issue.path[0]).sort()).toEqual(["endsAt", "type"]);
    const tooMany = eventSchema.safeParse({
      ...event,
      activities: Array.from({ length: 50 }, () => "DEBAT_IDEES"),
    });
    expect(tooMany.error?.issues[0]?.message).toBe("Pas plus de 7 activités.");
  });

  it("accepte un événement sans lieu et refuse les anciens types", () => {
    expect(eventSchema.safeParse(event).success).toBe(true);
    expect(eventSchema.safeParse({ ...event, type: "WORKSHOP" }).success).toBe(false);
  });

  it("exige le mode de présence d'un invité et un lien de visio en https", () => {
    const withSpeaker = { ...event, speakerName: "Une invitée" };
    expect(eventSchema.safeParse(withSpeaker).success).toBe(false);
    expect(eventSchema.safeParse({ ...withSpeaker, speakerMode: "REMOTE" }).success).toBe(true);
    expect(eventSchema.safeParse({ ...event, videoLink: "http://exemple.sn/salle" }).success).toBe(
      false,
    );
    expect(eventSchema.safeParse({ ...event, videoLink: "https://exemple.sn/salle" }).success).toBe(
      true,
    );
  });

  it("valide un compte rendu et en tire un extrait sans Markdown", () => {
    expect(
      eventReportSchema.safeParse({ eventId: "e1", content: "## Synthèse", publish: true }).success,
    ).toBe(true);
    expect(excerpt("## Synthèse\n\nUn **beau** débat, avec [un lien](/events).")).toBe(
      "Un beau débat, avec un lien.",
    );
    expect(excerpt("mot ".repeat(200)).endsWith("…")).toBe(true);
  });
});

describe("charte et comité", () => {
  it("part d'une charte provisoire, en version 1, qui reprend les principes du comité", () => {
    expect(defaultCharter.provisional).toBe(true);
    expect(defaultCharter.version).toBe(1);
    expect(defaultCharter.content.split("\n")).toHaveLength(9);
    expect(charterSchema.safeParse({ content: "", provisional: true }).success).toBe(false);
  });

  it("tire les initiales d'un nom", () => {
    expect(initials("Yaye Arête Sagna Diop")).toBe("YD");
    expect(initials("Mansour Diop")).toBe("MD");
    expect(initials("Absa")).toBe("A");
    expect(initials("  ")).toBe("");
  });

  it("n'exige que le nom d'un membre du comité, et refuse une photo arbitraire", () => {
    const member = { id: "", name: "Mame Cheikh Diop", role: "", bio: "", photo: "" };
    expect(committeeMemberSchema.safeParse(member).success).toBe(true);
    expect(committeeMemberSchema.safeParse({ ...member, name: "" }).success).toBe(false);
    expect(
      committeeMemberSchema.safeParse({ ...member, photo: "https://exemple.sn/photo.jpg" }).success,
    ).toBe(false);
    const stored = `committee/${"a".repeat(32)}.jpg`;
    expect(committeeMemberSchema.safeParse({ ...member, photo: stored }).success).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  holdsSeat,
  ordinal,
  promotionOpen,
  waitlistCutoff,
  waitlistOpen,
} from "@/features/events/rules";
import { guestWaitlistConfirmEmail, waitlistPromotedEmail } from "@/lib/mail/club-templates";
import { clubSettingsSchema } from "@/features/settings/schemas";

const start = new Date("2031-03-05T18:00:00Z");
const event = { status: "PUBLISHED" as const, startsAt: start, capacity: 10 };

describe("liste d'attente : règles", () => {
  it("ouverte jusqu'au seuil (2 h avant), fermée ensuite ou si la rencontre n'est pas ouverte", () => {
    expect(waitlistCutoff(event, 2)).toEqual(new Date("2031-03-05T16:00:00Z"));
    expect(waitlistOpen(event, new Date("2031-03-05T15:59:00Z"), 2)).toBe(true);
    expect(waitlistOpen(event, new Date("2031-03-05T16:00:00Z"), 2)).toBe(false);
    // Seuil à 0 : jusqu'au début.
    expect(waitlistOpen(event, new Date("2031-03-05T17:59:00Z"), 0)).toBe(true);
    expect(waitlistOpen({ ...event, status: "CLOSED" }, new Date("2031-03-01T00:00:00Z"), 2)).toBe(
      false,
    );
    expect(waitlistOpen({ ...event, capacity: null }, new Date("2031-03-01T00:00:00Z"), 2)).toBe(
      false,
    );
    // Capacité supprimée : la promotion reste ouverte (tout le monde passe).
    expect(promotionOpen({ ...event }, new Date("2031-03-01T00:00:00Z"), 2)).toBe(true);
    expect(
      promotionOpen({ ...event, status: "CANCELLED" }, new Date("2031-03-01T00:00:00Z"), 2),
    ).toBe(false);
  });

  it("une personne en attente ne retient pas de place ; rangs en toutes lettres", () => {
    expect(holdsSeat({ status: "WAITLISTED", updatedAt: new Date() }, new Date())).toBe(false);
    expect(ordinal(1)).toBe("1er");
    expect(ordinal(2)).toBe("2e");
  });

  it("réglage du seuil : entre 0 et 72 heures", () => {
    const field = clubSettingsSchema.shape.waitlistCutoffHours;
    expect(field.safeParse(0).success).toBe(true);
    expect(field.safeParse("72").success).toBe(true);
    expect(field.safeParse(73).success).toBe(false);
    expect(field.safeParse("2h").success).toBe(false);
  });
});

describe("liste d'attente : e-mails", () => {
  const info = { title: "Rendez-vous", when: "samedi 5 mars 2031, 18 h", place: "Dakar" };
  it("invité : confirmer son adresse pour prendre son rang", () => {
    const mail = guestWaitlistConfirmEmail({
      to: "a@exemple.test",
      name: "Awa",
      event: info,
      url: "https://agora.test/events/registration?token=x",
    });
    expect(mail.subject).toContain("Confirmez votre place sur la liste d’attente");
    expect(mail.text).toContain("Confirmer ma place sur la liste : https://agora.test");
  });

  it("place obtenue : agenda, annulation, promotion manuelle", () => {
    const base = {
      to: "a@exemple.test",
      name: "Awa",
      event: info,
      url: "https://agora.test/events/rv#inscription",
      calendar: {
        ics: "https://agora.test/events/rv/agenda.ics",
        google: "https://calendar.google.com/x",
      },
      cancelBefore: "vendredi 4 mars 2031 à 18 h",
      manual: false,
    };
    const auto = waitlistPromotedEmail(base);
    expect(auto.subject).toBe("Une place s’est libérée : vous êtes inscrit · Rendez-vous");
    expect(auto.text).toContain("vous étiez le premier sur la liste d’attente");
    expect(auto.text).toContain("agenda.ics");
    expect(auto.text).toContain("avant le vendredi 4 mars 2031 à 18 h");
    expect(waitlistPromotedEmail({ ...base, manual: true }).text).toContain(
      "Le club vous a fait une place",
    );
  });
});

import { describe, expect, it } from "vitest";
import { canSubmit, displayAverage, feedbackWindow, requestDue } from "@/features/feedback/rules";
import { feedbackSchema } from "@/features/feedback/schemas";
import { feedbackRequestEmail } from "@/lib/mail/club-templates";

const at = (iso: string) => new Date(iso);

describe("avis : fenêtre", () => {
  it("sans heure de fin : début + 3 h ; invitation le lendemain à l'heure réglée, 72 h de rattrapage, 7 jours pour modifier", () => {
    const w = feedbackWindow({ startsAt: at("2026-12-05T18:00:00Z"), endsAt: null }, 10);
    expect(w).toEqual({
      endedAt: at("2026-12-05T21:00:00Z"),
      opensAt: at("2026-12-06T10:00:00Z"),
      catchUpUntil: at("2026-12-09T10:00:00Z"),
      closesAt: at("2026-12-13T10:00:00Z"),
    });
    expect(canSubmit(w, at("2026-12-05T20:59:00Z"))).toBe(false);
    expect(canSubmit(w, at("2026-12-05T21:00:00Z"))).toBe(true);
    expect(canSubmit(w, at("2026-12-13T09:59:00Z"))).toBe(true);
    expect(canSubmit(w, at("2026-12-13T10:00:00Z"))).toBe(false);
    expect(requestDue(w, at("2026-12-06T09:59:00Z"))).toBe(false);
    expect(requestDue(w, at("2026-12-06T10:05:00Z"))).toBe(true);
    expect(requestDue(w, at("2026-12-09T09:59:00Z"))).toBe(true);
    expect(requestDue(w, at("2026-12-09T10:00:00Z"))).toBe(false);
  });

  it("rencontre qui finit après minuit : le lendemain de la fin", () => {
    const w = feedbackWindow(
      { startsAt: at("2026-12-31T21:00:00Z"), endsAt: at("2027-01-01T01:00:00Z") },
      0,
    );
    expect(w.opensAt).toEqual(at("2027-01-02T00:00:00Z"));
  });

  it("moyenne à une décimale, à partir de 3 avis", () => {
    expect(displayAverage(9, 2)).toBeNull();
    expect(displayAverage(13, 3)).toBe(4.3);
  });
});

describe("avis : saisie", () => {
  it("note entière de 1 à 5 ; commentaire facultatif, 1 000 caractères au plus, vide → aucun", () => {
    expect(feedbackSchema.parse({ eventId: "e1", rating: 5, comment: "  " }).comment).toBeNull();
    expect(feedbackSchema.parse({ eventId: "e1", rating: 1, comment: " Bien " }).comment).toBe(
      "Bien",
    );
    for (const rating of [0, 6, 2.5, "4"]) {
      expect(feedbackSchema.safeParse({ eventId: "e1", rating, comment: "" }).success).toBe(false);
    }
    expect(
      feedbackSchema.safeParse({ eventId: "e1", rating: 3, comment: "x".repeat(1001) }).success,
    ).toBe(false);
  });

  it("e-mail : lien, échéance, jamais publié, charte", () => {
    const mail = feedbackRequestEmail({
      to: "awa@exemple.test",
      name: "Awa",
      title: "Rendez-vous lecture",
      date: "samedi 5 décembre 2026",
      url: "https://agora.test/member/events/rv/avis",
      closesAt: "dimanche 13 décembre 2026 à 10 h",
    });
    expect(mail.subject).toBe("Votre avis sur « Rendez-vous lecture »");
    expect(mail.text).toContain("Donner mon avis : https://agora.test/member/events/rv/avis");
    expect(mail.text).toContain("jusqu’au dimanche 13 décembre 2026 à 10 h");
    expect(mail.text).toContain("n’est jamais publié");
    expect(mail.text).toContain("charte");
  });
});

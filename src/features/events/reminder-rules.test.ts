import { describe, expect, it } from "vitest";
import {
  alreadyReminded,
  dayWord,
  reminderDue,
  reminderWindow,
} from "@/features/events/reminder-rules";

const at = (iso: string) => new Date(iso);
const confirmed = (startsAt: string, confirmedAt = "2026-11-20T12:00:00Z") => ({
  startsAt: at(startsAt),
  confirmedAt: at(confirmedAt),
  createdAt: at(confirmedAt),
});

describe("rappel la veille : fenêtre d'envoi", () => {
  it("s'ouvre la veille à l'heure réglée, se ferme 2 h avant le début", () => {
    expect(reminderWindow(at("2026-12-05T18:00:00Z"), 10)).toEqual({
      opensAt: at("2026-12-04T10:00:00Z"),
      closesAt: at("2026-12-05T16:00:00Z"),
    });
    const r = confirmed("2026-12-05T18:00:00Z");
    expect(reminderDue(r, 10, at("2026-12-04T09:59:00Z"))).toBe(false);
    expect(reminderDue(r, 10, at("2026-12-04T10:00:00Z"))).toBe(true);
    // Serveur éteint à 10 h : rattrapé le soir, puis le jour même jusqu'à 2 h avant.
    expect(reminderDue(r, 10, at("2026-12-04T22:05:00Z"))).toBe(true);
    expect(reminderDue(r, 10, at("2026-12-05T15:59:00Z"))).toBe(true);
    expect(reminderDue(r, 10, at("2026-12-05T16:00:00Z"))).toBe(false);
  });

  it("heure réglée à 0 ou 23, rencontre du 1er janvier, rencontre très matinale", () => {
    expect(reminderWindow(at("2027-01-01T18:00:00Z"), 0)!.opensAt).toEqual(
      at("2026-12-31T00:00:00Z"),
    );
    expect(reminderWindow(at("2026-12-05T18:00:00Z"), 23)!.opensAt).toEqual(
      at("2026-12-04T23:00:00Z"),
    );
    // Rencontre à 1 h, rappel réglé à 23 h la veille : fermée avant d'ouvrir, pas de rappel.
    expect(reminderWindow(at("2026-12-05T01:00:00Z"), 23)).toBeNull();
  });

  it("une inscription confirmée après l'ouverture de la fenêtre n'a pas de rappel", () => {
    const late = confirmed("2026-12-05T18:00:00Z", "2026-12-04T11:00:00Z");
    expect(reminderDue(late, 10, at("2026-12-04T12:00:00Z"))).toBe(false);
    const guest = {
      startsAt: at("2026-12-05T18:00:00Z"),
      confirmedAt: null,
      createdAt: at("2026-12-01T08:00:00Z"),
    };
    expect(reminderDue(guest, 10, at("2026-12-04T10:05:00Z"))).toBe(true);
  });

  it("rencontre déplacée : nouveau rappel au-delà de 15 min d'écart seulement", () => {
    const sent = [at("2026-12-05T18:00:00Z")];
    expect(alreadyReminded(sent, at("2026-12-05T18:10:00Z"))).toBe(true);
    expect(alreadyReminded(sent, at("2026-12-05T19:00:00Z"))).toBe(false);
    expect(alreadyReminded([], at("2026-12-05T18:00:00Z"))).toBe(false);
  });

  it("« demain » la veille, « aujourd’hui » en rattrapage le jour même", () => {
    expect(dayWord(at("2026-12-05T18:00:00Z"), at("2026-12-04T10:05:00Z"))).toBe("demain");
    expect(dayWord(at("2026-12-05T18:00:00Z"), at("2026-12-05T08:05:00Z"))).toBe("aujourd’hui");
  });
});

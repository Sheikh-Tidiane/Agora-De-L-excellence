import { describe, expect, it } from "vitest";
import {
  acceptedAt,
  cardDeadline,
  cardDue,
  daysSince,
  hideVideoLink,
  remindersDue,
} from "@/features/members/card-dues";

/** Carte à régler : délai de grâce, rappels, masquage du lien de visio. */
const day = (n: number) => new Date(Date.UTC(2027, 0, 1 + n, 10, 0, 0));
const accepted = day(0); // 1er janvier 2027, 10 h
const unpaid = { paid: false, memberships: [{ startsAt: accepted }] };

describe("délai de grâce de la carte", () => {
  it("date d'acceptation : la première adhésion, renouvellements compris", () => {
    expect(acceptedAt([{ startsAt: day(400) }, { startsAt: accepted }])).toEqual(accepted);
    expect(acceptedAt([])).toBeNull();
  });
  it("date limite et jours écoulés", () => {
    expect(cardDeadline(accepted, 30)).toEqual(day(30));
    expect(daysSince(accepted, day(0))).toBe(0);
    expect(daysSince(accepted, new Date(day(12).getTime() - 1))).toBe(11);
    expect(daysSince(accepted, day(12))).toBe(12);
  });
  it("en retard seulement si non réglée et délai passé ; jamais sans adhésion", () => {
    expect(cardDue(unpaid, 30, day(29)).overdue).toBe(false);
    expect(cardDue(unpaid, 30, day(30)).overdue).toBe(true);
    expect(cardDue({ ...unpaid, paid: true }, 30, day(90)).overdue).toBe(false);
    expect(cardDue({ paid: false, memberships: [] }, 30, day(90))).toMatchObject({
      overdue: false,
      deadline: null,
    });
  });
});

describe("rappels « carte à régler »", () => {
  it("7 jours après l'acceptation, puis 3 jours avant la fin du délai", () => {
    expect(remindersDue(unpaid, [], 30, day(6))).toEqual([]);
    expect(remindersDue(unpaid, [], 30, day(7))).toEqual(["AFTER_ACCEPTANCE"]);
    expect(remindersDue(unpaid, ["AFTER_ACCEPTANCE"], 30, day(15))).toEqual([]);
    expect(remindersDue(unpaid, ["AFTER_ACCEPTANCE"], 30, day(27))).toEqual(["BEFORE_DEADLINE"]);
  });
  it("sans doublon : un rappel déjà envoyé ne repart pas", () => {
    expect(remindersDue(unpaid, ["AFTER_ACCEPTANCE", "BEFORE_DEADLINE"], 30, day(28))).toEqual([]);
    expect(remindersDue(unpaid, ["AFTER_ACCEPTANCE"], 30, day(8))).toEqual([]);
  });
  it("rien une fois la carte réglée, ni après la fin du délai, ni sans adhésion", () => {
    expect(remindersDue({ ...unpaid, paid: true }, [], 30, day(7))).toEqual([]);
    expect(remindersDue(unpaid, [], 30, day(30))).toEqual([]);
    expect(remindersDue({ paid: false, memberships: [] }, [], 30, day(7))).toEqual([]);
  });
  it("tâche en retard ou délai court : seul le rappel le plus proche part", () => {
    // Serveur éteint du 7e au 27e jour : on ne rattrape pas « 7 jours après », seulement « 3 jours avant ».
    expect(remindersDue(unpaid, [], 30, day(28))).toEqual(["BEFORE_DEADLINE"]);
    // Délai de 8 jours : « 3 jours avant » (5e jour) arrive avant « 7 jours après ».
    expect(remindersDue(unpaid, [], 8, day(5))).toEqual(["BEFORE_DEADLINE"]);
    expect(remindersDue(unpaid, ["BEFORE_DEADLINE"], 8, day(7))).toEqual([]);
  });
});

describe("lien de visio d'un membre dont la carte n'est pas réglée", () => {
  it("masqué seulement si l'option est activée ET le délai passé", () => {
    expect(hideVideoLink(cardDue(unpaid, 30, day(31)), true)).toBe(true);
    expect(hideVideoLink(cardDue(unpaid, 30, day(31)), false)).toBe(false);
    expect(hideVideoLink(cardDue(unpaid, 30, day(10)), true)).toBe(false);
    expect(hideVideoLink(cardDue({ ...unpaid, paid: true }, 30, day(31)), true)).toBe(false);
    expect(hideVideoLink(cardDue({ paid: false, memberships: [] }, 30, day(31)), true)).toBe(false);
  });
});

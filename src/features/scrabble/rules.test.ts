import { describe, expect, it } from "vitest";
import {
  adminPlayerName,
  canTransition,
  expectedEntries,
  HIDDEN_MEMBER_LABEL,
  placeLabel,
  placementPoints,
  publicPlayerName,
  tournamentPublicPath,
} from "@/features/scrabble/rules";

describe("cycle de vie d'un tournoi", () => {
  it("suit brouillon → inscriptions → en cours → terminé, annulation réversible", () => {
    expect(canTransition("DRAFT", "REGISTRATION_OPEN")).toBe(true);
    expect(canTransition("REGISTRATION_OPEN", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("CANCELLED", "DRAFT")).toBe(true);
    expect(canTransition("COMPLETED", "CANCELLED")).toBe(false);
    expect(canTransition("DRAFT", "COMPLETED")).toBe(false);
    expect(canTransition("CANCELLED", "IN_PROGRESS")).toBe(false);
  });
});

describe("noms affichés", () => {
  const member = { firstName: "Awa", lastName: "Diop", hiddenFromRankings: false };
  it("membre : prénom + initiale ; retiré des classements : anonyme ; extérieur : son nom", () => {
    expect(publicPlayerName({ user: member, externalName: null, externalClub: null })).toBe(
      "Awa D.",
    );
    expect(
      publicPlayerName({
        user: { ...member, hiddenFromRankings: true },
        externalName: null,
        externalClub: null,
      }),
    ).toBe(HIDDEN_MEMBER_LABEL);
    expect(
      publicPlayerName({
        user: null,
        externalName: "Moussa Ndiaye",
        externalClub: "Club de Thiès",
      }),
    ).toBe("Moussa Ndiaye");
    expect(adminPlayerName({ user: member, externalName: null, externalClub: null })).toBe(
      "Awa Diop",
    );
  });
});

describe("libellés", () => {
  it("place en toutes lettres et adresse publique", () => {
    expect(placeLabel(1)).toBe("à la 1re place");
    expect(placeLabel(3)).toBe("à la 3e place");
    expect(tournamentPublicPath("tournoi-de-mars")).toBe("/scrabble/tournoi-de-mars");
  });
});

describe("points du classement mensuel", () => {
  it("classés − rang + 1, rien hors classement", () => {
    expect(placementPoints(1, 8)).toBe(8);
    expect(placementPoints(8, 8)).toBe(1);
    expect(placementPoints(1, 1)).toBe(1);
    expect(placementPoints(null, 8)).toBe(0);
    expect(placementPoints(9, 8)).toBe(0);
  });
});

describe("état de saisie d'une manche", () => {
  it("duplicate : un score par joueur non retiré (et pour un retiré déjà saisi)", () => {
    expect(
      expectedEntries({
        classic: false,
        activeParticipantIds: ["a", "b"],
        matches: [],
        scoredParticipantIds: ["a", "x"],
      }),
    ).toEqual({ expected: 3, entered: 2, missing: ["b"] });
  });
  it("classique : deux scores par partie", () => {
    expect(
      expectedEntries({
        classic: true,
        activeParticipantIds: ["a", "b", "c"],
        matches: [{ participantAId: "a", participantBId: "b" }],
        scoredParticipantIds: ["a"],
      }),
    ).toEqual({ expected: 2, entered: 1, missing: ["b"] });
  });
});

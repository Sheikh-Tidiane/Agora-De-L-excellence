import { describe, expect, it } from "vitest";
import { withCardPaid, type ScanResponse } from "@/features/attendance/components/scan-api";

const scanned: ScanResponse = {
  ok: true,
  member: {
    id: "u1",
    firstName: "Awa",
    lastName: "Ndiaye",
    memberNumber: "AG-0001",
    photoUrl: null,
    cardPaid: false,
    guest: false,
  },
  registrationId: "r1",
  alreadyPresent: false,
  attendedAt: "2026-11-28T18:05:00.000Z",
  method: "QR_SCAN",
  paid: false,
  pointsAwarded: 20,
  badges: [],
};

describe("écran du scan : carte encaissée sur place", () => {
  it("la carte passe à réglée, la présence et le reste du pointage ne changent pas", () => {
    const after = withCardPaid(scanned);
    expect(after).toEqual({ ...scanned, member: { ...scanned.member, cardPaid: true } });
    expect(scanned.ok && scanned.member.cardPaid).toBe(false);
  });

  it("un refus reste un refus", () => {
    const refused: ScanResponse = { ok: false, message: "Carte inconnue." };
    expect(withCardPaid(refused)).toBe(refused);
  });
});

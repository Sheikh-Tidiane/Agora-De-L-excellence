import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GET as publicUpload } from "@/app/uploads/[...path]/route";
import { activeMemberTab, memberTabs } from "@/config/navigation";
import { ownProfileSchema } from "@/features/members/profile-schemas";
import { avatarUrl, isPrivateImage, isStoredImage, uploadUrl } from "@/lib/storage-names";

/** Espace membre (phase 4, partie A) : navigation, profil, photo privée. */
describe("onglets de l'espace membre", () => {
  it("garde les cinq onglets dans l'ordre demandé", () => {
    expect(memberTabs.map((tab) => tab.label)).toEqual([
      "Accueil",
      "Lectures",
      "Événements",
      "Scrabble",
      "Profil",
    ]);
  });

  it("n'affiche que des onglets dont la page existe (aucun lien mort)", () => {
    for (const tab of memberTabs) {
      const page = `src/app${tab.href}/page.tsx`;
      expect(existsSync(page), `${tab.label} → ${page}`).toBe(tab.ready);
    }
  });

  it("désigne l'onglet courant par le plus long préfixe", () => {
    expect(activeMemberTab("/member")).toBe("home");
    expect(activeMemberTab("/member/events")).toBe("events");
    expect(activeMemberTab("/member/profile")).toBe("profile");
    expect(activeMemberTab("/member/card")).toBe("profile");
    expect(activeMemberTab("/member/scrabble")).toBe("scrabble");
    expect(activeMemberTab("/member/quiz/echauffement")).toBe("scrabble");
    expect(activeMemberTab("/member/notifications")).toBe("home");
    expect(activeMemberTab("/membership")).toBeNull();
    expect(activeMemberTab("/events")).toBeNull();
  });
});

describe("profil modifié par le membre", () => {
  it("accepte un numéro sénégalais et le normalise", () => {
    const parsed = ownProfileSchema.parse({ phone: "77 123 45 67", hiddenFromRankings: true });
    expect(parsed.phone).toBe("+221771234567");
    expect(parsed.hiddenFromRankings).toBe(true);
  });

  it("efface le téléphone laissé vide", () => {
    expect(ownProfileSchema.parse({ phone: "  ", hiddenFromRankings: false }).phone).toBeNull();
  });

  it("refuse un numéro invalide et un booléen forgé", () => {
    expect(ownProfileSchema.safeParse({ phone: "abc", hiddenFromRankings: false }).success).toBe(
      false,
    );
    expect(ownProfileSchema.safeParse({ phone: "", hiddenFromRankings: "true" }).success).toBe(
      false,
    );
  });

  it("ne laisse au membre ni son nom, ni son e-mail, ni son compte", () => {
    const parsed = ownProfileSchema.parse({
      phone: "",
      hiddenFromRankings: false,
      firstName: "Autre",
      email: "autre@exemple.test",
      userId: "ckx1a2b3c4d5e6f7g8h9i0j1k",
    });
    expect(Object.keys(parsed).sort()).toEqual(["hiddenFromRankings", "phone"]);
  });
});

describe("photo de profil privée", () => {
  const avatar = `avatars/${"a".repeat(32)}.jpg`;

  it("reconnaît les noms produits par le stockage", () => {
    expect(isStoredImage(avatar)).toBe(true);
    expect(isPrivateImage(avatar)).toBe(true);
    expect(isPrivateImage(`covers/${"a".repeat(32)}.jpg`)).toBe(false);
  });

  it("sert la photo par une adresse réservée, jamais par /uploads", async () => {
    expect(avatarUrl(avatar)).toBe(`/api/member/photo/${avatar}`);
    expect(uploadUrl(avatar)).toBe(`/uploads/${avatar}`);
    const response = await publicUpload(new Request("http://localhost/uploads/x"), {
      params: Promise.resolve({ path: avatar.split("/") }),
    });
    expect(response.status).toBe(404);
  });
});

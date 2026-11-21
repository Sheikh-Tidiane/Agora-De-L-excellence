import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Se retirer des classements (ou être renommé, archivé) doit aussi retirer son nom des résultats
 * publics du Scrabble, mis en cache sous `cacheTags.scrabble` : l'action invalide cette étiquette.
 */
const tags: string[] = [];
vi.mock("next/cache", () => ({
  updateTag: (tag: string) => void tags.push(tag),
  revalidateTag: (tag: string) => void tags.push(tag),
  revalidatePath: () => undefined,
  refresh: () => undefined,
}));
vi.mock("@/lib/permissions", () => ({
  requirePermission: async () => ({ id: "user-1", roles: [], permissions: [] }),
}));
vi.mock("@/features/members/profile-service", () => ({
  updateOwnProfile: vi.fn(async () => undefined),
}));
vi.mock("@/features/members/service", () => ({
  updateMember: vi.fn(async () => undefined),
  archiveMember: vi.fn(async () => undefined),
  suspendMember: vi.fn(),
  reactivateMember: vi.fn(),
  renewMembership: vi.fn(),
}));
vi.mock("@/features/auth/service", () => ({ sendActivationEmail: vi.fn() }));

const { updateOwnProfileAction } = await import("@/features/members/profile-actions");
const { archiveMemberAction } = await import("@/features/members/actions");
const { cacheTags } = await import("@/lib/cache-tags");

beforeEach(() => {
  tags.length = 0;
});

describe("noms publics du Scrabble", () => {
  it("le retrait des classements invalide le cache public du Scrabble", async () => {
    const result = await updateOwnProfileAction({ phone: "", hiddenFromRankings: true });
    expect(result.ok).toBe(true);
    expect(tags).toContain(cacheTags.scrabble);
  });

  it("l'archivage (anonymisation) d'un membre invalide le cache public du Scrabble", async () => {
    const result = await archiveMemberAction({ userId: "user-2" });
    expect(result.ok).toBe(true);
    expect(tags).toContain(cacheTags.scrabble);
  });
});

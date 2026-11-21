import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/permissions/can";

/**
 * `getViewer` sans base ni serveur : le cookie, l'utilisateur chargé et le paiement de la carte
 * sont simulés ; la vraie fonction `can` décide du type de visiteur.
 */
const state = {
  cookie: true,
  user: null as CurrentUser | null,
  cards: 0,
  userLoads: 0,
  cardQueries: [] as unknown[],
};

vi.mock("next/cache", () => ({ cacheLife: () => undefined, cacheTag: () => undefined }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("better-auth/cookies", () => ({
  getSessionCookie: () => (state.cookie ? "jeton" : null),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    payment: {
      count: async (query: unknown) => {
        state.cardQueries.push(query);
        return state.cards;
      },
    },
  },
}));
vi.mock("@/lib/permissions", async () => {
  const { can } = await import("@/lib/permissions/can");
  return {
    can,
    getCurrentUser: async () => {
      state.userLoads++;
      return state.user;
    },
  };
});

const { getViewer, spaceHref } = await import("@/features/auth/viewer");

function user(permissions: string[]): CurrentUser {
  return {
    id: "ckmembre",
    firstName: "Awa",
    lastName: "Diop",
    name: "Awa Diop",
    email: "awa@example.org",
    memberNumber: "AG-0001",
    roles: [],
    permissions,
  } as CurrentUser;
}

beforeEach(() => {
  state.cookie = true;
  state.user = null;
  state.cards = 0;
  state.userLoads = 0;
  state.cardQueries = [];
});

describe("getViewer : qui regarde le site public", () => {
  it("sans cookie de session : visiteur, sans interroger la base", async () => {
    state.cookie = false;
    state.user = user(["member.access"]);
    expect(await getViewer()).toEqual({ kind: "visitor" });
    expect(state.userLoads).toBe(0);
  });

  it("cookie sans session valide (expirée, compte suspendu) : visiteur", async () => {
    state.user = null;
    expect(await getViewer()).toEqual({ kind: "visitor" });
    expect(state.cardQueries).toEqual([]);
  });

  it("membre : carte réglée ou non, lue sur ses seuls paiements non annulés", async () => {
    state.user = user(["member.access"]);
    expect(await getViewer()).toEqual({ kind: "member", firstName: "Awa", cardPaid: false });
    state.cards = 1;
    expect(await getViewer()).toEqual({ kind: "member", firstName: "Awa", cardPaid: true });
    expect(state.cardQueries[0]).toEqual({
      where: { userId: "ckmembre", kind: "MEMBERSHIP_CARD", cancelledAt: null },
    });
  });

  it("responsable (accès à l'administration) : « staff », même s'il est aussi membre", async () => {
    state.user = user(["member.access", "admin.access"]);
    expect(await getViewer()).toEqual({ kind: "staff", firstName: "Awa" });
    expect(state.cardQueries).toEqual([]);
  });

  it("compte actif sans aucun accès : traité comme un visiteur", async () => {
    state.user = user([]);
    expect(await getViewer()).toEqual({ kind: "visitor" });
  });

  it("« Mon espace » : l'administration pour un responsable, l'espace membre sinon", () => {
    expect(spaceHref({ kind: "staff", firstName: "Awa" })).toBe("/admin");
    expect(spaceHref({ kind: "member", firstName: "Awa", cardPaid: false })).toBe("/member");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { can, canAccessOwned, canAll, canAny, type CurrentUser } from "@/lib/permissions/can";
import {
  ALL_PERMISSIONS,
  ALL_ROLES,
  PERMISSIONS,
  ROLES,
  permissionsForRoles,
  type PermissionCode,
  type RoleCode,
} from "@/lib/permissions/catalog";

const getSession = vi.fn();
const findUnique = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect, unstable_rethrow: () => undefined }));
// `cache` de React ne mémorise que pendant un rendu serveur : ici, on appelle la fonction directement.
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const { getCurrentUser, requireOwnership, requirePageAccess, requirePermission, requireUser } =
  await import("@/lib/permissions");

function userWith(roles: RoleCode[], id = "u1"): CurrentUser {
  return {
    id,
    firstName: "Awa",
    lastName: "Diop",
    name: "Awa Diop",
    email: "awa@example.org",
    memberNumber: null,
    roles,
    permissions: [...permissionsForRoles(roles)],
  };
}

/** Ce que la base renverrait pour un utilisateur porteur de ces rôles. */
function dbUser(roles: RoleCode[], status = "ACTIVE") {
  return {
    id: "u1",
    firstName: "Awa",
    lastName: "Diop",
    name: "Awa Diop",
    email: "awa@example.org",
    memberNumber: null,
    status,
    roles: roles.map((code) => ({
      role: {
        code,
        permissions: ROLES[code].permissions.map((permission) => ({
          permission: { code: permission },
        })),
      },
    })),
  };
}

function signedInAs(roles: RoleCode[], status = "ACTIVE") {
  getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });
  findUnique.mockResolvedValue(dbUser(roles, status));
}

/** Matrice attendue, écrite à la main : le test échoue si le catalogue s'en écarte. */
const expected: Record<RoleCode, PermissionCode[]> = {
  member: ["member.access"],
  communication: ["admin.access", "articles.manage", "quizzes.manage", "contact.manage"],
  library: ["admin.access", "books.manage", "readings.validate", "reviews.moderate"],
  scrabble: ["admin.access", "tournaments.manage", "scores.enter", "results.publish"],
  admin: [
    "admin.access",
    "articles.manage",
    "books.manage",
    "readings.validate",
    "reviews.moderate",
    "memberships.review",
    "members.read",
    "members.manage",
    "events.manage",
    "attendance.record",
    "payments.record",
    "payments.read",
    "points.grant",
    "points.rules.manage",
    "badges.award",
    "quizzes.manage",
    "contact.manage",
    "data.export",
    "settings.manage",
    "audit.read",
    "feedback.read",
    "feedback.moderate",
    "stats.read",
  ],
  super_admin: ALL_PERMISSIONS,
};

beforeEach(() => {
  getSession.mockReset();
  findUnique.mockReset();
  redirect.mockClear();
});

describe("matrice des permissions par rôle", () => {
  it.each(ALL_ROLES)("le rôle %s détient exactement les permissions prévues", (role) => {
    const user = userWith([role]);
    for (const permission of ALL_PERMISSIONS) {
      expect(can(user, permission), `${role} → ${permission}`).toBe(
        expected[role].includes(permission),
      );
    }
  });

  it("chaque permission du catalogue est décrite et attribuée à au moins un rôle", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(PERMISSIONS[permission].length).toBeGreaterThan(5);
      expect(ALL_ROLES.some((role) => can(userWith([role]), permission))).toBe(true);
    }
  });

  it("un membre n'a aucun accès d'administration", () => {
    const member = userWith(["member"]);
    expect(can(member, "member.access")).toBe(true);
    expect(ALL_PERMISSIONS.filter((p) => p !== "member.access").some((p) => can(member, p))).toBe(
      false,
    );
  });

  it("les responsables restent dans leur domaine (moindre privilège)", () => {
    expect(can(userWith(["communication"]), "books.manage")).toBe(false);
    expect(can(userWith(["communication"]), "members.read")).toBe(false);
    expect(can(userWith(["library"]), "articles.manage")).toBe(false);
    expect(can(userWith(["library"]), "scores.enter")).toBe(false);
    expect(can(userWith(["scrabble"]), "books.manage")).toBe(false);
    expect(can(userWith(["scrabble"]), "points.grant")).toBe(false);
    // Les quiz relèvent de la communication et de l'administration, pas des autres responsables.
    expect(can(userWith(["communication"]), "quizzes.manage")).toBe(true);
    expect(can(userWith(["library"]), "quizzes.manage")).toBe(false);
    expect(can(userWith(["scrabble"]), "quizzes.manage")).toBe(false);
    expect(can(userWith(["communication"]), "points.grant")).toBe(false);
  });

  it("seul le super-administrateur gère les rôles ; l'administrateur ne touche pas aux scores", () => {
    for (const role of ALL_ROLES) {
      expect(can(userWith([role]), "roles.manage")).toBe(role === "super_admin");
    }
    expect(can(userWith(["admin"]), "scores.enter")).toBe(false);
    expect(can(userWith(["admin"]), "member.access")).toBe(false);
  });

  it("les rôles se cumulent", () => {
    const user = userWith(["member", "scrabble"]);
    expect(canAll(user, ["member.access", "admin.access", "scores.enter"])).toBe(true);
    expect(can(user, "articles.manage")).toBe(false);
    expect(canAny(user, ["articles.manage", "results.publish"])).toBe(true);
  });

  it("sans utilisateur, ou avec un rôle inconnu : aucune permission", () => {
    expect(can(null, "member.access")).toBe(false);
    expect(can(undefined, "admin.access")).toBe(false);
    expect(permissionsForRoles(["inconnu"]).size).toBe(0);
  });
});

describe("propriété des ressources", () => {
  const member = userWith(["member"], "moi");

  it("un membre accède à ses propres ressources, pas à celles des autres", () => {
    expect(canAccessOwned(member, "moi")).toBe(true);
    expect(canAccessOwned(member, "autre")).toBe(false);
    expect(canAccessOwned(member, null)).toBe(false);
    expect(canAccessOwned(null, "moi")).toBe(false);
  });

  it("la permission de gestion ouvre les ressources des autres", () => {
    expect(canAccessOwned(member, "autre", "members.manage")).toBe(false);
    expect(canAccessOwned(userWith(["admin"], "admin"), "autre", "members.manage")).toBe(true);
  });
});

describe("requireUser / requirePermission (actions et route handlers)", () => {
  it("sans session : UNAUTHENTICATED", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(requirePermission("admin.access")).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each(["SUSPENDED", "ARCHIVED", "PENDING_ACTIVATION"])(
    "session valide mais compte %s : traité comme non connecté",
    async (status) => {
      signedInAs(["super_admin"], status);
      expect(await getCurrentUser()).toBeNull();
      await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    },
  );

  it("compte supprimé entre-temps : non connecté", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });
    findUnique.mockResolvedValue(null);
    await expect(requireUser()).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it.each(ALL_ROLES)("%s : requirePermission suit la matrice", async (role) => {
    signedInAs([role]);
    for (const permission of ALL_PERMISSIONS) {
      if (expected[role].includes(permission)) {
        await expect(requirePermission(permission)).resolves.toMatchObject({ id: "u1" });
      } else {
        await expect(requirePermission(permission)).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
    }
  });

  it("les permissions viennent de la base, pas du nom du rôle", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } });
    // Un rôle « admin » auquel la base n'accorde plus rien.
    findUnique.mockResolvedValue({
      ...dbUser([]),
      roles: [{ role: { code: "admin", permissions: [] } }],
    });
    await expect(requirePermission("admin.access")).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requireOwnership : le propriétaire passe, un autre membre non, un gestionnaire oui", async () => {
    signedInAs(["member"]);
    await expect(requireOwnership("u1")).resolves.toMatchObject({ id: "u1" });
    await expect(requireOwnership("autre")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(requireOwnership("autre", "members.manage")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    signedInAs(["admin"]);
    await expect(requireOwnership("autre", "members.manage")).resolves.toMatchObject({ id: "u1" });
  });
});

describe("requirePageAccess (pages et layouts)", () => {
  it("sans session : redirige vers la connexion avec le retour prévu", async () => {
    getSession.mockResolvedValue(null);
    await expect(requirePageAccess("member.access", "/member")).rejects.toThrow(
      "REDIRECT:/login?next=%2Fmember",
    );
  });

  it("un membre est refusé à l'administration", async () => {
    signedInAs(["member"]);
    await expect(requirePageAccess("admin.access", "/admin")).rejects.toThrow(
      "REDIRECT:/access-denied",
    );
    await expect(requirePageAccess("member.access", "/member")).resolves.toMatchObject({
      id: "u1",
    });
  });

  it.each(["communication", "library", "scrabble", "admin", "super_admin"] as const)(
    "%s entre dans l'administration",
    async (role) => {
      signedInAs([role]);
      await expect(requirePageAccess("admin.access", "/admin")).resolves.toMatchObject({
        id: "u1",
      });
    },
  );

  it.each(["communication", "library", "scrabble", "admin"] as const)(
    "%s seul n'a pas d'espace membre",
    async (role) => {
      signedInAs([role]);
      await expect(requirePageAccess("member.access", "/member")).rejects.toThrow(
        "REDIRECT:/access-denied",
      );
    },
  );
});

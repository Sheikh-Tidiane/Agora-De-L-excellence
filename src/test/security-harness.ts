import { ROLES, type RoleCode } from "@/lib/permissions/catalog";

/**
 * Harnais des tests de sécurité (Server Actions et Route Handlers), sans base ni serveur.
 * La session et la base sont simulées au plus bas niveau : le vrai code de
 * `requirePermission` → `getCurrentUser` → `loadUserAccess` s'exécute.
 *
 * - `auth.api.getSession` renvoie une session si `world.role` est défini ;
 * - `prisma.user.findUnique` répond à la lecture des droits de l'utilisateur connecté
 *   (rôle → permissions du catalogue) ;
 * - tout autre accès à la base est **compté** dans `world.calls` et, sans réponse prévue
 *   dans `world.handlers`, **lève** : une action qui passerait son contrôle d'accès se voit.
 */
export const ACTOR_ID = "ckacteur0000000000000001";

export type DbCall = { target: string; args: unknown[] };

export const world = {
  /** Rôle de l'utilisateur connecté ; `null` : aucune session. */
  role: null as RoleCode | null,
  /** Statut du compte connecté. */
  status: "ACTIVE" as "ACTIVE" | "SUSPENDED" | "ARCHIVED" | "PENDING_ACTIVATION",
  /** Lectures des droits de l'utilisateur connecté (seul accès permis lors d'un refus). */
  accessLoads: 0,
  /** Tout autre accès à la base : lecture ou écriture métier. */
  calls: [] as DbCall[],
  /** Incréments du compteur de débit. */
  rateLimitHits: 0,
  /** Vrai : le compteur de débit répond « limite dépassée ». */
  rateLimited: false,
  /** Réponses prévues pour certains accès métier (`"event.findUnique"`, `"$transaction"`…). */
  handlers: {} as Record<string, (...args: unknown[]) => unknown>,
  /** Appels à Better Auth autres que `getSession`. */
  authCalls: [] as string[],
};

export function resetWorld(): void {
  world.role = null;
  world.status = "ACTIVE";
  world.accessLoads = 0;
  world.calls = [];
  world.rateLimitHits = 0;
  world.rateLimited = false;
  world.handlers = {};
  world.authCalls = [];
}

/** Cibles des accès métier, dans l'ordre : `["setting.findMany", "$transaction"]`. */
export const businessTargets = () => world.calls.map((call) => call.target);

function business(target: string, args: unknown[]): unknown {
  world.calls.push({ target, args });
  const handler = world.handlers[target];
  if (!handler) throw new Error(`Accès à la base non prévu par le test : ${target}`);
  return handler(...args);
}

type AccessQuery = {
  where?: { id?: unknown };
  select?: {
    email?: unknown;
    roles?: { select?: { role?: { select?: { permissions?: unknown } } } };
  };
};

/** La requête de `loadUserAccess` pour l'utilisateur connecté, et elle seule. */
function isAccessLoad(args: unknown): boolean {
  const query = args as AccessQuery | undefined;
  return (
    query?.where?.id === ACTOR_ID &&
    query.select?.email === true &&
    Boolean(query.select.roles?.select?.role?.select?.permissions)
  );
}

function accessRow() {
  const role = world.role!;
  return {
    id: ACTOR_ID,
    firstName: "Awa",
    lastName: "Essai",
    name: "Awa Essai",
    email: "awa.essai@exemple.test",
    memberNumber: null,
    status: world.status,
    roles: [
      {
        role: {
          code: role,
          permissions: ROLES[role].permissions.map((code) => ({ permission: { code } })),
        },
      },
    ],
  };
}

function modelProxy(model: string) {
  return new Proxy(
    {},
    {
      get(_target, method) {
        if (typeof method !== "string" || method === "then") return undefined;
        return async (args: unknown) => {
          if (model === "user" && method === "findUnique" && isAccessLoad(args)) {
            world.accessLoads++;
            return accessRow();
          }
          return business(`${model}.${method}`, [args]);
        };
      },
    },
  );
}

/** Faux client Prisma : chaque modèle et chaque méthode existent, tous surveillés. */
export const fakePrisma: unknown = new Proxy(
  {},
  {
    get(_target, key) {
      if (typeof key !== "string" || key === "then") return undefined;
      if (key === "$queryRaw") {
        return async (strings: TemplateStringsArray, ...values: unknown[]) => {
          if (strings.join("?").includes('INSERT INTO "RateLimit"')) {
            world.rateLimitHits++;
            const now = new Date();
            return [{ count: world.rateLimited ? 100_000 : 1, windowStart: now, now }];
          }
          return business("$queryRaw", [strings, ...values]);
        };
      }
      if (key.startsWith("$")) return async (...args: unknown[]) => business(key, args);
      return modelProxy(key);
    },
  },
);

/** Modules de remplacement, à passer à `vi.mock` (voir les fichiers de test). */
export const prismaModule = { prisma: fakePrisma };

const authCall = (name: string, result: () => unknown) => async () => {
  world.authCalls.push(name);
  return result();
};

export const authModule = {
  ACCOUNT_NOT_ACTIVE: "ACCOUNT_NOT_ACTIVE",
  auth: {
    api: {
      getSession: async () =>
        world.role ? { user: { id: ACTOR_ID }, session: { userId: ACTOR_ID } } : null,
      signInEmail: authCall("signInEmail", () => {
        throw new Error("Better Auth ne doit pas être atteint dans ce test");
      }),
      signOut: authCall("signOut", () => ({ success: true })),
      requestPasswordReset: authCall("requestPasswordReset", () => ({ status: true })),
      resetPassword: authCall("resetPassword", () => ({ status: true })),
    },
  },
};

export const headersModule = {
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
};

export const cacheWrites: string[] = [];
export const cacheModule = {
  updateTag: (tag: string) => void cacheWrites.push(tag),
  revalidateTag: (tag: string) => void cacheWrites.push(tag),
  revalidatePath: (path: string) => void cacheWrites.push(path),
  refresh: () => undefined,
  cacheLife: () => undefined,
  cacheTag: () => undefined,
};

export const ROLE_CODES = Object.keys(ROLES) as RoleCode[];

/** Le rôle détient-il au moins une de ces permissions ? (Catalogue : la référence du seed.) */
export function roleHasAny(role: RoleCode, permissions: readonly string[]): boolean {
  return (ROLES[role].permissions as readonly string[]).some((code) => permissions.includes(code));
}

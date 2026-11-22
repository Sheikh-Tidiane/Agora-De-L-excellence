import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { interestLabels } from "@/config/activities";
import { databaseReachable, realPrisma as db, uniq } from "@/test/real-db";

const membershipValid = {
  firstName: "Awa",
  lastName: "Diop",
  phone: "",
  ageRange: "FROM_18_TO_25",
  occupation: "STUDENT",
  interests: [Object.keys(interestLabels)[0]],
  motivation: "",
  guardianName: "",
  guardianPhone: "",
  consent: true,
  charter: true,
};

/**
 * Limites de débit des formulaires publics, sur la vraie base (le compteur est un
 * `INSERT … ON CONFLICT` : rien de cela ne se simule honnêtement).
 *
 * Le cas qui compte : le jour du lancement, une salle entière adhère par QR code depuis le même
 * Wi-Fi, donc depuis UNE adresse IP. Les adhésions doivent passer ; ce qui freine les abus est la
 * limite par adresse e-mail (3 demandes par jour). Le contact garde une limite stricte par IP.
 */
const net = vi.hoisted(() => ({ ip: "198.51.100.1" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": net.ip }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
}));
vi.mock("next/cache", async () => (await import("@/test/security-harness")).cacheModule);
vi.mock("@/lib/prisma", async () => ({ prisma: (await import("@/test/real-db")).realPrisma }));
const sent = vi.hoisted(() => ({ mails: [] as { to: string; subject: string }[] }));
vi.mock("@/lib/mail", () => ({
  sendMail: async (mail: { to: string; subject: string }) => void sent.mails.push(mail),
}));

const { submitMembershipRequestAction } = await import("@/features/memberships/actions");
const { registerGuestAction } = await import("@/features/events/actions");
const { sendContactMessageAction } = await import("@/features/contact/actions");
const { rateLimitKey, rateLimits } = await import("@/lib/rate-limit");

const reachable = await databaseReachable();

describe.skipIf(!reachable)("formulaires publics : limites de débit", () => {
  const run = uniq();
  const domain = `limites-${run}.e2e.agora.test`;
  const keys: string[] = [];
  /** Une adresse IP propre à chaque test : les compteurs ne se croisent pas d'un test à l'autre. */
  let n = 0;
  const freshIp = () => {
    n++;
    net.ip = `198.51.${100 + (Number.parseInt(run.slice(-2), 36) % 100)}.${n}`;
    for (const name of Object.keys(rateLimits)) keys.push(rateLimitKey(name, net.ip));
    return net.ip;
  };
  const email = (label: string) => {
    const address = `${label}@${domain}`;
    for (const name of Object.keys(rateLimits)) keys.push(rateLimitKey(name, address));
    return address;
  };
  const adhesion = (address: string) =>
    submitMembershipRequestAction({ ...membershipValid, email: address } as never);

  beforeEach(() => {
    sent.mails.length = 0;
  });

  afterAll(async () => {
    await db.membershipRequest.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
    await db.contactMessage.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
    await db.rateLimit.deleteMany({ where: { key: { in: keys } } });
    await db.$disconnect();
  });

  it("50 adhésions depuis la même adresse IP, avec 50 adresses e-mail : toutes acceptées", async () => {
    freshIp();
    const results = [];
    for (let i = 1; i <= 50; i++) results.push(await adhesion(email(`salle-${i}`)));
    expect(results.filter((r) => !r.ok)).toEqual([]);
    const saved = await db.membershipRequest.count({
      where: { email: { startsWith: "salle-", endsWith: `@${domain}` } },
    });
    expect(saved).toBe(50);
    // Chacun a reçu son accusé de réception.
    expect(sent.mails).toHaveLength(50);
  });

  it("au-delà de 100 envois par heure depuis la même IP : refus (la limite large existe)", async () => {
    freshIp();
    const limit = rateLimits["membership.submit.ip"].limit;
    expect(limit).toBe(100);
    // 100 envois en réutilisant 34 adresses (au plus 3 fois chacune, la limite par e-mail) : les
    // doublons sont refusés par le métier (demande déjà en cours), aucun par le limiteur.
    const results = [];
    for (let i = 0; i < limit; i++) results.push(await adhesion(email(`ip-${i % 34}`)));
    expect(results.filter((r) => !r.ok && r.code === "RATE_LIMITED")).toEqual([]);
    const over = await adhesion(email("ip-de-trop"));
    expect(over).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("une même adresse e-mail : 3 demandes par jour, la 4e est refusée, même depuis une autre IP", async () => {
    freshIp();
    const address = email("insistant");
    const first = await adhesion(address);
    expect(first.ok).toBe(true);
    // 2e et 3e : refusées par le métier (demande déjà en cours), mais comptées.
    for (let i = 0; i < 2; i++) {
      const again = await adhesion(address);
      expect(again).toMatchObject({ ok: false, code: "CONFLICT" });
    }
    freshIp();
    const fourth = await adhesion(address.toUpperCase());
    expect(fourth).toMatchObject({ ok: false, code: "RATE_LIMITED" });
    // Une autre personne, depuis la même IP, passe toujours.
    expect((await adhesion(email("voisine"))).ok).toBe(true);
  });

  it("inscription d'un visiteur à une rencontre : même logique (IP large, 3 par e-mail et par jour)", async () => {
    freshIp();
    const eventId = "cmrencontreinexistante0000";
    // 50 visiteurs différents depuis la même IP : aucun n'est arrêté par le limiteur (la
    // rencontre n'existe pas : le refus vient du métier, après le limiteur).
    const results = [];
    for (let i = 1; i <= 50; i++) {
      results.push(
        await registerGuestAction({ eventId, name: "Awa Diop", email: email(`invite-${i}`) }),
      );
    }
    expect(results.filter((r) => !r.ok && r.code === "RATE_LIMITED")).toEqual([]);
    const address = email("invite-insistant");
    for (let i = 0; i < 3; i++) {
      const r = await registerGuestAction({ eventId, name: "Awa Diop", email: address });
      expect(r.ok ? "ok" : r.code).not.toBe("RATE_LIMITED");
    }
    const fourth = await registerGuestAction({ eventId, name: "Awa Diop", email: address });
    expect(fourth).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });

  it("contact : limite stricte, 5 messages par heure et par IP, quelle que soit l'adresse", async () => {
    freshIp();
    const message = {
      name: "Awa Diop",
      subject: "Une question",
      message: "Bonjour, à quelle heure commencent les rencontres ?",
      website: "",
    };
    for (let i = 1; i <= 5; i++) {
      const r = await sendContactMessageAction({ ...message, email: email(`contact-${i}`) });
      expect(r.ok ? "ok" : r.code).not.toBe("RATE_LIMITED");
    }
    const sixth = await sendContactMessageAction({ ...message, email: email("contact-6") });
    expect(sixth).toMatchObject({ ok: false, code: "RATE_LIMITED" });
  });
});

import "dotenv/config";
import { deriveCardKey, newCardSerial, signCardToken } from "@/features/members/card-token";
import { prisma } from "@/lib/prisma";

// Données du parcours « scan des présences » (e2e/scan-presence.spec.ts).
//   tsx e2e/support/scan-fixture.ts setup <stamp>
//     Crée une rencontre du jour publiée (« E2E-Scan <stamp> ») et deux membres actifs inscrits ;
//     affiche en JSON leur identité et le jeton de leur carte.
//   tsx e2e/support/scan-fixture.ts inspect <stamp>
//     Affiche en JSON l'état des inscriptions : présence, méthode, participation, points.
//   tsx e2e/support/scan-fixture.ts cleanup <stamp>
//     Supprime tout ce que le parcours a créé (points, encaissements, traces, rencontre, comptes).
const emailOf = (stamp: string, who: string) => `scan-${who}-${stamp}@e2e.agora.test`;

async function members(stamp: string) {
  return prisma.user.findMany({
    where: { email: { in: [emailOf(stamp, "awa"), emailOf(stamp, "moussa")] } },
    select: { id: true, firstName: true },
    orderBy: { firstName: "asc" },
  });
}

async function setup(stamp: string, title: string) {
  const event = await prisma.event.create({
    data: {
      slug: `e2e-scan-${stamp}`,
      title,
      type: "RENDEZ_VOUS_LECTURE",
      activities: ["RENDEZ_VOUS_LECTURE"],
      description: "Rencontre de test du scan des présences.",
      startsAt: new Date(),
      status: "PUBLISHED",
      publishedAt: new Date(),
      isDemo: true,
    },
  });
  const out: Record<string, unknown> = { eventTitle: title };
  const people = [
    ["awa", "Awa", 1],
    ["moussa", "Moussa", 2],
  ] as const;
  for (const [who, firstName, rank] of people) {
    const user = await prisma.user.create({
      data: {
        name: `${firstName} Scan${stamp}`,
        firstName,
        lastName: `Scan${stamp}`,
        email: emailOf(stamp, who),
        status: "ACTIVE",
        memberNumber: `E2E-${stamp.slice(-6)}-${rank}`,
        // Carte émise comme le fait `issueCardToken` (card-service est réservé au serveur Next).
        cardSerial: newCardSerial(),
        cardIssuedAt: new Date(),
        isDemo: true,
      },
    });
    await prisma.eventRegistration.create({
      data: { eventId: event.id, userId: user.id, status: "CONFIRMED" },
    });
    out[who] = {
      lastName: user.lastName,
      memberNumber: user.memberNumber,
      token: signCardToken(
        { serial: user.cardSerial!, version: user.cardVersion },
        deriveCardKey(process.env.BETTER_AUTH_SECRET!),
      ),
    };
  }
  console.log(JSON.stringify(out));
}

async function inspect(stamp: string, title: string) {
  const rows = [];
  for (const user of await members(stamp)) {
    const registration = await prisma.eventRegistration.findFirst({
      where: { userId: user.id, event: { title } },
      select: {
        attendedAt: true,
        checkInMethod: true,
        payments: { where: { cancelledAt: null }, select: { amount: true } },
      },
    });
    const card = await prisma.payment.findFirst({
      where: { userId: user.id, kind: "MEMBERSHIP_CARD", cancelledAt: null },
      select: { id: true, method: true, reference: true },
    });
    const sum = await prisma.pointTransaction.aggregate({
      where: { userId: user.id },
      _sum: { points: true },
    });
    rows.push({
      firstName: user.firstName,
      present: Boolean(registration?.attendedAt),
      method: registration?.checkInMethod ?? null,
      payments: registration?.payments.map((p) => p.amount) ?? [],
      points: sum._sum.points ?? 0,
      lines: await prisma.pointTransaction.count({ where: { userId: user.id } }),
      // Carte de membre encaissée (moyen, référence) et sa trace au journal.
      card: card && {
        method: card.method,
        reference: card.reference,
        audited: await prisma.auditLog.count({
          where: { action: "payment.recorded", entityId: card.id },
        }),
      },
    });
  }
  console.log(JSON.stringify(rows));
}

async function cleanup(stamp: string, title: string) {
  const ids = (await members(stamp)).map((u) => u.id);
  const registrations = await prisma.eventRegistration.findMany({
    where: { event: { title } },
    select: { id: true },
  });
  const lines = await prisma.pointTransaction.findMany({
    where: { userId: { in: ids } },
    select: { id: true },
  });
  const payments = await prisma.payment.findMany({
    where: { OR: [{ userId: { in: ids } }, { event: { title } }] },
    select: { id: true },
  });
  const entities = [
    ...ids,
    ...registrations.map((r) => r.id),
    ...lines.map((l) => l.id),
    ...payments.map((p) => p.id),
  ];
  await prisma.auditLog.deleteMany({ where: { entityId: { in: entities } } });
  await prisma.pointTransaction.deleteMany({
    where: { userId: { in: ids }, reversesId: { not: null } },
  });
  await prisma.pointTransaction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userBadge.deleteMany({ where: { userId: { in: ids } } });
  await prisma.payment.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { event: { title } }] },
  });
  await prisma.event.deleteMany({ where: { title } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  const [command, stamp] = process.argv.slice(2);
  if (!stamp || !/^\d+$/.test(stamp)) {
    throw new Error("Usage : scan-fixture.ts setup|inspect|cleanup <stamp>");
  }
  const title = `E2E-Scan ${stamp}`;
  if (command === "setup") await setup(stamp, title);
  else if (command === "inspect") await inspect(stamp, title);
  else if (command === "cleanup") await cleanup(stamp, title);
  else throw new Error("Usage : scan-fixture.ts setup|inspect|cleanup <stamp>");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

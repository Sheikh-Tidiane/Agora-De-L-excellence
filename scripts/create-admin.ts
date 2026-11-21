import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "better-auth/crypto";
import { emailSchema, newPasswordSchema } from "@/features/auth/schemas";
import { displayName } from "@/features/auth/service";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// pnpm create-admin — crée le super-administrateur initial.
// Interactif : l'e-mail et le mot de passe sont demandés au clavier, jamais lus dans un fichier
// ni passés en argument, et le mot de passe n'est ni affiché ni journalisé.

let muted = false;
const output = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const rl = createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY });

// File de lignes : fonctionne au clavier comme avec une entrée redirigée (tests).
const lines: string[] = [];
const waiters: ((line: string | null) => void)[] = [];
let closed = false;
rl.on("line", (line) => {
  const waiter = waiters.shift();
  if (waiter) waiter(line);
  else lines.push(line);
});
rl.on("close", () => {
  closed = true;
  for (const waiter of waiters.splice(0)) waiter(null);
});

function nextLine(): Promise<string> {
  if (lines.length) return Promise.resolve(lines.shift()!);
  if (closed) return Promise.reject(new Error("Saisie interrompue."));
  return new Promise((resolve, reject) =>
    waiters.push((line) =>
      line === null ? reject(new Error("Saisie interrompue.")) : resolve(line),
    ),
  );
}

async function ask(question: string): Promise<string> {
  process.stdout.write(question);
  return (await nextLine()).trim();
}

/** Saisie masquée : rien ne s'affiche pendant la frappe. */
async function askSecret(question: string): Promise<string> {
  process.stdout.write(question);
  muted = true;
  try {
    return await nextLine();
  } finally {
    muted = false;
    process.stdout.write("\n");
  }
}

async function main() {
  console.log("Création d’un super-administrateur\n");

  const role = await prisma.role.findUnique({ where: { code: "super_admin" } });
  if (!role) {
    throw new Error("Le rôle super_admin n’existe pas encore. Lancez d’abord : pnpm db:seed");
  }

  const firstName = await ask("Prénom : ");
  const lastName = await ask("Nom : ");
  if (!firstName || !lastName) throw new Error("Le prénom et le nom sont requis.");

  const emailResult = emailSchema.safeParse(await ask("Adresse e-mail : "));
  if (!emailResult.success) throw new Error(emailResult.error.issues[0]!.message);
  const email = emailResult.data;
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    throw new Error("Un compte existe déjà avec cette adresse e-mail.");
  }

  const password = await askSecret("Mot de passe (saisie masquée) : ");
  const passwordResult = newPasswordSchema.safeParse(password);
  if (!passwordResult.success) throw new Error(passwordResult.error.issues[0]!.message);
  if ((await askSecret("Encore une fois : ")) !== password) {
    throw new Error("Les deux mots de passe ne sont pas identiques.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        firstName,
        lastName,
        name: displayName(firstName, lastName),
        email,
        emailVerified: true,
        status: "ACTIVE",
        roles: { create: { roleId: role.id } },
      },
    });
    await tx.account.create({
      data: {
        providerId: "credential",
        accountId: created.id,
        userId: created.id,
        password: passwordHash,
      },
    });
    await audit(
      {
        actorId: null,
        action: "auth.account_created",
        entityType: "User",
        entityId: created.id,
        metadata: { roles: ["super_admin"], source: "create-admin" },
      },
      tx,
    );
    return created;
  });

  console.log(`\nSuper-administrateur créé : ${user.name}. Connexion sur /login.`);
}

main()
  .catch((error) => {
    console.error(`\nÉchec : ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });

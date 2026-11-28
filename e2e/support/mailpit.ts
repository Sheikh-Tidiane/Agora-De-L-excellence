import { expect, type APIRequestContext } from "@playwright/test";

const mailpit = process.env.MAILPIT_URL ?? "http://localhost:8025";

/**
 * Attend l'e-mail le plus récent envoyé à `to` dont l'objet contient `subject`,
 * et renvoie le lien qu'il contient vers `path` (avec son jeton), sous forme de chemin relatif :
 * le test reste ainsi sur le serveur testé, même si son port diffère de celui d'APP_URL.
 */
export async function linkFromEmail(
  request: APIRequestContext,
  { to, subject, path }: { to: string; subject: string; path: string },
): Promise<string> {
  let link: string | undefined;
  await expect(async () => {
    const search = await request.get(`${mailpit}/api/v1/search`, {
      params: { query: `to:"${to}" subject:"${subject}"`, limit: "1" },
    });
    expect(search.ok(), "Mailpit doit être démarré (docker compose up -d)").toBe(true);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    expect(messages.length, `e-mail « ${subject} » pour ${to}`).toBeGreaterThan(0);
    const message = await request.get(`${mailpit}/api/v1/message/${messages[0]!.ID}`);
    const { Text } = (await message.json()) as { Text: string };
    link = Text.split(/\s+/).find((word) => word.includes(`${path}?token=`));
    expect(link, "lien dans l’e-mail").toBeTruthy();
  }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
  const url = new URL(link!);
  return url.pathname + url.search;
}

/** Le plus récent e-mail envoyé à `to` dont l'objet contient `subject` : texte et HTML. */
export async function emailFor(
  request: APIRequestContext,
  { to, subject }: { to: string; subject: string },
): Promise<{ subject: string; text: string; html: string }> {
  let found: { subject: string; text: string; html: string } | undefined;
  await expect(async () => {
    const search = await request.get(`${mailpit}/api/v1/search`, {
      params: { query: `to:"${to}" subject:"${subject}"`, limit: "1" },
    });
    expect(search.ok(), "Mailpit doit être démarré (docker compose up -d)").toBe(true);
    const { messages } = (await search.json()) as { messages: { ID: string }[] };
    expect(messages.length, `e-mail « ${subject} » pour ${to}`).toBeGreaterThan(0);
    const message = await request.get(`${mailpit}/api/v1/message/${messages[0]!.ID}`);
    const body = (await message.json()) as { Subject: string; Text: string; HTML: string };
    found = { subject: body.Subject, text: body.Text, html: body.HTML };
  }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });
  return found!;
}

/** Nombre d'e-mails envoyés à `to` dont l'objet contient `subject`. */
export async function countEmails(
  request: APIRequestContext,
  { to, subject }: { to: string; subject: string },
): Promise<number> {
  const search = await request.get(`${mailpit}/api/v1/search`, {
    params: { query: `to:"${to}" subject:"${subject}"` },
  });
  const { messages } = (await search.json()) as { messages: unknown[] };
  return messages.length;
}

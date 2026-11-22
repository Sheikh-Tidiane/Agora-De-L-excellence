"use server";

import { contactSchema, type ContactInput } from "@/features/contact/schemas";
import { contactRecipient, loadClubSettings } from "@/features/settings/club";
import { AppError, parseInput, runAction, type ActionResult } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { contactEmail } from "@/lib/mail/club-templates";
import { enforceRateLimit } from "@/lib/rate-limit";
import { clientAddress } from "@/lib/request";

/** Formulaire de contact : action publique par nature, limitée en débit. Le message part par e-mail au club. */
export async function sendContactMessageAction(input: ContactInput): Promise<ActionResult> {
  return runAction("contact.send", async () => {
    const data = parseInput(contactSchema, input);
    await enforceRateLimit("contact.ip", await clientAddress());
    // Champ piège rempli : un robot. On répond comme si tout allait bien, sans rien envoyer.
    if (data.website) return undefined;
    const to = contactRecipient(await loadClubSettings());
    if (!to) {
      throw new AppError(
        "INTERNAL",
        "Le club n’a pas encore d’adresse de contact. Réessayez plus tard.",
      );
    }
    await sendMail(
      contactEmail({
        to,
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      }),
    );
    return undefined;
  });
}

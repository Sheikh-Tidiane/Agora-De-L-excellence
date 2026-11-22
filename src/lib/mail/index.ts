import { site } from "@/config/site";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createResendMailService } from "@/lib/mail/resend";
import { createSmtpMailService } from "@/lib/mail/smtp";

/** Un e-mail prêt à partir : toujours une version texte à côté du HTML. */
export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adresse de réponse (formulaire de contact : l'auteur du message). */
  replyTo?: string;
};

/**
 * Interface unique d'envoi. Dev : SMTP vers Mailpit.
 * Prod : SMTP ou Resend, choisi par `MAIL_PROVIDER`.
 */
export interface MailService {
  send(message: MailMessage & { from: string }): Promise<void>;
}

let service: MailService | undefined;

export function getMailService(): MailService {
  service ??=
    env.MAIL_PROVIDER === "resend"
      ? createResendMailService(env.RESEND_API_KEY!)
      : createSmtpMailService({
          host: env.SMTP_HOST,
          port: env.SMTP_PORT,
          secure: env.SMTP_SECURE === "true",
          user: env.SMTP_USER,
          password: env.SMTP_PASSWORD,
        });
  return service;
}

/** Remplace le service d'envoi (tests uniquement). */
export function setMailService(replacement: MailService | undefined) {
  service = replacement;
}

/** Envoie un e-mail au nom du club. Le journal ne garde ni le destinataire complet ni le contenu. */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = `"${site.name.replace(/"/g, "")}" <${env.MAIL_FROM}>`;
  try {
    await getMailService().send({ ...message, from });
    logger.info("E-mail envoyé", { to: message.to, subject: message.subject });
  } catch (error) {
    logger.error("Échec d’envoi d’un e-mail", error, { to: message.to, subject: message.subject });
    throw error;
  }
}

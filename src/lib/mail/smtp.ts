import nodemailer from "nodemailer";
import type { MailService } from "@/lib/mail";

type SmtpOptions = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
};

/** Envoi SMTP (Mailpit en développement, serveur du club ou d'un prestataire en production). */
export function createSmtpMailService(options: SmtpOptions): MailService {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    auth: options.user ? { user: options.user, pass: options.password ?? "" } : undefined,
  });
  return {
    async send(message) {
      await transport.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo,
      });
    },
  };
}
